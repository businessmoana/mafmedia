import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../api/client';

function formatDate(str) {
  const d = new Date(str);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { user } = useAuth();
  const socket = useSocket();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const fetchTasks = useCallback(() => {
    api.tasks
      .list()
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!socket) return;
    const onTaskList = () => {
      setLoading(false);
      api.tasks.list().then(setTasks).catch((e) => setError(e.message));
    };
    socket.on('task:list', onTaskList);
    return () => socket.off('task:list', onTaskList);
  }, [socket]);

  const handleToggleVisible = async (e, task) => {
    e.preventDefault();
    e.stopPropagation();
    if (updatingId) return;
    setUpdatingId(task.id);
    try {
      await api.tasks.update(task.id, { visible: !task.visible });
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, visible: !t.visible } : t))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleMarkComplete = async (e, task) => {
    e.preventDefault();
    e.stopPropagation();
    if (updatingId) return;
    setUpdatingId(task.id);
    try {
      await api.tasks.update(task.id, { completed: true });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed_at: new Date().toISOString() } : t
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3">
        {error}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          {user?.role === 'admin' ? 'All Tasks' : 'My Tasks'}
        </h1>
        <p className="mt-1.5 text-slate-500 text-sm">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} · Newest first
          {(() => {
            const unreadTasks = tasks.filter((t) => t.unread);
            const totalUnread = unreadTasks.reduce((sum, t) => sum + (t.unread_comment_count || 0), 0);
            if (unreadTasks.length === 0) return null;
            return (
              <span className="ml-2 text-brand-400 font-medium">
                · {unreadTasks.length} with unread {totalUnread > 0 ? `(${totalUnread} comment${totalUnread !== 1 ? 's' : ''})` : ''}
              </span>
            );
          })()}
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-16 text-center shadow-card">
          <p className="text-slate-500">No tasks yet.</p>
          {user?.role === 'admin' && (
            <Link
              to="/create"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-all duration-200 shadow-sm hover:shadow-glow"
            >
              Create first task
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {tasks.map((task) => (
            <li key={task.id}>
              <div className={`rounded-2xl border p-5 sm:p-6 shadow-card transition-all duration-200 ${
                task.unread ? 'border-brand-500/50 bg-brand-500/5 hover:border-brand-500/70' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:shadow-card-hover'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <Link to={`/task/${task.id}`} className="min-w-0 flex-1 group">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-white group-hover:text-brand-400 transition-colors truncate">
                        {task.title}
                      </h2>
                      {(task.unread || task.is_new) && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/20 px-2.5 py-1 text-xs font-semibold text-brand-300 ring-1 ring-brand-500/30 shrink-0">
                          <span className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" aria-hidden />
                          {task.is_new ? 'New task' : (task.unread_comment_count > 0 ? `${task.unread_comment_count} unread comment${task.unread_comment_count !== 1 ? 's' : ''}` : 'Unread')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-slate-500 text-sm line-clamp-2">{task.content_body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {task.completed_at && (
                        <span className="inline-flex items-center rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                          Completed
                        </span>
                      )}
                      {user?.role === 'admin' && (
                        <>
                          {!task.visible && (
                            <span className="inline-flex items-center rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400 ring-1 ring-amber-500/20">
                              Hidden
                            </span>
                          )}
                          {task.assigned_count != null && (
                            <span className="inline-flex items-center rounded-lg bg-slate-700/50 px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-600">
                              {task.assigned_count} assigned
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 sm:shrink-0 flex-wrap sm:flex-nowrap">
                    <span className="text-slate-500 text-sm">{formatDate(task.created_at)}</span>
                    {user?.role === 'admin' && (
                      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleVisible(e, task)}
                          disabled={updatingId === task.id}
                          className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                            task.visible
                              ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 ring-1 ring-amber-500/20'
                              : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 ring-1 ring-emerald-500/20'
                          }`}
                        >
                          {updatingId === task.id ? '…' : task.visible ? 'Hide' : 'Show'}
                        </button>
                        {!task.completed_at && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkComplete(e, task)}
                            disabled={updatingId === task.id}
                            className="rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-all duration-200 disabled:opacity-50 shadow-sm"
                          >
                            {updatingId === task.id ? '…' : 'Complete'}
                          </button>
                        )}
                        <Link
                          to={`/task/${task.id}`}
                          className="rounded-xl border border-slate-600 px-3.5 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
                        >
                          Open
                        </Link>
                      </div>
                    )}
                    {user?.role !== 'admin' && (
                      <Link
                        to={`/task/${task.id}`}
                        className="rounded-xl border border-slate-600 px-3.5 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
                      >
                        Open →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
