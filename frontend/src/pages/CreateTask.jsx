import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function CreateTask() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState('');
  const [content_body, setContentBody] = useState('');
  const [visible, setVisible] = useState(true);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.users
      .list()
      .then((list) => {
        setUsers(list.filter((u) => u.role === 'user'));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (selectAll) {
      setSelectedIds(new Set(users.map((u) => u.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [selectAll, users]);

  const toggleUser = (id) => {
    setSelectAll(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content_body.trim()) {
      setError('Title and content are required');
      return;
    }
    if (users.length === 0) {
      setError('No users yet. Partners will appear here once they open the app from the Telegram bot or register.');
      return;
    }
    if (!selectAll && selectedIds.size === 0) {
      setError('Select at least one user or use "Select all"');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const task = await api.tasks.create({
        title: title.trim(),
        content_body: content_body.trim(),
        visible,
        user_ids: selectAll ? users.map((u) => u.id) : Array.from(selectedIds),
      });
      navigate(`/task/${task.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-2">Create Task</h1>
      <p className="text-slate-500 text-sm mb-8">Assign a publication task to website partners.</p>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-slate-600 mb-2">Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 outline-none transition duration-200"
            placeholder="Task title"
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-slate-600 mb-2">Content / Instructions</label>
          <textarea
            id="content"
            value={content_body}
            onChange={(e) => setContentBody(e.target.value)}
            required
            rows={6}
            className="w-full rounded-xl bg-slate-50 border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 outline-none transition duration-200 resize-none"
            placeholder="Full text, instructions, requirements..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-3">Assign to</label>
          {users.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">No users yet. Partners will appear when they open the app from the Telegram bot or register below.</p>
          ) : (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 space-y-3 max-h-64 overflow-y-auto scrollbar-thin">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={(e) => setSelectAll(e.target.checked)}
                className="rounded border-slate-300 bg-slate-100 text-brand-500 focus:ring-brand-500"
              />
              <span className="font-medium text-slate-900 group-hover:text-brand-500 transition-colors">
                Select all ({users.length} users)
              </span>
            </label>
            {!selectAll && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="rounded border-slate-300 bg-slate-100 text-brand-500 focus:ring-brand-500"
                    />
                    <span className="text-slate-700 group-hover:text-slate-900">
                      {u.name}
                      <span className="text-slate-500 text-sm ml-1">({u.telegram_user_id === 'dev-admin' ? 'Browser (dev)' : 'Telegram'})</span>
                    </span>
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
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="rounded border-slate-300 bg-slate-100 text-brand-500 focus:ring-brand-500"
          />
          <span className="text-slate-700">Visible to assigned users</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || users.length === 0}
            className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3.5 px-6 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-glow"
          >
            {loading ? 'Creating...' : 'Create Task'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-xl border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-6 py-3.5 font-medium transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
