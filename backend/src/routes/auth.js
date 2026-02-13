import express from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import { validateInitData, isTelegramAdmin } from '../lib/telegram.js';

const router = express.Router();

const DEV_ADMIN_ID = 'dev-admin';

// Telegram Mini App auth: validate initData, find or create user, return JWT
router.post('/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    if (!initData || typeof initData !== 'string') {
      return res.status(400).json({ error: 'initData is required' });
    }

    const parsed = validateInitData(initData);
    if (!parsed) {
      return res.status(401).json({ error: 'Invalid Telegram initData' });
    }

    const { id: telegramUserId, first_name, last_name, username } = parsed.user;
    const name = [first_name, last_name].filter(Boolean).join(' ').trim() || username || `User ${telegramUserId}`;

    let [rows] = await pool.query(
      'SELECT id, name, role, telegram_user_id, active FROM users WHERE telegram_user_id = ?',
      [String(telegramUserId)]
    );

    if (rows.length) {
      const user = rows[0];
      await pool.query(
        'UPDATE users SET name = ? WHERE id = ?',
        [name, user.id]
      );
      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({
        token,
        user: { id: user.id, name, role: user.role, telegram_user_id: user.telegram_user_id, active: user.active },
      });
    }

    const role = isTelegramAdmin(telegramUserId) ? 'admin' : 'user';
    const [result] = await pool.query(
      'INSERT INTO users (name, role, telegram_user_id, active) VALUES (?, ?, ?, TRUE)',
      [name, role, String(telegramUserId)]
    );

    const token = jwt.sign(
      { userId: result.insertId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: { id: result.insertId, name, role, telegram_user_id: String(telegramUserId), active: true },
    });
  } catch (err) {
    const mysqlMsg = err?.sqlMessage ?? err?.message;
    const detail = mysqlMsg || err?.code || String(err);
    console.error('Telegram auth error:', detail);
    if (err?.code) console.error('MySQL code:', err.code);
    if (err?.sqlMessage) console.error('MySQL sqlMessage:', err.sqlMessage);
    console.error(err?.stack || err);
    res.status(500).json({
      error: 'Telegram auth failed',
      ...(process.env.NODE_ENV !== 'production' && { detail }),
    });
  }
});

// Browser testing only: sign in as admin (no Telegram). Set ALLOW_DEV_ADMIN=true in .env
router.post('/dev-admin', async (req, res) => {
  if (process.env.ALLOW_DEV_ADMIN !== 'true') {
    return res.status(404).json({ error: 'Not available' });
  }
  try {
    let [rows] = await pool.query(
      'SELECT id, name, role, telegram_user_id, active FROM users WHERE telegram_user_id = ?',
      [DEV_ADMIN_ID]
    );
    if (!rows.length) {
      const [result] = await pool.query(
        'INSERT INTO users (name, role, telegram_user_id, active) VALUES (?, ?, ?, TRUE)',
        ['Dev Admin', 'admin', DEV_ADMIN_ID]
      );
      rows = [{ id: result.insertId, name: 'Dev Admin', role: 'admin', telegram_user_id: DEV_ADMIN_ID, active: true }];
    }
    const user = rows[0];
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role, telegram_user_id: user.telegram_user_id, active: user.active },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Dev admin auth failed' });
  }
});

export default router;
