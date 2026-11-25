import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { AuthContextProvider, useAuth } from '../src/contexts/AuthContext'
import { oidcConfig } from '../src/lib/auth'
import { supabase } from '../src/lib/supabase'
import { ContractEngine } from '../src/pages/ContractEngine'

const testCompany = { name: 'Syntetiskt testbolag', orgNumber: '000000-0001' }
const sdkEvents: Array<{ event: string; userId?: string }> = []
supabase.auth.onAuthStateChange((event, session) => sdkEvents.push({ event, userId: session?.user.id }))
Object.assign(window, {
  authTest: {
    auth: supabase.auth,
    sdkEvents,
    realtimeToken: () => supabase.realtime.accessTokenValue,
  },
})

export function Fixture() {
  const { user, activeCompany, setActiveCompany, isLoading } = useAuth()
  const [showContract, setShowContract] = useState(false)
  const pendingSelection = useRef<(() => void) | null>(null)
  return (
    <>
      <output data-testid="account">{isLoading ? 'laddar' : user?.id ?? 'utloggad'}</output>
      <output data-testid="company">{activeCompany?.name ?? 'inget bolag'}</output>
      <button onClick={() => setActiveCompany(testCompany)}>Välj testbolag</button>
      <button onClick={() => { pendingSelection.current = () => setActiveCompany(testCompany) }}>Starta bolagsuppslag</button>
      <button onClick={() => pendingSelection.current?.()}>Slutför bolagsuppslag</button>
      <button onClick={() => setShowContract(true)}>Öppna avtalsmotorn</button>
      {showContract && <ContractEngine />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <AuthProvider {...oidcConfig}>
    <AuthContextProvider><Fixture /></AuthContextProvider>
  </AuthProvider>,
)
