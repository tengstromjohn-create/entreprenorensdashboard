import { NavLink } from 'react-router-dom'
import { Home, Building2, Wrench, BookOpen, Settings, Calendar, X, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

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
  onUpgrade?: () => void
}

export function Sidebar({ onClose, mobile, onUpgrade }: SidebarProps) {
  const { profile, trustLevel } = useAuth()

  return (
    <aside className={`flex flex-col h-full bg-[#1F4567] relative ${mobile ? 'w-64' : 'w-60'}`}>
      {/* Header */}
      <div className="px-5 py-6 flex items-start justify-between relative z-10">
        <div className="flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-[#FAF6EE] tracking-tight leading-none">Grundat</h1>
            {/* ASTRA-logotyp — officiell silver-variant från ASTRA brand-paket */}
            <img
              src="/Astra%20symbol_RGB_Silver.svg"
              alt="ASTRA Advokater"
              className="h-[22px] w-auto shrink-0"
            />
          </div>
          <p className="text-[11px] text-[#FAF6EE]/80 mt-2.5 leading-tight">Advokat John Tengström</p>
          <p className="text-[10px] text-[#C18B2A] tracking-[0.15em] uppercase font-medium mt-1 leading-tight">
            ASTRA ADVOKATER
          </p>
        </div>
        {mobile && (
          <button onClick={onClose} className="text-[#FAF6EE]/60 hover:text-[#FAF6EE]">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 space-y-1 relative z-10">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#B5453B] text-[#FAF6EE]'
                  : 'text-[#FAF6EE]/75 hover:bg-[#2A5D8C] hover:text-[#FAF6EE]'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}

        <div className="h-px bg-[#2A5D8C] my-3" />

        {secondaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#B5453B] text-[#FAF6EE]'
                  : 'text-[#FAF6EE]/65 hover:bg-[#2A5D8C] hover:text-[#FAF6EE]'
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
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#FAF6EE]/65 hover:bg-[#2A5D8C] hover:text-[#FAF6EE] transition-colors"
        >
          <Calendar size={16} />
          Boka samtal
        </a>
      </nav>

      {/* Foundation pattern — subtila byggblock längst ner som visuellt grundankare */}
      <svg
        aria-hidden="true"
        viewBox="0 0 240 60"
        className="absolute bottom-20 left-0 right-0 w-full opacity-[0.08] pointer-events-none"
        preserveAspectRatio="none"
      >
        {/* Tre rader av "stenblock" som suggererar fundament */}
        <g fill="#FAF6EE">
          <rect x="0" y="0" width="36" height="14" rx="1" />
          <rect x="40" y="0" width="52" height="14" rx="1" />
          <rect x="96" y="0" width="42" height="14" rx="1" />
          <rect x="142" y="0" width="48" height="14" rx="1" />
          <rect x="194" y="0" width="46" height="14" rx="1" />

          <rect x="0" y="18" width="48" height="14" rx="1" />
          <rect x="52" y="18" width="36" height="14" rx="1" />
          <rect x="92" y="18" width="56" height="14" rx="1" />
          <rect x="152" y="18" width="42" height="14" rx="1" />
          <rect x="198" y="18" width="42" height="14" rx="1" />

          <rect x="0" y="36" width="40" height="14" rx="1" />
          <rect x="44" y="36" width="48" height="14" rx="1" />
          <rect x="96" y="36" width="38" height="14" rx="1" />
          <rect x="138" y="36" width="54" height="14" rx="1" />
          <rect x="196" y="36" width="44" height="14" rx="1" />
        </g>
      </svg>

      {/* Upgrade CTA — visas bara för org_nr och pending_manual */}
      {(trustLevel === 'org_nr' || trustLevel === 'pending_manual') && onUpgrade && (
        <div className="px-3 mb-2 relative z-10">
          <button
            onClick={() => { onUpgrade(); onClose?.() }}
            className="w-full bg-[#B5453B] text-[#FAF6EE] rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-[#9F3A30] transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck size={14} />
            Uppgradera till BankID
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#2A5D8C] relative z-10 bg-[#1F4567]">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[#FAF6EE] truncate">
            {profile?.display_name || 'Entreprenör'}
          </p>
          {trustLevel === 'bankid' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#C18B2A]">
              <ShieldCheck size={12} />
              BankID
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}
