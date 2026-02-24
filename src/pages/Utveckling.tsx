import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Target, GraduationCap, TrendingUp } from 'lucide-react';

export function Utveckling() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Min utveckling
          </h1>
          <p className="text-muted-foreground">
            Personlig utveckling och lärande för entreprenörer.
          </p>
        </div>
        <Badge
          variant="secondary"
          className="bg-orange-100 text-orange-800 border-orange-200"
        >
          Preview
        </Badge>
      </div>

      {/* TODO: ED-6 — Build full personal development module */}
      <div className="rounded-lg border border-dashed p-8 text-center">
        <BookOpen className="size-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">Kommer snart</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Här bygger vi en personlig utvecklingsplattform med kurser,
          resurser och verktyg anpassade för entreprenörer. Håll utkik!
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Target className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Mål & milstolpar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sätt och följ personliga och professionella mål.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <GraduationCap className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Kurser</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Utbildningar inom juridik, ekonomi och ledarskap.
            </p>
          </CardContent>
        </Card>

        <Card className="opacity-60">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <TrendingUp className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Framsteg</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Följ din utveckling över tid med konkreta mätpunkter.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
