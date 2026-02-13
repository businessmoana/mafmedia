import express from 'express';
import pool from '../config/db.js';
import { notifyUserIds } from '../lib/telegram.js';

const router = express.Router({ mergeParams: true });

// Get comments: admin sees all (with parent_id for threading); user sees only their thread (own comments + replies to their comments)
router.get('/', async (req, res) => {
  try {
    const { id: taskId } = req.params;
    const { role, id: userId } = req.user;

    const [taskRows] = await pool.query(
      role === 'admin'
        ? 'SELECT id FROM tasks WHERE id = ?'
        : `SELECT t.id FROM tasks t
           JOIN task_assignments ta ON t.id = ta.task_id
           WHERE t.id = ? AND ta.user_id = ? AND t.visible = 1`,
      role === 'admin' ? [taskId] : [taskId, userId]
    );
    if (!taskRows.length) return res.status(404).json({ error: 'Task not found' });

    if (role === 'admin') {
      const [rows] = await pool.query(
        `SELECT c.*, u.name as user_name, u.role as user_role
         FROM comments c JOIN users u ON c.user_id = u.id
         WHERE c.task_id = ? ORDER BY COALESCE(c.parent_id, c.id), c.created_at ASC`,
        [taskId]
      );
      return res.json(rows);
    }

    // User sees: (1) own comments, (2) admin replies to their comments, (3) admin top-level comments (broadcast to all assigned)
    const taskIdNum = parseInt(taskId, 10);
    const userIdNum = parseInt(userId, 10);
    const [rows] = await pool.query(
      `SELECT c.*, u.name as user_name, u.role as user_role
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.task_id = ?
         AND (
           c.user_id = ?
           OR EXISTS (
             SELECT 1 FROM comments p
             WHERE p.id = c.parent_id AND p.task_id = c.task_id AND p.user_id = ?
           )
           OR (u.role = 'admin' AND c.parent_id IS NULL)
         )
       ORDER BY COALESCE(c.parent_id, c.id), c.created_at ASC`,
      [taskIdNum, userIdNum, userIdNum]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Add comment (optional parent_id: only admin can set, for replying to a user's comment)
router.post('/', async (req, res) => {
  try {
    const { id: taskId } = req.params;
    const { body, parent_id: parentId } = req.body;
    const { id: userId } = req.user;

    if (!body?.trim()) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    const [taskRows] = await pool.query(
      req.user.role === 'admin'
        ? 'SELECT id FROM tasks WHERE id = ?'
        : `SELECT t.id FROM tasks t
           JOIN task_assignments ta ON t.id = ta.task_id
           WHERE t.id = ? AND ta.user_id = ? AND t.visible = 1`,
      req.user.role === 'admin' ? [taskId] : [taskId, userId]
    );
    if (!taskRows.length) return res.status(404).json({ error: 'Task not found' });

    // Only admin can reply (set parent_id). Users always post top-level.
    let parentIdVal = null;
    let repliedToUserId = null;
    if (parentId != null) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can reply to a comment' });
      }
      const [parentRows] = await pool.query(
        'SELECT id, user_id FROM comments WHERE id = ? AND task_id = ?',
        [parentId, taskId]
      );
      if (!parentRows.length) return res.status(400).json({ error: 'Parent comment not found' });
      parentIdVal = parentId;
      repliedToUserId = parentRows[0].user_id;
    }

    const [result] = await pool.query(
      'INSERT INTO comments (task_id, user_id, parent_id, body) VALUES (?, ?, ?, ?)',
      [taskId, userId, parentIdVal, body.trim()]
    );

    const [comment] = await pool.query(
      `SELECT c.*, u.name as user_name, u.role as user_role
       FROM comments c JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [result.insertId]
    );
    const io = req.app.get('io');
    if (io) {
      io.emit('task:detail', { taskId });
      // Also refresh task list so unread badges/counts update in real time
      io.emit('task:list');
    }

    // When admin posts any comment, notify all assigned users so they open the app
    if (req.user.role === 'admin') {
      const [assigned] = await pool.query(
        'SELECT user_id FROM task_assignments WHERE task_id = ?',
        [taskId]
      );
      const assignedIds = assigned.map((r) => r.user_id);
      if (assignedIds.length) {
        const [taskRow] = await pool.query('SELECT title FROM tasks WHERE id = ?', [taskId]);
        const title = (taskRow[0]?.title || 'Task').slice(0, 80);
        await notifyUserIds(
          pool,
          assignedIds,
          `💬 <b>Admin left a comment on "${title}" task.</b>\n\nOpen the app to view.`
        );
      }
    }

    // When a user comments, notify admin(s). If an admin is online (connected via Socket.IO),
    // we rely on in-app unread indicators only; otherwise, send Telegram.
    if (req.user.role === 'user') {
      const io = req.app.get('io');
      let adminOnline = false;
      if (io?.sockets?.adapter?.rooms) {
        const adminRoom = io.sockets.adapter.rooms.get('admin');
        adminOnline = !!adminRoom && adminRoom.size > 0;
      }

      if (!adminOnline) {
        const [admins] = await pool.query(
          'SELECT id FROM users WHERE role = ? AND active = 1',
          ['admin']
        );
        const adminIds = admins.map((r) => r.id);
        if (adminIds.length) {
          const [taskRow] = await pool.query('SELECT title FROM tasks WHERE id = ?', [taskId]);
          const title = (taskRow[0]?.title || 'Task').slice(0, 80);
          const preview = body.trim().slice(0, 80) + (body.trim().length > 80 ? '…' : '');
          await notifyUserIds(
            pool,
            adminIds,
            `💬 <b>New comment on \"${title}\"</b>\n\n${preview}\n\nOpen the app to review.`
          );
        }
      }
    }
    res.status(201).json(comment[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Edit comment: author or admin
router.patch('/:commentId', async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;
    const { body } = req.body;
    const { id: userId } = req.user;

    if (!body?.trim()) {
      return res.status(400).json({ error: 'Comment body is required' });
    }

    const [commentRows] = await pool.query(
      'SELECT id, user_id FROM comments WHERE id = ? AND task_id = ?',
      [commentId, taskId]
    );
    if (!commentRows.length) return res.status(404).json({ error: 'Comment not found' });
    const isAdmin = req.user.role === 'admin';
    const isAuthor = commentRows[0].user_id === userId;
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: 'You can only edit your own comment' });
    }

    await pool.query('UPDATE comments SET body = ? WHERE id = ?', [body.trim(), commentId]);

    const [comment] = await pool.query(
      `SELECT c.*, u.name as user_name, u.role as user_role
       FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
      [commentId]
    );
    const io = req.app.get('io');
    if (io) io.emit('task:detail', { taskId });
    res.json(comment[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

export default router;
