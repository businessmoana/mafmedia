import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Validate Telegram Web App initData (HMAC-SHA256 per Telegram docs).
 * @param {string} initData - Raw initData query string from window.Telegram.WebApp.initData
 * @returns {{ user: { id: number, first_name?: string, last_name?: string, username?: string } } | null }
 */
export function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computed !== hash) return null;

  const userStr = params.get('user');
  if (!userStr) return null;
  let user;
  try {
    user = JSON.parse(userStr);
  } catch {
    return null;
  }
  if (!user || typeof user.id !== 'number') return null;

  return { user };
}

export function isTelegramAdmin(telegramUserId) {
  return ADMIN_IDS.includes(String(telegramUserId));
}

/**
 * Send a text message to a Telegram user (private chat_id = telegram user id).
 * @param {string|number} chatId - Telegram user id (or chat id)
 * @param {string} text - Message text
 * @returns {Promise<boolean>} - true if sent
 */
export async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN || !chatId || !text) return false;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: Number(chatId),
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      clearTimeout(timeoutId);
      return !!data?.ok;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        // Timeout is expected when Telegram API is slow/unreachable - log as warning, not error
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Telegram sendMessage timeout for chat ${chatId} (this is normal if API is slow)`);
        }
      } else {
        throw fetchError;
      }
      return false;
    }
  } catch (e) {
    // Only log non-timeout errors (network errors, invalid responses, etc.)
    if (e.name !== 'AbortError') {
      console.error('Telegram sendMessage error:', e.message || e);
    }
    return false;
  }
}

/**
 * Send a notification to users by their DB user ids (only to those with telegram_user_id set).
 * @param {import('mysql2/promise').Pool} pool
 * @param {number[]} userIds
 * @param {string} text
 */
export async function notifyUserIds(pool, userIds, text) {
  if (!userIds?.length || !text) {
    console.warn('notifyUserIds: missing userIds or text', { userIds, hasText: !!text });
    return;
  }
  try {
    const [rows] = await pool.query(
      'SELECT telegram_user_id FROM users WHERE id IN (?) AND telegram_user_id IS NOT NULL AND active = 1',
      [userIds]
    );
    if (!rows.length) {
      console.warn('notifyUserIds: no users found with telegram_user_id', { userIds });
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log(`notifyUserIds: sending to ${rows.length} user(s)`, { 
        telegramIds: rows.map(r => r.telegram_user_id) 
      });
    }
    // Send notifications in parallel but don't wait for all to complete
    // This prevents blocking if one notification fails
    const promises = rows.map(row => sendTelegramMessage(row.telegram_user_id, text));
    const results = await Promise.allSettled(promises);
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value));
    if (failed.length && process.env.NODE_ENV !== 'production') {
      console.warn(`notifyUserIds: ${failed.length} notification(s) failed`);
    }
  } catch (err) {
    console.error('notifyUserIds error:', err);
    throw err;
  }
}
