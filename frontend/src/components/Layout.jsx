import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, isTelegramApp } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/open-in-telegram');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-4">
            <NavLink
              to="/"
              className="font-display font-semibold text-lg tracking-tight text-slate-900 hover:text-brand-500 transition-colors flex items-center gap-2"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/20 text-brand-400 text-sm font-bold">M</span>
              Media CRM
            </NavLink>

            <nav className="flex items-center gap-0.5 sm:gap-1">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-slate-200 text-brand-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`
                }
              >
                Tasks
              </NavLink>
              {user?.role === 'admin' && (
                <>
                  <NavLink
                    to="/create"
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-slate-200 text-brand-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`
                    }
                  >
                    New Task
                  </NavLink>
                  <NavLink
                    to="/users"
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-slate-200 text-brand-600 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`
                    }
                  >
                    Users
                  </NavLink>
                </>
              )}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden sm:inline text-sm text-slate-600 truncate max-w-[140px]">
                {user?.name}
                {user?.telegram_user_id === 'dev-admin' ? (
                  <span className="ml-1 text-slate-500 text-xs">(Dev)</span>
                ) : (
                  <span className="ml-1 text-slate-500 text-xs">(Telegram)</span>
                )}
              </span>
              <span className={`hidden sm:inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${user?.role === 'admin' ? 'bg-brand-500/15 text-brand-600 ring-1 ring-brand-500/20' : 'bg-slate-200 text-slate-600 ring-1 ring-slate-300'}`}>
                {user?.role === 'admin' ? 'Admin' : 'User'}
              </span>
              {!isTelegramApp && (
                <button
                  onClick={handleLogout}
                  className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors duration-200"
                >
                  Log out
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
