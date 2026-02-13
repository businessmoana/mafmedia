# Media Distribution CRM

A lightweight CRM for media distributors to assign publication tasks to website partners. **Telegram Mini App** — no email login; partners open the app from the bot and are signed in automatically.

## Features

- **Two roles:** Admin (full visibility) and Users (assigned tasks only, own comments only)
- **Auth:** Telegram only. Partners open the app from the bot; admin is set via `TELEGRAM_ADMIN_IDS`. Browser testing on localhost uses a dev-admin account when `ALLOW_DEV_ADMIN=true`.
- **Tasks:** Title, content body, per-task assignment (Select all or individual users), visible/invisible
- **Comments:** Threaded; users post comments; admin can **Reply** to a user’s comment. Each user sees only **their own comments + admin replies to them**.
- **Admin actions:** Mark complete, reply to a user (per-thread), toggle visibility
- **Notifications:** Telegram messages when a new task is created, admin replies, or task is marked complete

## Quick Start

### 1. Database

```bash
cd backend
cp .env.example .env
# Edit .env: DB_*, JWT_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_IDS, ALLOW_DEV_ADMIN=true for local
npm install
npm run db:init
```

**Existing DB (had email/password):** Clear data and switch to Telegram-only schema:

```bash
npm run db:migrate-telegram-only
```

This deletes all tasks, comments, and users; drops `email` and `password_hash`; creates one **Dev Admin** user for browser testing.

### 2. Backend

```bash
cd backend
npm run dev
```

Server runs at http://localhost:3001

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

- **In Telegram:** Open the app from your bot → signed in via Telegram.
- **In browser (localhost):** With `ALLOW_DEV_ADMIN=true` in backend `.env`, you are signed in as **Dev Admin** automatically (for testing).

### 4. Telegram Mini App

1. Create a bot with [@BotFather](https://t.me/BotFather), get the **bot token**. Put it in backend `.env` as `TELEGRAM_BOT_TOKEN`.
2. Set `TELEGRAM_ADMIN_IDS` to your (or your wife’s) Telegram user ID (comma-separated). Those users get admin when they first open the app from the bot.
3. Deploy the frontend to a **public HTTPS** URL (or use ngrok for testing). In BotFather, set the bot’s **Menu Button** / **Web App** URL to that URL.
4. Partners open the app from the bot → they are created as users and see only tasks assigned to them.

#### Testing with ngrok

```bash
# Terminal 1 – backend
cd backend && npm run dev

# Terminal 2 – frontend
cd frontend && npm run dev

# Terminal 3
ngrok http 8888
```

Use the ngrok **HTTPS** URL as the Web App URL in BotFather. (Use the port your Vite server shows, e.g. 8888.)

## First Use

1. **Admin:** Open the app from the Telegram bot (your ID in `TELEGRAM_ADMIN_IDS`) or on localhost (dev-admin).
2. **Partners:** Open from the bot; they appear under **Users** once they’ve opened the app.
3. Create a task, assign users, set visible. Partners see only assigned visible tasks and comment with their links; admin can reply or mark complete.

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── db/         # schema, init, migrate-telegram-only
│   │   ├── lib/        # telegram (validate initData, notifications)
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── server.js
├── frontend/
│   └── src/
│       ├── api/
│       ├── components/
│       ├── context/
│       └── pages/
```

## API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/telegram | - | Telegram Mini App auth (body: `{ initData }`) |
| POST | /api/auth/dev-admin | - | Browser dev only (when ALLOW_DEV_ADMIN=true) |
| GET | /api/me | ✓ | Current user |
| GET | /api/users | Admin | List users |
| GET | /api/tasks | ✓ | List tasks |
| GET | /api/tasks/:id | ✓ | Get task |
| POST | /api/tasks | Admin | Create task |
| PATCH | /api/tasks/:id | Admin | Update visibility/complete |
| PUT | /api/tasks/:id/assignments | Admin | Update assignments |
| GET | /api/tasks/:id/comments | ✓ | List comments |
| POST | /api/tasks/:id/comments | ✓ | Add comment |

## Environment (backend .env)

- `PORT` – API port (default 3001)
- `JWT_SECRET` – Secret for JWT
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` – MySQL
- `TELEGRAM_BOT_TOKEN` – Bot token from @BotFather (required for Mini App auth + notifications)
- `TELEGRAM_ADMIN_IDS` – Comma-separated Telegram user IDs that become admin in the Mini App
- `ALLOW_DEV_ADMIN` – Set to `true` to sign in as admin on localhost in the browser (no Telegram)

## License

MIT
