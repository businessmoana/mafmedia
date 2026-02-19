import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!BOT_TOKEN) {
  console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set — notifications disabled');
}

/**
 * Validate Telegram Web App initData (HMAC-SHA256 per Telegram docs).
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
 * Send a Telegram message to a user.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendTelegramMessage(chatId, text) {
  if (!BOT_TOKEN || !chatId || !text) return false;
  
  // Skip dev-admin
  if (String(chatId) === 'dev-admin') return false;
  
  const numChatId = Number(chatId);
  if (!Number.isFinite(numChatId) || numChatId === 0) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: numChatId,
        text: String(text),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    
    if (data?.ok) {
      return true;
    }
    
    console.warn('[Telegram] Failed to send:', data?.description || data?.error_code);
    return false;
  } catch (err) {
    console.error('[Telegram] Error sending message:', err.message || err);
    return false;
  }
}

/**
 * Send notifications to multiple users by their DB user IDs.
 * Only sends to users with telegram_user_id set and active = 1.
 */
export async function notifyUserIds(pool, userIds, text) {
  if (!pool || !userIds?.length || !text?.trim()) return;
  if (!BOT_TOKEN) return;

  try {
    const placeholders = userIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT telegram_user_id FROM users
       WHERE id IN (${placeholders})
         AND telegram_user_id IS NOT NULL
         AND telegram_user_id != 'dev-admin'
         AND active = 1`,
      userIds
    );

    if (!rows.length) return;

    // Send to all users (simple parallel send)
    const promises = rows.map((row) => sendTelegramMessage(row.telegram_user_id, text));
    const results = await Promise.allSettled(promises);
    
    const successCount = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    
    if (successCount > 0) {
      console.log(`[Telegram] Sent ${successCount} of ${rows.length} notification(s)`);
    }
  } catch (err) {
    console.error('[Telegram] notifyUserIds error:', err.message || err);
  }
}
