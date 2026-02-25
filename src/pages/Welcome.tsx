import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useAppAuth } from '@/contexts/AuthContext'
import { Shield, Building2, Globe, Users } from 'lucide-react'

type LoginView =
  | 'main'
  | 'orgNr'
  | 'manual'
  | 'existingClient'
  | 'existingLogin'

export function Welcome() {
  const [view, setView] = useState<LoginView>('main')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const navigate = useNavigate()
  const {
    signIn,
    signUp,
    signInWithBankID,
    signInWithMagicLink,
  } = useAppAuth()

  // Org nr form state
  const [orgNr, setOrgNr] = useState('')
  const [orgEmail, setOrgEmail] = useState('')
  const [orgPassword, setOrgPassword] = useState('')

  // Manual form state
  const [manualName, setManualName] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [manualPassword, setManualPassword] = useState('')
  const [manualCountry, setManualCountry] = useState('Sverige')
  const [manualCompanyInfo, setManualCompanyInfo] = useState('')

  // Existing client
  const [clientEmail, setClientEmail] = useState('')

  // Login form
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginMagicEmail, setLoginMagicEmail] = useState('')
  const [loginMagicSent, setLoginMagicSent] = useState(false)

  const validateOrgNr = (value: string) =>
    /^\d{6}-\d{4}$/.test(value)

  const handleAsync = async (fn: () => Promise<void>) => {
    setError(null)
    setLoading(true)
    try {
      await fn()
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Något gick fel')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <a
            href="https://johntengstrom.se"
            className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            John Tengström
          </a>
          <h1 className="text-3xl font-bold tracking-tight">
            Entreprenörens Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Ditt bolag. Dina verktyg. Din utveckling.
          </p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Samla allt du behöver som entreprenör på ett ställe — från
            bolagsöversikt och juridiska verktyg till personlig utveckling.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Main login options */}
        {view === 'main' && (
          <div className="space-y-4">
            {/* 1. BankID (primary) */}
            <Button
              className="w-full h-12 text-base"
              size="lg"
              onClick={() => handleAsync(signInWithBankID)}
              disabled={loading}
            >
              <Shield className="size-5 mr-2" />
              Logga in med BankID
            </Button>
            <p className="text-center text-xs text-muted-foreground -mt-2">
              Säkrast. Full tillgång direkt.
            </p>

            {/* 2. Org nr (secondary) */}
            <Button
              variant="outline"
              className="w-full h-11"
              size="lg"
              onClick={() => setView('orgNr')}
            >
              <Building2 className="size-4 mr-2" />
              Utforska med organisationsnummer
            </Button>
            <p className="text-center text-xs text-muted-foreground -mt-2">
              Gratis. Begränsad tillgång.
            </p>

            {/* 3. No Swedish BankID */}
            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
              onClick={() => setView('manual')}
            >
              <Globe className="size-3.5 inline mr-1" />
              Jag har inte svenskt BankID
            </button>

            {/* 4. Existing ASTRA client */}
            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
              onClick={() => setView('existingClient')}
            >
              <Users className="size-3.5 inline mr-1" />
              Jag är befintlig klient hos ASTRA
            </button>

            <Separator />

            <button
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setView('existingLogin')}
            >
              Har du redan konto? <span className="underline">Logga in</span>
            </button>
          </div>
        )}

        {/* Org nr form */}
        {view === 'orgNr' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold">
                Utforska med organisationsnummer
              </h2>
              <div className="space-y-2">
                <Label htmlFor="orgNr">Organisationsnummer</Label>
                <Input
                  id="orgNr"
                  placeholder="XXXXXX-XXXX"
                  value={orgNr}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgNr(e.target.value)}
                />
                {orgNr && !validateOrgNr(orgNr) && (
                  <p className="text-xs text-destructive">
                    Format: XXXXXX-XXXX
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgEmail">E-post</Label>
                <Input
                  id="orgEmail"
                  type="email"
                  placeholder="din@epost.se"
                  value={orgEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgPassword">Lösenord</Label>
                <Input
                  id="orgPassword"
                  type="password"
                  placeholder="Minst 6 tecken"
                  value={orgPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOrgPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={
                  loading ||
                  !validateOrgNr(orgNr) ||
                  !orgEmail ||
                  orgPassword.length < 6
                }
                onClick={() =>
                  handleAsync(() =>
                    signUp(orgEmail, orgPassword, orgEmail, orgNr)
                  )
                }
              >
                {loading ? 'Skapar konto...' : 'Skapa konto'}
              </Button>
              <BackButton onClick={() => setView('main')} />
            </CardContent>
          </Card>
        )}

        {/* Manual signup form */}
        {view === 'manual' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold">
                Skapa konto utan BankID
              </h2>
              <div className="space-y-2">
                <Label htmlFor="manualName">Namn</Label>
                <Input
                  id="manualName"
                  placeholder="Ditt fullständiga namn"
                  value={manualName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualEmail">E-post</Label>
                <Input
                  id="manualEmail"
                  type="email"
                  placeholder="din@epost.se"
                  value={manualEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualPassword">Lösenord</Label>
                <Input
                  id="manualPassword"
                  type="password"
                  placeholder="Minst 6 tecken"
                  value={manualPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualCountry">Land</Label>
                <select
                  id="manualCountry"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={manualCountry}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setManualCountry(e.target.value)}
                >
                  <option value="Sverige">Sverige</option>
                  <option value="EU">EU</option>
                  <option value="Övrigt">Övrigt</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manualCompany">Företagsinformation</Label>
                <Input
                  id="manualCompany"
                  placeholder="Företagsnamn och ev. reg.nr"
                  value={manualCompanyInfo}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualCompanyInfo(e.target.value)}
                />
              </div>
              {/* TODO: ED-2 — Add file upload for ID copy */}
              <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                Filuppladdning för ID-kopia läggs till i nästa version.
              </div>
              <Button
                className="w-full"
                disabled={
                  loading ||
                  !manualName ||
                  !manualEmail ||
                  manualPassword.length < 6
                }
                onClick={() =>
                  handleAsync(() =>
                    signUp(manualEmail, manualPassword, manualName)
                  )
                }
              >
                {loading ? 'Skapar konto...' : 'Skapa konto'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Ditt konto kommer att granskas manuellt. Viss funktionalitet
                kan vara begränsad tills verifieringen är klar.
              </p>
              <BackButton onClick={() => setView('main')} />
            </CardContent>
          </Card>
        )}

        {/* Existing client — magic link */}
        {view === 'existingClient' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold">
                Befintlig klient hos ASTRA
              </h2>
              <p className="text-sm text-muted-foreground">
                Ange din e-postadress så skickar vi en inloggningslänk.
              </p>
              {magicLinkSent ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
                  En inloggningslänk har skickats till{' '}
                  <strong>{clientEmail}</strong>. Kontrollera din e-post.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="clientEmail">E-post</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      placeholder="din@epost.se"
                      value={clientEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClientEmail(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={loading || !clientEmail}
                    onClick={async () => {
                      setError(null)
                      setLoading(true)
                      try {
                        await signInWithMagicLink(clientEmail)
                        setMagicLinkSent(true)
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : 'Något gick fel'
                        )
                      } finally {
                        setLoading(false)
                      }
                    }}
                  >
                    {loading ? 'Skickar...' : 'Skicka inloggningslänk'}
                  </Button>
                </>
              )}
              <BackButton onClick={() => setView('main')} />
            </CardContent>
          </Card>
        )}

        {/* Existing login */}
        {view === 'existingLogin' && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-lg font-semibold">Logga in</h2>

              {/* Email + password */}
              <div className="space-y-2">
                <Label htmlFor="loginEmail">E-post</Label>
                <Input
                  id="loginEmail"
                  type="email"
                  placeholder="din@epost.se"
                  value={loginEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loginPassword">Lösenord</Label>
                <Input
                  id="loginPassword"
                  type="password"
                  value={loginPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginPassword(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={loading || !loginEmail || !loginPassword}
                onClick={() =>
                  handleAsync(() =>
                    signIn(loginEmail, loginPassword)
                  )
                }
              >
                {loading ? 'Loggar in...' : 'Logga in'}
              </Button>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  eller
                </span>
              </div>

              {/* BankID */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleAsync(signInWithBankID)}
                disabled={loading}
              >
                <Shield className="size-4 mr-2" />
                Logga in med BankID
              </Button>

              {/* Magic link */}
              {loginMagicSent ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                  Inloggningslänk skickad till{' '}
                  <strong>{loginMagicEmail}</strong>.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="E-post för magic link"
                      value={loginMagicEmail}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginMagicEmail(e.target.value)}
                    />
                    <Button
                      variant="secondary"
                      disabled={loading || !loginMagicEmail}
                      onClick={async () => {
                        setError(null)
                        setLoading(true)
                        try {
                          await signInWithMagicLink(loginMagicEmail)
                          setLoginMagicSent(true)
                        } catch (err) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : 'Något gick fel'
                          )
                        } finally {
                          setLoading(false)
                        }
                      }}
                    >
                      Skicka
                    </Button>
                  </div>
                </div>
              )}

              <BackButton onClick={() => setView('main')} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
      onClick={onClick}
    >
      &larr; Tillbaka
    </button>
  )
}
