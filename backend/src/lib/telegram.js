import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Log once at load so operator knows notification status
if (!BOT_TOKEN || !String(BOT_TOKEN).trim()) {
  console.warn('[Telegram] TELEGRAM_BOT_TOKEN is not set — notifications will not be sent.');
} else {
  // Test connectivity to Telegram API on startup (non-blocking)
  setTimeout(async () => {
    try {
      const testUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(testUrl, { 
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (data?.ok) {
        console.log('[Telegram] ✅ Connection test OK. Bot:', data.result?.username || 'connected');
      } else {
        console.warn('[Telegram] ⚠️  Connection test failed:', data?.description || data?.error_code || 'Unknown error');
        if (data?.error_code === 401) {
          console.error('[Telegram] Invalid BOT_TOKEN. Check your TELEGRAM_BOT_TOKEN in .env');
        }
      }
    } catch (e) {
      if (e.name === 'AbortError' || e.cause?.message?.includes('Timeout')) {
        console.error('[Telegram] ❌ Connection test timeout — Cannot reach api.telegram.org');
        console.error('[Telegram] This means notifications will NOT work until network connectivity is fixed.');
        console.error('[Telegram] Troubleshooting:');
        console.error('[Telegram]   1. Check server has internet access');
        console.error('[Telegram]   2. If Docker: ensure container has network access (--network host or bridge)');
        console.error('[Telegram]   3. Check firewall allows outbound HTTPS to api.telegram.org:443');
        console.error('[Telegram]   4. Test DNS: nslookup api.telegram.org or ping api.telegram.org');
        console.error('[Telegram]   5. If behind proxy: set HTTP_PROXY/HTTPS_PROXY env vars');
      } else {
        const cause = e.cause?.message || e.cause || e.message;
        console.error('[Telegram] ❌ Connection test failed:', cause);
        console.error('[Telegram] Check: internet connection, firewall rules, DNS resolution for api.telegram.org');
      }
    }
  }, 2000); // Wait 2s after startup
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
 * Retries up to 2 times on network errors with exponential backoff.
 * @param {string|number} chatId - Telegram user id (or chat id)
 * @param {string} text - Message text
 * @param {number} retries - Internal: number of retries remaining
 * @returns {Promise<boolean>} - true if sent
 */
export async function sendTelegramMessage(chatId, text, retries = 2) {
  if (!BOT_TOKEN || !String(BOT_TOKEN).trim()) return false;
  if (!text || !String(text).trim()) return false;
  if (!isSendableTelegramId(chatId)) {
    console.warn('[Telegram] Skipping send: invalid or dev chat_id', { chatId });
    return false;
  }
  const numChatId = Number(chatId);
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutMs = 20000; // 20 seconds per attempt
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
          redirect: 'follow',
        });
        const data = await res.json().catch(() => ({}));
        clearTimeout(timeoutId);
        
        if (data?.ok) {
          if (attempt > 0) {
            console.log(`[Telegram] ✅ sendMessage succeeded on attempt ${attempt + 1} for chat ${numChatId}`);
          }
          return true;
        }
        
        // Handle Telegram rate limiting (429)
        if (data?.error_code === 429) {
          const retryAfter = data?.parameters?.retry_after || 1;
          if (attempt < retries) {
            console.warn(
              `[Telegram] Rate limited (attempt ${attempt + 1}/${retries + 1}), waiting ${retryAfter}s...`,
              { chat_id: numChatId }
            );
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            continue;
          }
          console.error('[Telegram] Rate limited after all retries', { chat_id: numChatId, retry_after: retryAfter });
          return false;
        }
        
        // Other Telegram API error (not network) - don't retry
        console.warn(
          '[Telegram] sendMessage failed',
          { chat_id: numChatId, error: data?.description || data?.error_code, attempt: attempt + 1 }
        );
        return false;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
            console.warn(`[Telegram] sendMessage timeout (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          console.error('[Telegram] sendMessage timeout after all retries');
          return false;
        }
        
        // Network error - retry if attempts remaining
        const isNetworkError = 
          fetchError.cause?.message?.includes('Timeout') ||
          fetchError.cause?.message?.includes('timeout') ||
          fetchError.message?.includes('fetch failed') ||
          fetchError.code === 'ENOTFOUND' ||
          fetchError.code === 'ECONNREFUSED' ||
          fetchError.code === 'ETIMEDOUT';
        
        if (isNetworkError && attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          const errorDetails = {
            name: fetchError.name,
            message: fetchError.message,
            cause: fetchError.cause?.message || fetchError.cause,
            code: fetchError.code,
          };
          console.warn(
            `[Telegram] Network error (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
            errorDetails
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        
        // Final attempt failed or non-retryable error
        const errorDetails = {
          name: fetchError.name,
          message: fetchError.message,
          code: fetchError.code,
          cause: fetchError.cause?.message || fetchError.cause,
          errno: fetchError.errno,
          syscall: fetchError.syscall,
        };
        console.error('[Telegram] sendMessage failed after retries:', errorDetails);
        
        if (isNetworkError) {
          console.error('[Telegram] ⚠️  Cannot reach api.telegram.org');
          console.error('[Telegram] Check: internet connection, firewall rules, Docker network settings, DNS resolution');
          console.error('[Telegram] Test: curl https://api.telegram.org or ping api.telegram.org from the server');
        }
        return false;
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        const errorDetails = {
          name: e?.name,
          message: e?.message,
          code: e?.code,
          cause: e?.cause?.message || e?.cause,
        };
        console.error('[Telegram] sendMessage error:', errorDetails);
      }
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return false;
    }
  }
  return false;
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
    
    // Send sequentially with small delays to avoid Telegram rate limits (30 msg/sec)
    // Delay of 50ms between sends = max 20 msg/sec, well under limit
    const results = [];
    for (let i = 0; i < sendable.length; i++) {
      const row = sendable[i];
      try {
        const success = await sendTelegramMessage(row.telegram_user_id, text);
        results.push({ status: 'fulfilled', value: success });
        if (success && i === 0) {
          // Log first success for visibility
          console.log(`[Telegram] ✅ Sent notification to user ${row.telegram_user_id}`);
        }
      } catch (err) {
        results.push({ status: 'rejected', reason: err });
      }
      
      // Small delay between sends to avoid rate limits (except after last one)
      if (i < sendable.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    
    const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value)
    ).length;
    
    if (succeeded > 0) {
      console.log(`[Telegram] ✅ Successfully sent ${succeeded} of ${sendable.length} notification(s)`);
    }
    if (failed > 0) {
      console.warn(`[Telegram] ⚠️  Failed to send ${failed} of ${sendable.length} notification(s)`);
    }
  } catch (err) {
    console.error('[Telegram] notifyUserIds error:', err?.message || err);
    // Do not rethrow — notifications must not break API responses
  }
}
