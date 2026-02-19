# Telegram Notifications

## Simple Overview

**Users get Telegram notifications when:**
- Admin creates a task and assigns them
- Admin posts/replies to a comment on their task
- Admin marks a task as complete

**Admins don't get Telegram notifications** (they use the app).

## Setup

1. Set `TELEGRAM_BOT_TOKEN` in `.env`
2. Users must open the app **from the Telegram bot** (not external link) at least once so the bot can message them

## How It Works

- When admin creates/completes task or comments → `notifyUserIds()` is called
- Sends Telegram message to assigned users (who have `telegram_user_id` set and are active)
- If sending fails, it's logged but doesn't break the API response

## Troubleshooting

**No notifications:**
- Check `TELEGRAM_BOT_TOKEN` is set in `.env`
- Check server logs for `[Telegram]` messages
- Ensure users opened the app from the bot (not external link)
- Test server connectivity: `curl https://api.telegram.org`

**"fetch failed" errors:**
- Server can't reach `api.telegram.org`
- Check firewall allows outbound HTTPS (port 443)
- Test: `curl https://api.telegram.org` from server

## Files

- `src/lib/telegram.js` - `sendTelegramMessage()`, `notifyUserIds()`
- `src/routes/tasks.js` - notifications on task create/complete
- `src/routes/comments.js` - notifications on admin comment/reply
