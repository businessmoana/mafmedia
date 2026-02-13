import { Link } from 'react-router-dom';

export default function AccountDeactivated() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/15 text-red-400 text-xl font-bold mb-4">
          !
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Access disabled
        </h1>
        <p className="mt-4 text-slate-300">
          Your account has been deactivated by the administrator.
        </p>
        <p className="mt-2 text-slate-500 text-sm">
          Please contact the admin if you think this is a mistake.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
        >
          Back to start
        </Link>
      </div>
    </div>
  );
}

