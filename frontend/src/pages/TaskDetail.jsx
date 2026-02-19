import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../api/client';

function formatDateTime(str) {
  return new Date(str).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function Linkify({ text }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        part.match(urlRegex) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:text-brand-700 underline break-all"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
}

function CommentItem({
  c,
  isReply,
  task,
  user,
  isAdmin,
  editingCommentId,
  editBody,
  setEditBody,
  submitting,
  saveEditComment,
  cancelEditComment,
  startEditComment,
  formatDateTime,
  Linkify,
}) {
  return (
    <li
      className={`rounded-xl bg-slate-50 p-4 border border-slate-200 shadow-sm ${isReply ? 'ml-4 sm:ml-6 border-l-2 border-l-brand-500/50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <span className="font-medium text-slate-900">{c.user_name}</span>
        <div className="flex items-center gap-2">
          {c.user_role === 'admin' && (
            <span className="rounded px-2 py-0.5 text-xs font-medium bg-brand-500/20 text-brand-600">
              Admin
            </span>
          )}
          {isReply && (
            <span className="rounded px-2 py-0.5 text-xs font-medium bg-slate-300 text-slate-600">
              Reply
            </span>
          )}
          <span className="text-slate-500 text-sm">{formatDateTime(c.created_at)}</span>
          {(isAdmin || c.user_id === user?.id) && !task.completed_at && (
            editingCommentId === c.id ? null : (
              <button
                type="button"
                onClick={() => startEditComment(c)}
                className="text-slate-500 hover:text-brand-600 text-sm font-medium"
              >
                Edit
              </button>
            )
          )}
        </div>
      </div>
      {editingCommentId === c.id ? (
        <form onSubmit={saveEditComment} className="space-y-2">
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={3}
            className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3 py-2 text-slate-900 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 outline-none resize-none transition duration-200"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !editBody.trim()}
              className="rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-1.5 px-3 disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancelEditComment}
              className="rounded-lg border border-slate-300 text-slate-600 hover:text-slate-900 text-sm py-1.5 px-3"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="text-slate-700 text-sm whitespace-pre-wrap">
          <Linkify text={c.body} />
        </p>
      )}
    </li>
  );
}

function CommentThreadsAdmin({
  comments,
  task,
  user,
  replyEnabled,
  editingCommentId,
  editBody,
  setEditBody,
  submitting,
  saveEditComment,
  cancelEditComment,
  startEditComment,
  replyingToId,
  setReplyingToId,
  replyBody,
  setReplyBody,
  handleReply,
  formatDateTime,
  Linkify,
}) {
  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = comments.filter((c) => c.parent_id).reduce((acc, c) => {
    (acc[c.parent_id] = acc[c.parent_id] || []).push(c);
    return acc;
  }, {});

  return (
    <ul className="space-y-6">
      {topLevel.map((parent) => (
        <li key={parent.id} className="space-y-3">
          <CommentItem
            c={parent}
            isReply={false}
            task={task}
            user={user}
            isAdmin={true}
            editingCommentId={editingCommentId}
            editBody={editBody}
            setEditBody={setEditBody}
            submitting={submitting}
            saveEditComment={saveEditComment}
            cancelEditComment={cancelEditComment}
            startEditComment={startEditComment}
            formatDateTime={formatDateTime}
            Linkify={Linkify}
          />
          {repliesByParent[parent.id]?.map((reply) => (
            <CommentItem
              key={reply.id}
              c={reply}
              isReply={true}
              task={task}
              user={user}
              isAdmin={true}
              editingCommentId={editingCommentId}
              editBody={editBody}
              setEditBody={setEditBody}
              submitting={submitting}
              saveEditComment={saveEditComment}
              cancelEditComment={cancelEditComment}
              startEditComment={startEditComment}
              formatDateTime={formatDateTime}
              Linkify={Linkify}
            />
          ))}
          {replyEnabled && parent.user_role !== 'admin' && !task.completed_at && (
            <>
              {replyingToId === parent.id ? (
                <form
                  onSubmit={(e) => handleReply(e, parent.id)}
                  className="ml-4 sm:ml-6 rounded-xl bg-slate-50 p-3 border border-slate-200 space-y-2"
                >
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Reply to this user..."
                    rows={2}
                    className="w-full rounded-xl bg-slate-50 border border-slate-300 px-3 py-2 text-slate-900 text-sm placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 outline-none resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting || !replyBody.trim()}
                      className="rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium py-1.5 px-3 disabled:opacity-50"
                    >
                      Send reply
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReplyingToId(null); setReplyBody(''); }}
                      className="rounded-lg border border-slate-300 text-slate-600 hover:text-slate-900 text-sm py-1.5 px-3"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="ml-4 sm:ml-6">
                  <button
                    type="button"
                    onClick={() => setReplyingToId(parent.id)}
                    className="text-slate-500 hover:text-brand-600 text-sm font-medium"
                  >
                    Reply to {parent.user_name}
                  </button>
                </div>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function TaskDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [editingTask, setEditingTask] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContentBody, setEditContentBody] = useState('');
  const [editVisible, setEditVisible] = useState(true);
  const [editSelectAll, setEditSelectAll] = useState(false);
  const [editSelectedIds, setEditSelectedIds] = useState(new Set());
  const [allUsers, setAllUsers] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const fetchData = useCallback(() => {
    const promises = [api.tasks.get(id), api.comments.list(id)];
    if (user?.role === 'admin') promises.push(api.tasks.assignments(id));
    Promise.all(promises)
      .then((results) => {
        setTask(results[0]);
        setComments(results[1]);
        if (results[2]) setAssignedUsers(results[2]);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const socket = useSocket();
  useEffect(() => {
    if (!socket || !id) return;
    const onTaskDetail = (payload) => {
      if (Number(payload?.taskId) === Number(id)) {
        const promises = [api.tasks.get(id), api.comments.list(id)];
        if (user?.role === 'admin') promises.push(api.tasks.assignments(id));
        Promise.all(promises)
          .then((results) => {
            setTask(results[0]);
            setComments(results[1]);
            if (results[2]) setAssignedUsers(results[2]);
          })
          .catch(() => {});
      }
    };
    socket.on('task:detail', onTaskDetail);
    return () => socket.off('task:detail', onTaskDetail);
  }, [socket, id, user?.role]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      // If admin and 1 assigned user, auto-reply to their first comment
      let parentId = null;
      if (isAdmin && (assignedUsers?.length || 0) === 1) {
        // Find the first comment by the assigned user
        const userComment = comments.find(
          c => c.user_id === assignedUsers[0]?.id && !c.parent_id
        );
        if (userComment) {
          parentId = userComment.id;
        } else {
          setError('User must comment first before you can reply');
          setSubmitting(false);
          return;
        }
      }
      await api.comments.add(id, newComment.trim(), parentId);
      setNewComment('');
      setError('');
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (e, parentId) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.comments.add(id, replyBody.trim(), parentId);
      setReplyBody('');
      setReplyingToId(null);
      setError('');
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisible = async () => {
    if (!isAdmin) return;
    setUpdating(true);
    setError('');
    try {
      const updated = await api.tasks.update(id, { visible: !task.visible });
      setTask(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!isAdmin) return;
    setUpdating(true);
    setError('');
    try {
      const updated = await api.tasks.update(id, { completed: true });
      setTask(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const startEditComment = (c) => {
    setEditingCommentId(c.id);
    setEditBody(c.body);
    setError('');
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditBody('');
  };

  const saveEditComment = async (e) => {
    e.preventDefault();
    if (!editBody.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.comments.update(id, editingCommentId, editBody.trim());
      setEditingCommentId(null);
      setEditBody('');
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEditTask = () => {
    setEditTitle(task.title);
    setEditContentBody(task.content_body);
    setEditVisible(!!task.visible);
    const ids = (assignedUsers || []).map((u) => u.id);
    setEditSelectedIds(new Set(ids));
    api.users
      .list()
      .then((list) => {
        const users = list.filter((u) => u.role === 'user');
        setAllUsers(users);
        setEditSelectAll(users.length > 0 && ids.length === users.length);
      })
      .catch(() => {});
    setEditingTask(true);
  };

  const cancelEditTask = () => {
    setEditingTask(false);
  };

  const toggleEditUser = (uid) => {
    setEditSelectAll(false);
    setEditSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const saveEditTask = async (e) => {
    e.preventDefault();
    if (!editTitle.trim() || !editContentBody.trim()) return;
    const userIds = editSelectAll ? (allUsers || []).map((u) => u.id) : Array.from(editSelectedIds);
    setSubmitting(true);
    setError('');
    try {
      await Promise.all([
        api.tasks.update(id, { title: editTitle.trim(), content_body: editContentBody, visible: editVisible }),
        api.tasks.updateAssignments(id, userIds),
      ]);
      setEditingTask(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">
        {error}
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="animate-fade-in relative">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6">
        ← Back to tasks
      </Link>

      {error && (
        <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {isAdmin && (
        <>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-2 rounded-l-xl border border-r-0 border-slate-300 bg-white py-4 pl-4 pr-3 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-card transition-all duration-200"
            title="Assigned users"
          >
            <span className="hidden sm:inline">Assigned</span>
            <span className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-lg bg-slate-400 px-2 text-xs font-semibold text-white">
              {assignedUsers?.length ?? 0}
            </span>
          </button>

          {drawerOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/50 transition-opacity"
                onClick={() => setDrawerOpen(false)}
                aria-hidden
              />
              <aside
                className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col bg-white border-l border-slate-200 shadow-card-hover animate-slide-in-right scrollbar-thin"
                aria-label="Assigned users"
              >
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                  <h3 className="text-base font-semibold text-slate-900">Assigned to</h3>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="rounded-lg p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    aria-label="Close"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {assignedUsers?.length ? (
                    <ul className="space-y-2">
                      {assignedUsers.map((u) => (
                        <li
                          key={u.id}
                          className="flex flex-col rounded-xl bg-slate-50 px-3 py-2.5 border border-slate-200"
                        >
                          <span className="font-medium text-slate-800 text-sm">{u.name}</span>
                          <span className="text-xs text-slate-500 truncate mt-0.5" title={u.telegram_user_id === 'dev-admin' ? 'Browser (dev)' : 'Telegram'}>
                            {u.telegram_user_id === 'dev-admin' ? 'Browser (dev)' : 'Telegram'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No one assigned</p>
                  )}
                </div>
              </aside>
            </>
          )}
        </>
      )}

      <div className="max-w-2xl">
      <article className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-card">
        <div className="p-5 sm:p-6 border-b border-slate-200">
          {isAdmin && editingTask ? (
            <form onSubmit={saveEditTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Title</label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 outline-none transition duration-200"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Content</label>
                <textarea
                  value={editContentBody}
                  onChange={(e) => setEditContentBody(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 outline-none resize-none transition duration-200"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Assign to</label>
                {allUsers.length === 0 ? (
                  <p className="text-slate-500 text-sm">Loading users…</p>
                ) : (
                  <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editSelectAll}
                        onChange={(e) => {
                          setEditSelectAll(e.target.checked);
                          if (e.target.checked) setEditSelectedIds(new Set(allUsers.map((u) => u.id)));
                          else setEditSelectedIds(new Set());
                        }}
                        className="rounded border-slate-300 bg-slate-100 text-brand-500 focus:ring-brand-500"
                      />
                      <span className="font-medium text-slate-900">Select all ({allUsers.length})</span>
                    </label>
                    {!editSelectAll && (
                      <div className="pt-2 border-t border-slate-200 space-y-1.5">
                        {allUsers.map((u) => (
                          <label key={u.id} className="flex items-center gap-3 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={editSelectedIds.has(u.id)}
                              onChange={() => toggleEditUser(u.id)}
                              className="rounded border-slate-300 bg-slate-100 text-brand-500 focus:ring-brand-500"
                            />
                            <span className="text-slate-700">{u.name}</span>
                            <span className="text-slate-500 text-xs">({u.telegram_user_id === 'dev-admin' ? 'Browser (dev)' : 'Telegram'})</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editVisible}
                  onChange={(e) => setEditVisible(e.target.checked)}
                  className="rounded border-slate-300 bg-slate-100 text-brand-500 focus:ring-brand-500"
                />
                <span className="text-slate-700">Visible to assigned users</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2 px-4 disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEditTask}
                  className="rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 py-2 px-4 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="font-display text-xl sm:text-2xl font-semibold text-slate-900">{task.title}</h1>
                <div className="flex gap-2 flex-wrap">
                  {isAdmin && (
                    <>
                      {!task.completed_at && (
                        <button
                          type="button"
                          onClick={startEditTask}
                          className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200"
                        >
                          Edit task
                        </button>
                      )}
                      <button
                        onClick={handleToggleVisible}
                        disabled={updating}
                        className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                          task.visible ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 ring-1 ring-amber-500/20' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 ring-1 ring-emerald-500/20'
                        }`}
                      >
                        {task.visible ? 'Hide' : 'Show'}
                      </button>
                      {!task.completed_at && (
                        <button
                          onClick={handleMarkComplete}
                          disabled={updating}
                          className="rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-all duration-200 disabled:opacity-50 shadow-sm"
                        >
                          Mark complete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <p className="mt-3 text-slate-700 whitespace-pre-wrap">{task.content_body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-slate-500 text-sm">{formatDateTime(task.created_at)}</span>
                {task.completed_at && (
                  <span className="rounded px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400">
                    Completed
                  </span>
                )}
                {!task.visible && (
                  <span className="rounded px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400">
                    Hidden from users
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-5 sm:p-6">
          <h2 className="font-medium text-slate-900 mb-4">Comments</h2>
          {comments.length === 0 ? (
            <p className="text-slate-500 text-sm">No comments yet.</p>
          ) : isAdmin ? (
            <CommentThreadsAdmin
              comments={comments}
              task={task}
              user={user}
              replyEnabled={(assignedUsers?.length || 0) > 1}
              editingCommentId={editingCommentId}
              editBody={editBody}
              setEditBody={setEditBody}
              submitting={submitting}
              saveEditComment={saveEditComment}
              cancelEditComment={cancelEditComment}
              startEditComment={startEditComment}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              replyBody={replyBody}
              setReplyBody={setReplyBody}
              handleReply={handleReply}
              formatDateTime={formatDateTime}
              Linkify={Linkify}
            />
          ) : (
            <ul className="space-y-4">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  c={c}
                  isReply={!!c.parent_id}
                  task={task}
                  user={user}
                  isAdmin={false}
                  editingCommentId={editingCommentId}
                  editBody={editBody}
                  setEditBody={setEditBody}
                  submitting={submitting}
                  saveEditComment={saveEditComment}
                  cancelEditComment={cancelEditComment}
                  startEditComment={startEditComment}
                  formatDateTime={formatDateTime}
                  Linkify={Linkify}
                />
              ))}
            </ul>
          )}

          {!task.completed_at && (
            <>
              {/* Users can always post comments */}
              {!isAdmin && (
                <form onSubmit={handleAddComment} className="mt-6">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add your comment (e.g. link to published article)..."
                    rows={3}
                    className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 outline-none transition duration-200 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !newComment.trim()}
                    className="mt-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 px-4 text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {submitting ? 'Posting...' : 'Post comment'}
                  </button>
                </form>
              )}
              {/* Admin: only show comment form if 1 assigned user (auto-replies to their comment) */}
              {isAdmin && (assignedUsers?.length || 0) === 1 && (
                <form onSubmit={handleAddComment} className="mt-6">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={`Reply to ${assignedUsers[0]?.name || 'user'}...`}
                    rows={3}
                    className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 outline-none transition duration-200 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !newComment.trim()}
                    className="mt-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 px-4 text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {submitting ? 'Posting...' : 'Send reply'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </article>
      </div>
    </div>
  );
}
