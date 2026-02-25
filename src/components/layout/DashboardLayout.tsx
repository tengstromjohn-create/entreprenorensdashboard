import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useAppAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { trustLevel } = useAppAuth()

  return (
    <div className="min-h-screen bg-background">
      <Header onToggleSidebar={() => setSidebarOpen(true)} />

      {/* Pending verification banner */}
      {trustLevel === 'pending_manual' && (
        <div className="border-b bg-orange-50 px-4 py-2 text-center text-sm text-orange-800">
          <Badge variant="outline" className="mr-2 border-orange-300 bg-orange-100 text-orange-800">
            Väntar på verifiering
          </Badge>
          Ditt konto granskas. Vissa funktioner kan vara begränsade tills verifieringen är klar.
        </div>
      )}

      <div className="mx-auto flex max-w-7xl">
        {/* Desktop sidebar */}
        <Sidebar className="hidden lg:flex w-60 shrink-0 border-r bg-sidebar min-h-[calc(100vh-3.5rem)] sticky top-14" />

        {/* Mobile sidebar */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-60 p-0 bg-sidebar">
            <Sidebar onNavigate={() => setSidebarOpen(false)} className="pt-6" />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 py-6 lg:px-8">
          <Outlet />
        </main>

        {/* Right panel (desktop only) */}
        <aside className="hidden xl:block w-70 shrink-0 border-l p-4 min-h-[calc(100vh-3.5rem)]">
          <div className="sticky top-18">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Snabbåtgärder
            </h3>
            <div className="space-y-2">
              <a
                href="https://johntengstrom.se/boka"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border bg-secondary/50 p-3 text-sm hover:bg-secondary transition-colors"
              >
                <span className="font-medium">Boka rådgivning</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  30 min kostnadsfri konsultation
                </p>
              </a>
              {/* TODO: ED-3 — Add more contextual actions based on current page */}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
