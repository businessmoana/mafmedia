import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function OpenInTelegram() {
  const { user, loading } = useAuth();

  // If user is already authenticated (e.g. Telegram auth just finished), go straight to dashboard
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/20 text-brand-600 text-xl font-bold mb-4">M</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Media CRM</h1>
        <p className="mt-4 text-slate-700">
          Open this app from the Telegram bot to continue.
        </p>
        <p className="mt-2 text-slate-500 text-sm">
          No login required — you’ll be signed in automatically with your Telegram account.
        </p>
      </div>
    </div>
  );
}
