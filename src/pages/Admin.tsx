import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Users, Activity, Settings } from 'lucide-react';

export function Admin() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground">
            Administratörspanel för plattformen.
          </p>
        </div>
        <Badge variant="secondary">Admin</Badge>
      </div>

      {/* TODO: ED-6 — Build admin panel with user management, analytics, etc. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Users className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Användarhantering</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Hantera användare, verifiering och behörigheter.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i kommande version.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <ShieldCheck className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Verifieringsköer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Granska och godkänn manuella verifieringar.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i kommande version.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Activity className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Aktivitetslogg</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Övervaka plattformens aktivitet och händelser.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i kommande version.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Settings className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Plattformsinställningar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Konfigurera plattformens beteende och integrationer.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i kommande version.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
