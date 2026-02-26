import { NavLink } from 'react-router-dom'
import { Home, Building2, Wrench, BookOpen, Settings, Calendar, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { TrustBadge } from '@/components/shared/TrustBadge'

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Hem', end: true },
  { to: '/dashboard/bolag', icon: Building2, label: 'Mitt bolag' },
  { to: '/dashboard/verktyg', icon: Wrench, label: 'Verktyg' },
  { to: '/dashboard/utveckling', icon: BookOpen, label: 'Min utveckling' },
]

const secondaryItems = [
  { to: '/dashboard/installningar', icon: Settings, label: 'Inställningar' },
]

interface SidebarProps {
  onClose?: () => void
  mobile?: boolean
}

export function Sidebar({ onClose, mobile }: SidebarProps) {
  const { profile, trustLevel } = useAuth()

  return (
    <aside className={`flex flex-col h-full bg-white ${mobile ? 'w-64' : 'w-60'}`}>
      {/* Header */}
      <div className="px-5 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#2D3436] tracking-tight">Grundat</h1>
          <p className="text-[10px] text-gray-400 -mt-0.5">av John Tengström</p>
        </div>
        {mobile && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#F5F5F0] text-[#2D3436]'
                  : 'text-gray-500 hover:bg-[#F5F5F0]/50 hover:text-[#2D3436]'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}

        <div className="h-px bg-gray-100 my-3" />

        {secondaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#F5F5F0] text-[#2D3436]'
                  : 'text-gray-500 hover:bg-[#F5F5F0]/50 hover:text-[#2D3436]'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}

        <a
          href="https://johntengstrom.se/boka"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-[#F5F5F0]/50 hover:text-[#2D3436] transition-colors"
        >
          <Calendar size={16} />
          Boka samtal
        </a>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[#2D3436] truncate">
              {profile?.display_name || 'Entreprenör'}
            </p>
          </div>
          <TrustBadge level={trustLevel} size="sm" />
        </div>
      </div>
    </aside>
  )
}
