import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import LoginScreen from './components/LoginScreen';
import LoadingScreen from './components/LoadingScreen';
import { useAuth } from './context/useAuth';
import AdminPage from './pages/AdminPage';
import DashboardPage from './pages/DashboardPage';
import JobsPage from './pages/JobsPage';
import NewJobPage from './pages/NewJobPage';
import type { ReactNode } from 'react';

function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  const { config, loading, user } = useAuth();

  if (loading) {
    return <LoadingScreen label={`Loading ${config.appName}`} />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/new" element={<NewJobPage />} />
        <Route
          path="/admin"
          element={
            <AdminOnlyRoute>
              <AdminPage />
            </AdminOnlyRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
