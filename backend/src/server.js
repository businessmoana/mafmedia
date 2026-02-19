import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import dotenv from 'dotenv';

import pool from './config/db.js';
import { authenticate, requireAdmin } from './middleware/auth.js';
import { sendTelegramMessage } from './lib/telegram.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import tasksRouter from './routes/tasks.js';
import commentsRouter from './routes/comments.js';
import assignmentsRouter from './routes/assignments.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: true, credentials: true },
  path: '/socket.io',
  transports: ['polling', 'websocket'],
  allowEIO3: true,
});

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [decoded.userId]);
    if (rows.length && rows[0].role === 'admin') {
      socket.join('admin');
    }
  } catch (_) {}
  next();
});

app.set('io', io);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/users', authenticate, requireAdmin, usersRouter);
app.use('/api/tasks/:id/comments', authenticate, commentsRouter);
app.use('/api/tasks', authenticate, tasksRouter);
app.use('/api/assignments', authenticate, requireAdmin, assignmentsRouter);

app.get('/api/me', authenticate, (req, res) => {
  res.json(req.user);

  // One-time: open Telegram chat so we can notify user when app is closed.
  // Telegram allows bot to message user only after they've "started" the bot; sending
  // one message when they open the app establishes the chat.
  const u = req.user;
  if (u?.role !== 'user' || !u?.telegram_user_id || u?.telegram_user_id === 'dev-admin') return;

  pool
    .query('SELECT telegram_chat_started FROM users WHERE id = ?', [u.id])
    .then(([rows]) => {
      if (!rows?.length || rows[0].telegram_chat_started) return;
      const text =
        "✅ You're set. You'll get notifications here when admin assigns you tasks or replies.";
      return sendTelegramMessage(u.telegram_user_id, text).then((ok) => {
        if (ok) {
          return pool.query('UPDATE users SET telegram_chat_started = TRUE WHERE id = ?', [u.id]);
        }
      });
    })
    .catch((err) => {
      // Column may not exist before migration; ignore
      if (err?.code !== 'ER_BAD_FIELD_ERROR') {
        console.error('[Telegram] Ensure-chat check failed:', err?.message || err);
      }
    });
});

app.get('/health', (req, res) => res.json({ ok: true }));

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  if (process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    console.log('Telegram notifications enabled. Run migrate-telegram-chat-started.js if users do not receive notifications when app is closed.');
  }
});
