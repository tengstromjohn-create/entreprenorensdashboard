import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-60 border-r border-gray-100">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 lg:hidden">
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex-1 lg:pl-60">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[#2D3436] hover:bg-[#F5F5F0] rounded-lg p-1.5 transition-colors"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold text-[#2D3436]">Grundat</span>
        </header>

        <main className="px-4 py-6 lg:px-8 lg:py-8 max-w-4xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
