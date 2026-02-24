import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppAuth } from '@/contexts/AuthContext';
import { House, Users, BarChart3, FileText } from 'lucide-react';

export function Bolag() {
  const { trustLevel } = useAppAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mitt bolag</h1>
        <p className="text-muted-foreground">
          Översikt och hantering av ditt bolag.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <House className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Bolagsinformation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Företagsnamn, organisationsnummer, adress och kontaktuppgifter.
            </p>
            {/* TODO: ED-3 — Fetch and display company data from Supabase */}
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Bolagsinformation laddas i nästa version.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Users className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Styrelse & ägare</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Styrelseledamöter, revisorer och ägarstruktur.
            </p>
            {/* TODO: ED-3 — Fetch board members and ownership structure */}
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Styrelsedata laddas i nästa version.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <BarChart3 className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Nyckeltal</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Finansiella nyckeltal och trender.
            </p>
            {/* TODO: ED-3 — Show financial KPIs and charts */}
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Nyckeltal laddas i nästa version.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <FileText className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Dokument</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Bolagsordning, årsredovisningar och andra dokument.
            </p>
            {trustLevel === 'org_nr' && (
              <div className="mt-4 rounded-lg bg-orange-50 border border-orange-200 p-3 text-xs text-orange-800">
                Verifiera med BankID för att se alla dokument.
              </div>
            )}
            {/* TODO: ED-3 — Document list and upload functionality */}
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Dokumenthantering laddas i nästa version.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
