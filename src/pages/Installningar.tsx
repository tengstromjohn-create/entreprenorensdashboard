import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { TrustLevelBadge } from '@/components/TrustLevelBadge'
import { useAppAuth } from '@/contexts/AuthContext'
import { User, Shield, Bell } from 'lucide-react'
import { useState } from 'react'
import { UpgradeModal } from '@/components/UpgradeModal'

export function Installningar() {
  const { profile, trustLevel } = useAppAuth()
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const showUpgrade =
    trustLevel === 'org_nr' || trustLevel === 'pending_manual'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inställningar</h1>
        <p className="text-muted-foreground">
          Hantera ditt konto och dina preferenser.
        </p>
      </div>

      <div className="space-y-4">
        {/* Profile */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <User className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Namn</Label>
                <Input defaultValue={profile?.display_name || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>E-post</Label>
                <Input defaultValue={profile?.email || ''} disabled />
              </div>
            </div>
            {/* TODO: ED-3 — Enable profile editing with Supabase update */}
            <p className="text-xs text-muted-foreground">
              Profilredigering aktiveras i nästa version.
            </p>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Shield className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Säkerhet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Verifieringsnivå</p>
                <p className="text-xs text-muted-foreground">
                  Din nuvarande verifieringsstatus
                </p>
              </div>
              <TrustLevelBadge level={trustLevel} />
            </div>
            {showUpgrade && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Uppgradera till BankID för full tillgång
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUpgradeOpen(true)}
                  >
                    Uppgradera
                  </Button>
                </div>
              </>
            )}
            {/* TODO: ED-3 — Password change, session management */}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Bell className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">Notifikationer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Inställningar för e-post och push-notifikationer.
            </p>
            {/* TODO: ED-3 — Notification preferences */}
            <div className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
              Notifieringsinställningar aktiveras i nästa version.
            </div>
          </CardContent>
        </Card>
      </div>

      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  )
}
