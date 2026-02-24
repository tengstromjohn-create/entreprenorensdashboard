import { Badge } from '@/components/ui/badge';
import type { TrustLevel } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const trustConfig: Record<
  TrustLevel,
  { label: string; className: string }
> = {
  bankid: {
    label: '✓ BankID-verifierad',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  existing_client: {
    label: '✓ Klient',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  verified_manual: {
    label: '✓ Verifierad',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  org_nr: {
    label: 'Begränsad tillgång',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  pending_manual: {
    label: 'Väntar på verifiering',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
};

interface TrustLevelBadgeProps {
  level: TrustLevel;
  className?: string;
}

export function TrustLevelBadge({ level, className }: TrustLevelBadgeProps) {
  const config = trustConfig[level];

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}
