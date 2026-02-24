import { NavLink } from 'react-router-dom';
import {
  House,
  Wrench,
  BookOpen,
  Settings,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { TrustLevelBadge } from '@/components/TrustLevelBadge';
import { useAppAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { UpgradeModal } from '@/components/UpgradeModal';

const navItems = [
  { to: '/dashboard/bolag', icon: House, label: 'Mitt bolag' },
  { to: '/dashboard/verktyg', icon: Wrench, label: 'Verktyg' },
  {
    to: '/dashboard/utveckling',
    icon: BookOpen,
    label: 'Min utveckling',
    comingSoon: true,
  },
];

const secondaryItems = [
  { to: '/dashboard/installningar', icon: Settings, label: 'Inställningar' },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { trustLevel, products } = useAppAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const showUpgrade =
    trustLevel === 'org_nr' || trustLevel === 'pending_manual';
  const isSubscriber = products.length > 0; // TODO: ED-3 — Check for development subscription

  return (
    <aside className={cn('flex flex-col gap-2 py-4', className)}>
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )
            }
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
            {item.comingSoon && !isSubscriber && (
              <Badge
                variant="secondary"
                className="ml-auto text-[10px] px-1.5 py-0"
              >
                Kommer snart
              </Badge>
            )}
          </NavLink>
        ))}
      </nav>

      <Separator className="mx-3" />

      <nav className="flex flex-col gap-1 px-3">
        {secondaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )
            }
          >
            <item.icon className="size-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
        <a
          href="https://johntengstrom.se/boka"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Calendar className="size-4 shrink-0" />
          Boka samtal
        </a>
      </nav>

      <Separator className="mx-3" />

      <div className="px-3 mt-auto">
        {trustLevel && (
          <div className="space-y-2">
            <TrustLevelBadge level={trustLevel} />
            {showUpgrade && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setUpgradeOpen(true)}
              >
                Uppgradera
              </Button>
            )}
          </div>
        )}
      </div>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </aside>
  );
}
