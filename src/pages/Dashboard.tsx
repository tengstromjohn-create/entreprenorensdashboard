import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppAuth } from '@/contexts/AuthContext';
import { House, Wrench, BookOpen, ArrowRight } from 'lucide-react';

export function Dashboard() {
  const { user, trustLevel } = useAppAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Välkommen{user?.name ? `, ${user.name}` : ''}
        </h1>
        <p className="text-muted-foreground">
          Här är en översikt av ditt dashboard.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Zone 1: Mitt bolag */}
        <Link to="/dashboard/bolag" className="group">
          <Card className="transition-colors hover:border-foreground/20">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-secondary p-2">
                <House className="size-5" />
              </div>
              <CardTitle className="text-base">Mitt bolag</CardTitle>
              <ArrowRight className="size-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Se och hantera ditt bolags information, styrelse,
                ägarstruktur och nyckeltal.
              </p>
              {/* TODO: ED-3 — Show company summary data here */}
            </CardContent>
          </Card>
        </Link>

        {/* Zone 2: Mina verktyg */}
        <Link to="/dashboard/verktyg" className="group">
          <Card className="transition-colors hover:border-foreground/20">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-secondary p-2">
                <Wrench className="size-5" />
              </div>
              <CardTitle className="text-base">Mina verktyg</CardTitle>
              <ArrowRight className="size-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Startup Kit, Corporate Health Check och fler verktyg
                för att driva och utveckla ditt bolag.
              </p>
              {/* TODO: ED-4 — Show quick tool statuses here */}
            </CardContent>
          </Card>
        </Link>

        {/* Zone 3: Min utveckling */}
        <Link to="/dashboard/utveckling" className="group">
          <Card className="transition-colors hover:border-foreground/20 relative overflow-hidden">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="rounded-lg bg-secondary p-2">
                <BookOpen className="size-5" />
              </div>
              <CardTitle className="text-base">Min utveckling</CardTitle>
              <ArrowRight className="size-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Personlig utvecklingsplan, kurser och resurser
                för att växa som entreprenör.
              </p>
              {trustLevel !== 'bankid' &&
                trustLevel !== 'existing_client' && (
                  <div className="mt-2 text-xs text-orange-600 font-medium">
                    Kommer snart
                  </div>
                )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* TODO: ED-3 — Add recent activity feed, notifications, and quick actions */}
    </div>
  );
}
