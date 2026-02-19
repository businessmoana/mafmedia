import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Log once at load so operator knows notification status
if (!BOT_TOKEN || !String(BOT_TOKEN).trim()) {
  console.warn('[Telegram] TELEGRAM_BOT_TOKEN is not set — notifications will not be sent.');
}

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

/** True if this telegram_user_id can receive bot messages (numeric, not dev placeholder). */
function isSendableTelegramId(telegramUserId) {
  if (telegramUserId == null || String(telegramUserId).trim() === '') return false;
  const s = String(telegramUserId);
  if (s === 'dev-admin') return false;
  const n = Number(telegramUserId);
  return Number.isFinite(n) && n !== 0;
}

/**
 * Send a text message to a Telegram user (private chat_id = telegram user id).
 * @param {string|number} chatId - Telegram user id (or chat id)
 * @param {string} text - Message text
 * @returns {Promise<boolean>} - true if sent
 */
export async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN || !String(BOT_TOKEN).trim()) return false;
  if (!text || !String(text).trim()) return false;
  if (!isSendableTelegramId(chatId)) {
    console.warn('[Telegram] Skipping send: invalid or dev chat_id', { chatId });
    return false;
  }
  const numChatId = Number(chatId);
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: numChatId,
          text: String(text),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      clearTimeout(timeoutId);
      if (!data?.ok) {
        console.warn(
          '[Telegram] sendMessage failed',
          { chat_id: numChatId, error: data?.description || data?.error_code }
        );
        return false;
      }
      return true;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.warn('[Telegram] sendMessage timeout for chat', numChatId);
      } else {
        console.error('[Telegram] sendMessage error:', fetchError.message || fetchError);
      }
      return false;
    }
  } catch (e) {
    if (e?.name !== 'AbortError') {
      console.error('[Telegram] sendMessage error:', e?.message || e);
    }
    return false;
  }
}

/**
 * Send a notification to users by their DB user ids.
 * Only sends to users with a valid telegram_user_id (numeric, not dev-admin) and active = 1.
 * Never throws — logs errors and returns.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {number[]} userIds
 * @param {string} text
 */
export async function notifyUserIds(pool, userIds, text) {
  if (!pool || !userIds?.length || !text?.trim()) {
    console.warn('[Telegram] notifyUserIds: missing pool, userIds or text');
    return;
  }
  try {
    const placeholders = userIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT telegram_user_id FROM users
       WHERE id IN (${placeholders})
         AND telegram_user_id IS NOT NULL
         AND TRIM(telegram_user_id) != ''
         AND telegram_user_id != 'dev-admin'
         AND active = 1`,
      userIds
    );
    const sendable = rows.filter((r) => isSendableTelegramId(r.telegram_user_id));
    if (!sendable.length) {
      console.warn('[Telegram] notifyUserIds: no sendable users', { userIds });
      return;
    }
    console.log('[Telegram] notifyUserIds: sending to', sendable.length, 'user(s)');
    const results = await Promise.allSettled(
      sendable.map((row) => sendTelegramMessage(row.telegram_user_id, text))
    );
    const failed = results.filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)
    );
    if (failed.length) {
      console.warn('[Telegram] notifyUserIds:', failed.length, 'of', results.length, 'failed');
    }
  } catch (err) {
    console.error('[Telegram] notifyUserIds error:', err?.message || err);
    // Do not rethrow — notifications must not break API responses
  }
}
