import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import OpenInTelegram from './pages/OpenInTelegram';
import AccountDeactivated from './pages/AccountDeactivated';
import Dashboard from './pages/Dashboard';
import TaskDetail from './pages/TaskDetail';
import CreateTask from './pages/CreateTask';
import Users from './pages/Users';

function ProtectedRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/open-in-telegram" replace />;
  if (user && user.active === false) return <Navigate to="/deactivated" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/open-in-telegram" element={<OpenInTelegram />} />
      <Route path="/deactivated" element={<AccountDeactivated />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="task/:id" element={<TaskDetail />} />
        <Route
          path="create"
          element={
            <ProtectedRoute adminOnly>
              <CreateTask />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute adminOnly>
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
