import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.users
      .list()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

  const regularUsers = users.filter((u) => u.role === 'user');
  const admins = users.filter((u) => u.role === 'admin');

  const toggleActive = async (u) => {
    try {
      await api.users.setActive(u.id, !u.active);
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, active: !u.active } : x))
      );
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const setRole = async (u, newRole) => {
    if (u.id === currentUser?.id) return;
    try {
      await api.users.setRole(u.id, newRole);
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, role: newRole } : x))
      );
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-2">Users</h1>
      <p className="text-slate-500 text-sm mb-8">
        {regularUsers.length} website partner{regularUsers.length !== 1 ? 's' : ''} · {admins.length} admin{admins.length !== 1 ? 's' : ''}
      </p>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/30">
                <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold text-slate-400">Name</th>
                <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold text-slate-400">Source</th>
                <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold text-slate-400">Status</th>
                <th className="text-left py-4 px-4 sm:px-6 text-sm font-semibold text-slate-400">Role</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((u) => (
                <tr key={u.id} className="border-b border-slate-800/80 hover:bg-slate-800/20 transition-colors">
                  <td className="py-4 px-4 sm:px-6 text-white font-medium">{u.name}</td>
                  <td className="py-4 px-4 sm:px-6 text-slate-400 text-sm">{u.telegram_user_id === 'dev-admin' ? 'Browser (dev)' : 'Telegram'}</td>
                  <td className="py-4 px-4 sm:px-6 text-slate-400 text-sm">
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium ${
                        u.active
                          ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700'
                      }`}
                    >
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-lg bg-brand-500/15 px-2.5 py-1 text-xs font-medium text-brand-400 ring-1 ring-brand-500/20">
                        Admin
                      </span>
                      {u.id !== currentUser?.id && admins.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setRole(u, 'user')}
                          className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                          Make user
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {regularUsers.map((u) => (
                <tr key={u.id} className="border-b border-slate-800/80 last:border-0 hover:bg-slate-800/20 transition-colors">
                  <td className="py-4 px-4 sm:px-6 text-white font-medium">{u.name}</td>
                  <td className="py-4 px-4 sm:px-6 text-slate-400 text-sm">{u.telegram_user_id === 'dev-admin' ? 'Browser (dev)' : 'Telegram'}</td>
                  <td className="py-4 px-4 sm:px-6 text-slate-400 text-sm">
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium ${
                        u.active
                          ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700'
                      }`}
                    >
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded-lg bg-slate-700/50 px-2.5 py-1 text-xs font-medium text-slate-400 ring-1 ring-slate-600">
                        User
                      </span>
                      <button
                        type="button"
                        onClick={() => setRole(u, 'admin')}
                        className="rounded-lg border border-brand-500/50 px-2.5 py-1 text-xs font-medium text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 transition-colors"
                      >
                        Make admin
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        className="rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
