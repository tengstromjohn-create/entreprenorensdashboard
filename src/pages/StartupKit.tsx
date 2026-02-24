import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket, CheckCircle2, FileText, Scale } from 'lucide-react';

export function StartupKit() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Startup Kit</h1>
        <p className="text-muted-foreground">
          Allt du behöver för att starta ett nytt bolag — steg för steg.
        </p>
      </div>

      {/* TODO: ED-4 — Build full Startup Kit experience */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <CheckCircle2 className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Checklista</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Steg-för-steg-guide för bolagsbildning.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i ED-4.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <FileText className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Dokumentmallar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bolagsordning, aktieägaravtal, styrelsebeslut och mer.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i ED-4.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Scale className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Juridisk vägledning</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Vanliga frågor och svar om bolagsrätt vid start.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i ED-4.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Rocket className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Registreringsguide</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Guide för registrering hos Bolagsverket, Skatteverket m.fl.
            </p>
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Byggs i ED-4.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
