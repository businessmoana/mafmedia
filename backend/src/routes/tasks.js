import express from 'express';
import pool from '../config/db.js';
import { notifyUserIds } from '../lib/telegram.js';

const router = express.Router();

// Get tasks: admin sees all; user sees assigned + visible only. Ordered by date DESC. Includes unread/is_new.
router.get('/', async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    if (role === 'admin') {
      const [rows] = await pool.query(
        `SELECT t.*, u.name as admin_name,
         (SELECT COUNT(*) FROM task_assignments WHERE task_id = t.id) as assigned_count,
         trs.last_read_at,
         (SELECT MAX(created_at) FROM comments WHERE task_id = t.id) as latest_comment_at,
         (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id AND (trs.last_read_at IS NULL OR c.created_at > trs.last_read_at)) as unread_comment_count
         FROM tasks t
         JOIN users u ON t.admin_id = u.id
         LEFT JOIN task_read_state trs ON trs.task_id = t.id AND trs.user_id = ?
         ORDER BY t.created_at DESC`,
        [userId]
      );
      const tasks = rows.map((t) => addUnreadFlags(t));
      return res.json(tasks);
    }

    const [rows] = await pool.query(
      `SELECT t.*, u.name as admin_name,
       trs.last_read_at,
       (SELECT MAX(created_at) FROM comments WHERE task_id = t.id) as latest_comment_at,
       (SELECT COUNT(*) FROM comments c WHERE c.task_id = t.id AND (trs.last_read_at IS NULL OR c.created_at > trs.last_read_at)) as unread_comment_count
       FROM tasks t
       JOIN task_assignments ta ON t.id = ta.task_id
       JOIN users u ON t.admin_id = u.id
       LEFT JOIN task_read_state trs ON trs.task_id = t.id AND trs.user_id = ?
       WHERE ta.user_id = ? AND t.visible = 1
       ORDER BY t.created_at DESC`,
      [userId, userId]
    );
    const tasks = rows.map((t) => addUnreadFlags(t));
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

function addUnreadFlags(row) {
  const { last_read_at, latest_comment_at, unread_comment_count: rawCount, ...task } = row;
  // Only treat initial creation + new comments as activity for unread,
  // ignore admin-only metadata edits (like hide/show) which bump updated_at.
  const baseTime = task.created_at || task.updated_at;
  const latestActivity = latest_comment_at
    ? new Date(latest_comment_at > baseTime ? latest_comment_at : baseTime)
    : new Date(baseTime);
  const lastRead = last_read_at ? new Date(last_read_at) : null;
  const is_new = !lastRead;
  const unread = !lastRead || latestActivity > lastRead;
  const unread_comment_count = Number(rawCount) || 0;
  return { ...task, unread: !!unread, is_new: !!is_new, unread_comment_count };
}

// Get single task (admin: any; user: must be assigned + visible). Marks task as read for this user.
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    if (role === 'admin') {
      const [rows] = await pool.query(
        `SELECT t.*, u.name as admin_name FROM tasks t
         JOIN users u ON t.admin_id = u.id WHERE t.id = ?`,
        [id]
      );
      if (!rows.length) return res.status(404).json({ error: 'Task not found' });
      await pool.query(
        'INSERT INTO task_read_state (user_id, task_id, last_read_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE last_read_at = NOW()',
        [userId, id]
      );
      return res.json(rows[0]);
    }

    const [rows] = await pool.query(
      `SELECT t.*, u.name as admin_name FROM tasks t
       JOIN task_assignments ta ON t.id = ta.task_id
       JOIN users u ON t.admin_id = u.id
       WHERE t.id = ? AND ta.user_id = ? AND t.visible = 1`,
      [id, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Task not found' });
    await pool.query(
      'INSERT INTO task_read_state (user_id, task_id, last_read_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE last_read_at = NOW()',
      [userId, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Admin: create task
router.post('/', async (req, res) => {
  try {
    const { title, content_body, visible = true, user_ids } = req.body;
    if (!title || !content_body) {
      return res.status(400).json({ error: 'Title and content_body are required' });
    }

    const [taskResult] = await pool.query(
      'INSERT INTO tasks (admin_id, title, content_body, visible) VALUES (?, ?, ?, ?)',
      [req.user.id, title, content_body, !!visible]
    );
    const taskId = taskResult.insertId;

    const ids = Array.isArray(user_ids) ? user_ids : [];
    if (ids.length) {
      const values = ids.map((uid) => [taskId, uid]);
      await pool.query(
        'INSERT INTO task_assignments (task_id, user_id) VALUES ?',
        [values]
      );
      // Send notifications to assigned users
      try {
        const taskTitle = title.slice(0, 80);
        console.log(`Task created: "${taskTitle}", notifying ${ids.length} user(s):`, ids);
        await notifyUserIds(
          pool,
          ids,
          `📋 <b>New task: "${taskTitle}"</b>\n\nOpen the app to view.`
        );
      } catch (notifyErr) {
        // Log notification errors but don't fail task creation
        console.error('Failed to send task creation notifications:', notifyErr);
      }
    }

    const [task] = await pool.query(
      'SELECT * FROM tasks WHERE id = ?',
      [taskId]
    );
    const io = req.app.get('io');
    if (io) {
      io.emit('task:list');
      io.emit('task:detail', { taskId });
    }
    res.status(201).json(task[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Admin: update task (visible, complete, title, content_body)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { visible, completed, title, content_body } = req.body;

    const [existing] = await pool.query('SELECT id, completed_at FROM tasks WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Task not found' });

    const updates = [];
    const params = [];
    if (existing[0].completed_at) {
      // Completed: only allow visibility toggle, not content/title/completed flag.
      if (typeof visible === 'boolean') {
        updates.push('visible = ?');
        params.push(visible);
      }
    } else {
      if (typeof visible === 'boolean') {
        updates.push('visible = ?');
        params.push(visible);
      }
      if (typeof completed === 'boolean') {
        updates.push('completed_at = ?');
        params.push(completed ? new Date() : null);
      }
    }
    let completedTaskUserIds = [];
    if (!existing[0].completed_at) {
      // Only when transitioning to completed do we notify users.
      if (typeof completed === 'boolean' && completed) {
        const [assigned] = await pool.query('SELECT user_id FROM task_assignments WHERE task_id = ?', [id]);
        completedTaskUserIds = assigned.map((r) => r.user_id);
      }
      // Title/content are editable only before completion.
      if (typeof title === 'string' && title.trim()) {
        updates.push('title = ?');
        params.push(title.trim());
      }
      if (typeof content_body === 'string') {
        updates.push('content_body = ?');
        params.push(content_body);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No valid updates' });

    params.push(id);
    await pool.query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    const [task] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
    const io = req.app.get('io');
    if (io) {
      io.emit('task:list');
      io.emit('task:detail', { taskId: id });
    }
    if (completedTaskUserIds.length) {
      await notifyUserIds(
        pool,
        completedTaskUserIds,
        `✅ <b>Task completed</b>\n\n${task[0]?.title || 'Task'} has been marked as done.`
      );
    }
    res.json(task[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Admin: update task assignments
router.put('/:id/assignments', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_ids } = req.body;

    const [existing] = await pool.query('SELECT id, completed_at FROM tasks WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Task not found' });
    if (existing[0].completed_at) {
      return res.status(400).json({ error: 'Completed tasks cannot be edited' });
    }

    await pool.query('DELETE FROM task_assignments WHERE task_id = ?', [id]);

    const ids = Array.isArray(user_ids) ? user_ids : [];
    if (ids.length) {
      const values = ids.map((uid) => [parseInt(id), uid]);
      await pool.query(
        'INSERT INTO task_assignments (task_id, user_id) VALUES ?',
        [values]
      );
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('task:list');
      io.emit('task:detail', { taskId: id });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update assignments' });
  }
});

export default router;
