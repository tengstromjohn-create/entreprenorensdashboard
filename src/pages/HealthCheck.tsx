import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeartPulse, ShieldCheck, AlertTriangle, FileSearch } from 'lucide-react';

export function HealthCheck() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Corporate Health Check
        </h1>
        <p className="text-muted-foreground">
          Analysera ditt bolags juridiska och regulatoriska status.
        </p>
      </div>

      {/* TODO: ED-5 — Build full Corporate Health Check */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <ShieldCheck className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Compliance-status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Kontrollera att bolaget uppfyller alla regulatoriska krav.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i ED-5.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <AlertTriangle className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Riskanalys</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Identifiera potentiella juridiska och finansiella risker.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i ED-5.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <FileSearch className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Dokumentgranskning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Granska bolagsordning, avtal och andra viktiga dokument.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i ED-5.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <HeartPulse className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Hälsorapport</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sammanställd rapport med rekommendationer och åtgärder.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i ED-5.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
