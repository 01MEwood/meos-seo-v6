import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SkillsPage from './pages/SkillsPage.jsx';
import ContentPage from './pages/ContentPage.jsx';
import LlmPage from './pages/LlmPage.jsx';
import TimelinePage from './pages/TimelinePage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import AlertsPage from './pages/AlertsPage.jsx';
import TrackingPage from './pages/TrackingPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Laden...</div>;
  if (!user) return <Navigate to="/login" />;
  if (requiredRole === 'ADMIN' && user.role !== 'ADMIN') return <Navigate to="/" />;
  if (requiredRole === 'POWERUSER' && !['ADMIN', 'POWERUSER'].includes(user.role)) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="tracking" element={<ProtectedRoute requiredRole="POWERUSER"><TrackingPage /></ProtectedRoute>} />
            <Route path="llm" element={<ProtectedRoute requiredRole="POWERUSER"><LlmPage /></ProtectedRoute>} />
            <Route path="audit" element={<ProtectedRoute requiredRole="POWERUSER"><AuditPage /></ProtectedRoute>} />
            <Route path="timeline" element={<ProtectedRoute requiredRole="POWERUSER"><TimelinePage /></ProtectedRoute>} />
            <Route path="alerts" element={<ProtectedRoute requiredRole="POWERUSER"><AlertsPage /></ProtectedRoute>} />
            <Route path="skills" element={<ProtectedRoute requiredRole="ADMIN"><SkillsPage /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute requiredRole="ADMIN"><UsersPage /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute requiredRole="ADMIN"><SettingsPage /></ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
