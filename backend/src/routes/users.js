import express from 'express';
import pool from '../config/db.js';

const router = express.Router();

// Admin only: list all users (id, name, role, telegram_user_id, active)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, role, telegram_user_id, active, created_at FROM users ORDER BY name ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Admin: activate/deactivate user
router.patch('/:id/active', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active must be boolean' });
    }
    // Prevent admin from deactivating themselves
    if (Number(id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate yourself' });
    }
    const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });

    await pool.query('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

export default router;
