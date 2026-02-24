import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TrustLevelBadge } from '@/components/TrustLevelBadge';
import { useAppAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, trustLevel, isAuthenticated, signOut } = useAppAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
        {/* Mobile hamburger */}
        {isAuthenticated && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onToggleSidebar}
          >
            <Menu className="size-5" />
          </Button>
        )}

        {/* Logo */}
        <a
          href="https://johntengstrom.se"
          className="font-bold text-foreground hover:opacity-80 transition-opacity"
        >
          John Tengström
        </a>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User info */}
        {isAuthenticated && user && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm sm:inline-block">
              {user.name}
            </span>
            {trustLevel && (
              <TrustLevelBadge
                level={trustLevel}
                className="hidden sm:inline-flex"
              />
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline-block">Logga ut</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
