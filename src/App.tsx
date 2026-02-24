import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Welcome } from '@/pages/Welcome';
import { AuthCallback } from '@/pages/AuthCallback';
import { Dashboard } from '@/pages/Dashboard';
import { Bolag } from '@/pages/Bolag';
import { Verktyg } from '@/pages/Verktyg';
import { StartupKit } from '@/pages/StartupKit';
import { HealthCheck } from '@/pages/HealthCheck';
import { Utveckling } from '@/pages/Utveckling';
import { Installningar } from '@/pages/Installningar';
import { Admin } from '@/pages/Admin';

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAppAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Laddar...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Welcome />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="bolag" element={<Bolag />} />
          <Route path="verktyg" element={<Verktyg />} />
          <Route path="verktyg/startup-kit" element={<StartupKit />} />
          <Route path="verktyg/health-check" element={<HealthCheck />} />
          <Route path="utveckling" element={<Utveckling />} />
          <Route path="installningar" element={<Installningar />} />
        </Route>
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Admin />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
