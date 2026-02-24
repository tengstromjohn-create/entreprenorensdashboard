import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { UpgradeModal } from '@/components/UpgradeModal';
import { Rocket, HeartPulse, ArrowRight, Lock } from 'lucide-react';

interface ToolCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  locked?: boolean;
  onUpgrade?: () => void;
}

function ToolCard({ to, icon, title, description, locked, onUpgrade }: ToolCardProps) {
  if (locked) {
    return (
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <Button variant="outline" size="sm" onClick={onUpgrade}>
            <Lock className="size-3.5 mr-1.5" />
            Uppgradera för tillgång
          </Button>
        </div>
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="rounded-lg bg-secondary p-2">{icon}</div>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link to={to} className="group">
      <Card className="transition-colors hover:border-foreground/20">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="rounded-lg bg-secondary p-2">{icon}</div>
          <CardTitle className="text-base">{title}</CardTitle>
          <ArrowRight className="size-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export function Verktyg() {
  const { trustLevel } = useAppAuth();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const isLimited =
    trustLevel === 'org_nr' || trustLevel === 'pending_manual';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mina verktyg</h1>
        <p className="text-muted-foreground">
          Verktyg för att starta, driva och utveckla ditt bolag.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ToolCard
          to="/dashboard/verktyg/startup-kit"
          icon={<Rocket className="size-5" />}
          title="Startup Kit"
          description="Allt du behöver för att starta ett nytt bolag — steg för steg med mallar, checklistor och guidning."
        />

        <ToolCard
          to="/dashboard/verktyg/health-check"
          icon={<HeartPulse className="size-5" />}
          title="Corporate Health Check"
          description="Analysera ditt bolags juridiska och regulatoriska status. Hitta risker innan de blir problem."
          locked={isLimited}
          onUpgrade={() => setUpgradeOpen(true)}
        />

        {/* TODO: ED-4 till ED-6 — Add more tools */}
      </div>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
