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
 * Send a single Telegram message. Retries once on failure.
 */
async function sendMessage(chatId, text) {
  if (!BOT_TOKEN || !chatId || !text) return false;
  
  const chatIdStr = String(chatId);
  if (chatIdStr === 'dev-admin') return false;
  
  const numChatId = Number(chatId);
  if (!Number.isFinite(numChatId) || numChatId === 0) return false;

  // Try twice (initial + 1 retry)
  for (let attempt = 0; attempt < 2; attempt++) {
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
      
      // Rate limited - wait and retry
      if (data?.error_code === 429 && attempt === 0) {
        const waitSeconds = data?.parameters?.retry_after || 2;
        await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));
        continue;
      }
      
      // Other error - retry once after delay
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      return false;
    } catch (err) {
      // Network error - retry once
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      return false;
    }
  }
  
  return false;
}

/**
 * Send notification to users. Handles rate limits and many users safely.
 * Sends sequentially with delays to avoid Telegram limits (30 msg/sec).
 */
export async function notifyUserIds(pool, userIds, text) {
  if (!pool || !userIds?.length || !text?.trim()) return;
  if (!BOT_TOKEN) return;

  try {
    // Get users with valid telegram_user_id
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

    // Send sequentially with delay to respect Telegram rate limits
    // Delay of 50ms = max 20 msg/sec, well under Telegram's 30 msg/sec limit
    let successCount = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sent = await sendMessage(row.telegram_user_id, text);
      if (sent) {
        successCount++;
      }
      
      // Delay between sends (except after last one)
      if (i < rows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  } catch (err) {
    // Silent fail - don't break API responses
  }
}
