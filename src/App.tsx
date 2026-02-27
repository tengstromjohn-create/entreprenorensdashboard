import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Welcome } from '@/pages/Welcome'
import { AuthCallback } from '@/pages/AuthCallback'
import { DashboardHome } from '@/components/dashboard/DashboardHome'
import { CompanyZone } from '@/components/dashboard/CompanyZone'
import { ToolsZone } from '@/components/dashboard/ToolsZone'
import { DevelopmentZone } from '@/components/dashboard/DevelopmentZone'
import { SettingsPage } from '@/components/dashboard/SettingsPage'
import { StartupKit } from '@/pages/StartupKit'
import { HealthCheck } from '@/pages/HealthCheck'
import { Admin } from '@/pages/Admin'

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAFAF8]">
        <div className="text-center">
          <h1 className="text-lg font-bold text-[#2D3436]">Grundat</h1>
          <p className="text-sm text-gray-400 mt-1">Laddar...</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Welcome />
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
          <Route index element={<DashboardHome />} />
          <Route path="bolag" element={<CompanyZone />} />
          <Route path="verktyg" element={<ToolsZone />} />
          <Route path="verktyg/startup-kit" element={<StartupKit />} />
          <Route path="verktyg/health-check" element={<HealthCheck />} />
          <Route path="verktyg/readiness-check" element={
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-[#2D3436]">Readiness Check</h1>
              <div className="bg-[#F5F5F0] rounded-lg p-8 text-center">
                <p className="text-gray-500">Readiness Check — kommer snart</p>
              </div>
            </div>
          } />
          <Route path="verktyg/checklistor" element={
            <div className="space-y-4">
              <h1 className="text-xl font-bold text-[#2D3436]">Checklistor & Mallar</h1>
              <div className="bg-[#F5F5F0] rounded-lg p-8 text-center">
                <p className="text-gray-500">Checklistor — kommer snart</p>
              </div>
            </div>
          } />
          <Route path="utveckling" element={<DevelopmentZone />} />
          <Route path="installningar" element={<SettingsPage />} />
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
  )
}

export default App
