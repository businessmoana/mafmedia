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

// Admin: set user role (admin or user)
router.patch('/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'role must be "admin" or "user"' });
    }
    const targetId = Number(id);
    // Prevent changing your own role
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    const [existing] = await pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });
    const currentRole = existing[0].role;
    if (currentRole === role) {
      return res.json({ success: true });
    }
    // When demoting to user, ensure at least one admin remains
    if (role === 'user') {
      const [adminCount] = await pool.query(
        "SELECT COUNT(*) as n FROM users WHERE role = 'admin' AND id != ?",
        [id]
      );
      if ((adminCount[0]?.n || 0) < 1) {
        return res.status(400).json({ error: 'At least one admin must remain' });
      }
    }
    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Admin: update user name
router.patch('/:id/name', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }
    const trimmedName = name.trim();
    if (trimmedName.length > 255) {
      return res.status(400).json({ error: 'name must be 255 characters or less' });
    }
    const [existing] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });
    
    await pool.query('UPDATE users SET name = ?, name_edited = TRUE WHERE id = ?', [trimmedName, id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user name' });
  }
});

export default router;
