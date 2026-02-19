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

    // User sees: (1) own comments, (2) admin replies to their comments, (3) top-level admin comments if task has only 1 assigned user
    const taskIdNum = parseInt(taskId, 10);
    const userIdNum = parseInt(userId, 10);
    
    // Check if task has exactly 1 assigned user (this user)
    const [assignedCheck] = await pool.query(
      'SELECT COUNT(*) as count FROM task_assignments WHERE task_id = ?',
      [taskIdNum]
    );
    const isSingleUserTask = assignedCheck[0]?.count === 1;
    
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
           OR (
             ? = 1
             AND u.role = 'admin'
             AND c.parent_id IS NULL
           )
         )
       ORDER BY COALESCE(c.parent_id, c.id), c.created_at ASC`,
      [taskIdNum, userIdNum, userIdNum, isSingleUserTask ? 1 : 0]
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

    // Admin can post top-level comments or reply. Users always post top-level.
    let parentIdVal = null;
    let repliedToUserId = null;
    
    if (req.user.role === 'admin') {
      if (parentId == null) {
        // Check if task has exactly 1 assigned user - auto-reply to their first comment if it exists
        const [assignedRows] = await pool.query(
          'SELECT user_id FROM task_assignments WHERE task_id = ?',
          [taskId]
        );
        if (assignedRows.length === 1) {
          // Find the first comment by this user
          const [userCommentRows] = await pool.query(
            'SELECT id FROM comments WHERE task_id = ? AND user_id = ? AND parent_id IS NULL ORDER BY created_at ASC LIMIT 1',
            [taskId, assignedRows[0].user_id]
          );
          if (userCommentRows.length) {
            // User has commented - auto-reply to their first comment
            parentIdVal = userCommentRows[0].id;
            repliedToUserId = assignedRows[0].user_id;
          } else {
            // User hasn't commented yet - admin can post top-level comment to initiate conversation
            parentIdVal = null;
            repliedToUserId = assignedRows[0].user_id;
          }
        } else if (assignedRows.length > 1) {
          // Multiple users - notify all assigned users if no parent_id specified
          // If parent_id is specified, only notify that specific user (handled below)
          if (parentId == null) {
            // Admin posting top-level comment to multiple users - notify all
            repliedToUserId = assignedRows.map(r => r.user_id);
          }
          // If parent_id is provided, repliedToUserId will be set below
        }
        // If no assigned users, admin can still post top-level comment (parentIdVal stays null)
      } else {
        // Admin explicitly replying to a comment
        const [parentRows] = await pool.query(
          'SELECT id, user_id FROM comments WHERE id = ? AND task_id = ?',
          [parentId, taskId]
        );
        if (!parentRows.length) return res.status(400).json({ error: 'Parent comment not found' });
        parentIdVal = parentId;
        repliedToUserId = parentRows[0].user_id;
      }
    } else {
      // Users always post top-level (no parent_id)
      if (parentId != null) {
        return res.status(403).json({ error: 'Users cannot reply to comments' });
      }
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

    // When admin comments/replies, notify the assigned user(s)
    if (req.user.role === 'admin') {
      const [taskRow] = await pool.query('SELECT title FROM tasks WHERE id = ?', [taskId]);
      const title = (taskRow[0]?.title || 'Task').slice(0, 80);
      
      let userIdsToNotify = [];
      if (repliedToUserId) {
        // Specific user to notify (from reply or single assigned user)
        userIdsToNotify = Array.isArray(repliedToUserId) ? repliedToUserId : [repliedToUserId];
      } else {
        // Fallback: get all assigned users if repliedToUserId wasn't set
        const [assignedRows] = await pool.query(
          'SELECT user_id FROM task_assignments WHERE task_id = ?',
          [taskId]
        );
        userIdsToNotify = assignedRows.map(r => r.user_id);
      }
      
      if (userIdsToNotify.length > 0) {
        const message = parentIdVal
          ? `💬 <b>Admin replied to your comment on "${title}" task.</b>\n\nOpen the app to view.`
          : `💬 <b>Admin posted a comment on "${title}" task.</b>\n\nOpen the app to view.`;
        notifyUserIds(pool, userIdsToNotify, message);
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
