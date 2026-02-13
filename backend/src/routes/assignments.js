import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// Get assignments for a task (admin only). Users table has no email column (Telegram-only).
router.get('/task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.telegram_user_id
       FROM users u
       JOIN task_assignments ta ON ta.user_id = u.id
       WHERE ta.task_id = ? AND u.role = 'user'
       ORDER BY u.name`,
      [taskId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

export default router;
