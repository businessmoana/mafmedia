import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query(
      'SELECT id, name, role, telegram_user_id, active, COALESCE(telegram_chat_started, FALSE) AS telegram_chat_started FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'User not found' });
    }
    const user = rows[0];
    // Block deactivated non-admin users from accessing any protected API
    if (user.role !== 'admin' && user.active === 0) {
      return res.status(403).json({ error: 'Account deactivated', code: 'DEACTIVATED' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
