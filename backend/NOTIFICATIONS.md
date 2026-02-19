# Telegram notifications (A–Z)

## Who gets notified

- **Users** (partners) receive Telegram messages when:
  - Admin **creates a task** and assigns them
  - Admin **posts or replies to a comment** on a task they’re assigned to (or that they commented on)
  - Admin **marks a task as complete** (assigned users)
- **Admins** do not receive Telegram notifications (they use the app).

## Requirements

1. **Bot token**  
   Set `TELEGRAM_BOT_TOKEN` in `.env`. If missing, the server logs a warning and no notifications are sent.

2. **User must “start” the bot**  
   Telegram only allows a bot to message a user after the user has started the bot (e.g. opened the Web App from the bot).  
   - Users should open the app **from the Telegram bot** (menu, link, or button), not from an external link.  
   - On first app open we send one welcome message to establish the chat so later notifications work when the app is closed.

3. **Database column for “chat started”**  
   Run the migration once so we can remember we’ve already sent the welcome message:

   ```bash
   node src/db/migrate-telegram-chat-started.js
   ```

   If this migration is not run, the welcome message is skipped (no error); notifications may still fail with “bot can't initiate conversation” until the user has started the bot another way.

## Flow (summary)

| Event | Backend action | Who gets Telegram |
|-------|----------------|--------------------|
| Admin creates task with assignees | `notifyUserIds(assigned_user_ids, "New task: ...")` | Assigned users (with valid `telegram_user_id`, active, not dev-admin) |
| Admin marks task complete | `notifyUserIds(assigned_user_ids, "Task completed...")` | Assigned users |
| Admin posts/replies comment | `notifyUserIds([repliedToUserId], "Admin replied/posted...")` | That one user |
| User opens app (GET /me) | If `telegram_chat_started` is false, send welcome message and set flag | That user (one-time) |

- `notifyUserIds` only sends to users that have a **numeric** `telegram_user_id` (not `dev-admin`), are **active**, and have a non-empty token. It **never throws**; failures are logged only.
- Sends are **sequential with 50ms delays** to avoid Telegram rate limits (30 msg/sec limit).
- Automatic **retries** (up to 3 attempts) on network errors with exponential backoff.
- Handles Telegram **rate limiting (429)** by waiting for the `retry_after` period.
- `sendTelegramMessage(chatId, text)` returns `false` if token missing, invalid `chatId`, or Telegram API error; errors are logged with `[Telegram]` prefix.

## Troubleshooting

- **No notifications at all**  
  - Check `.env`: `TELEGRAM_BOT_TOKEN` set and correct.  
  - Restart server; on startup it logs whether Telegram is enabled and runs a connection test.  
  - Check server logs for `[Telegram]` warnings (e.g. “no sendable users”, “sendMessage failed”).

- **“fetch failed” / Network errors**  
  If you see `[Telegram] sendMessage error: fetch failed` or connection test failures:
  - **Check internet connectivity**: Server must be able to reach `api.telegram.org` (port 443 HTTPS).
  - **Firewall/proxy**: Ensure outbound HTTPS to `api.telegram.org` is allowed. If behind a proxy, configure Node.js HTTP agent or environment variables (`HTTP_PROXY`, `HTTPS_PROXY`).
  - **DNS**: Verify `api.telegram.org` resolves: `nslookup api.telegram.org` or `ping api.telegram.org`.
  - **PM2 users**: Ensure your server has internet access. Test with `curl https://api.telegram.org` from the server. Check firewall rules (iptables/ufw) allow outbound HTTPS (port 443). If behind proxy, set `HTTP_PROXY` and `HTTPS_PROXY` in `.env` and restart PM2 with `pm2 restart all --update-env`.
  - **VPN/Geo-restrictions**: Some networks block Telegram API. Try from a different network or use a VPN.
  - Check logs for error codes: `ENOTFOUND` (DNS), `ECONNREFUSED` (connection refused), `ETIMEDOUT` (timeout).

- **“Bot can't initiate conversation with a user”**  
  The user has not started the bot. They must open the app from the Telegram bot (menu/link/button). After that, we send one welcome message; then future notifications work even when the app is closed.  
  Ensure `migrate-telegram-chat-started.js` has been run so the welcome message is sent and the flag is stored.

- **Only works when app is open**  
  Same as above: ensure the user opened the app from the bot at least once and the migration is applied so the one-time welcome is sent.

- **Dev-admin / browser testing**  
  Users with `telegram_user_id = 'dev-admin'` are never sent Telegram messages (skipped in code).

- **Intermittent notifications (sometimes works, sometimes doesn't)**  
  This usually indicates network instability or hitting Telegram rate limits.
  
  **What we've implemented:**
  - Automatic retries (3 attempts) on network errors
  - Sequential sending with delays to avoid rate limits
  - Rate limit (429) handling with automatic retry after wait period
  
  **Check logs for:**
  - `[Telegram] ✅ Successfully sent X of Y notification(s)` = working
  - `[Telegram] ⚠️ Failed to send X of Y` = some failed
  - `[Telegram] Rate limited` = hitting Telegram limits (should auto-retry)
  - `[Telegram] Network error` = connectivity issues (will retry)
  
  **If still intermittent:**
  - Check server network stability: `ping api.telegram.org` (should be consistent)
  - Check if sending to many users at once (Telegram limit: 30 msg/sec)
  - Check server resources (CPU/memory) — high load can cause timeouts
  - Review logs to see if failures are network errors or rate limits

- **PM2-specific: "Connect Timeout Error"**  
  If using PM2 and seeing connection timeouts:
  
  1. **Test server connectivity:**
     ```bash
     curl -v https://api.telegram.org
     # Should return HTML, not timeout
     ```
  
  2. **Check firewall (most common issue):**
     ```bash
     # Check iptables
     sudo iptables -L OUTPUT -n | grep 443
     # If no rule, allow outbound HTTPS:
     sudo iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT
     sudo iptables-save
     
     # Or check ufw
     sudo ufw status
     ```
  
  3. **Cloud firewall (AWS/GCP/Azure):**
     - Check Security Groups / Firewall rules
     - Add outbound rule: Allow HTTPS (443) to `0.0.0.0/0`
  
  4. **If behind proxy, add to `.env`:**
     ```bash
     HTTP_PROXY=http://proxy.example.com:8080
     HTTPS_PROXY=http://proxy.example.com:8080
     ```
     Then: `pm2 restart all --update-env`
  
  5. **After fixing, restart PM2:**
     ```bash
     pm2 restart all
     pm2 logs  # Check for: [Telegram] ✅ Connection test OK
     ```

## Files involved

- `src/lib/telegram.js` — `sendTelegramMessage`, `notifyUserIds`, validation, token check.
- `src/routes/tasks.js` — notifications on task create and task complete.
- `src/routes/comments.js` — notification when admin comments/replies.
- `src/server.js` — GET /api/me: one-time “ensure chat” welcome message.
- `src/db/migrate-telegram-chat-started.js` — adds `users.telegram_chat_started`.
- `src/middleware/auth.js` — loads user (no dependency on `telegram_chat_started` column).
