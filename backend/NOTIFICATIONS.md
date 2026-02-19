# Telegram Notifications

## Simple & Reliable

**When admin does something → assigned users get Telegram notification**

- Admin creates task → assigned users notified
- Admin comments/replies → assigned users notified  
- Admin marks task complete → assigned users notified

## How It Works

1. Admin action triggers `notifyUserIds(pool, userIds, message)`
2. System gets users with valid `telegram_user_id` from database
3. Sends notifications **sequentially** with 50ms delay between each
4. Handles 100+ users safely (respects Telegram's 30 msg/sec limit)

## Requirements

- Set `TELEGRAM_BOT_TOKEN` in `.env`
- Users must have `telegram_user_id` set and `active = 1`
- Users must open app from Telegram bot (not external link) so bot can message them

## Files

- `src/lib/telegram.js` - `notifyUserIds()` function
- `src/routes/tasks.js` - calls notifyUserIds on create/complete
- `src/routes/comments.js` - calls notifyUserIds on admin comment
