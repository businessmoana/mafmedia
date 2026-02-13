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
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return !!data?.ok;
  } catch (e) {
    console.error('Telegram sendMessage error:', e);
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
  if (!userIds?.length || !text) return;
  const [rows] = await pool.query(
    'SELECT telegram_user_id FROM users WHERE id IN (?) AND telegram_user_id IS NOT NULL',
    [userIds]
  );
  for (const row of rows) {
    await sendTelegramMessage(row.telegram_user_id, text);
  }
}
