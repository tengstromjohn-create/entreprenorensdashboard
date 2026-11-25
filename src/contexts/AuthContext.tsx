import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useAuth as useOidcAuth } from 'react-oidc-context'
import { toast } from 'sonner'
import { readActiveCompany, storeActiveCompany } from '@/lib/active-company'
import { didStoredAccountChange, getBankIDSessionId } from '@/lib/auth-storage'
import { requestBankIDLogin, signOutFromApp, type BankIDLoginProof } from '@/lib/bankid-flow'
import { authStorage, authStorageKey, supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'
import type { CompanyData, EngagementData } from '@/types/dashboard'

export type TrustLevel = 'org_nr' | 'pending_manual' | 'verified_manual' | 'bankid' | 'existing_client'

export interface UserProfile {
  id: string
  display_name: string
  email: string
  trust_level: TrustLevel
  org_number?: string
  personal_number_hash?: string
  engagements?: EngagementData
  bankid_verified_at?: string
  conflict_check_result?: 'clear' | 'flagged'
  conflict_checked_at?: string
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  trustLevel: TrustLevel
  bankIDSessionId: string | null
  bankIDSessionRejected: boolean
  rejectBankIDSession: (sessionId: string) => void
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string, orgNumber?: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithBankID: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
  completeBankIDLogin: (proof: BankIDLoginProof) => Promise<void>
  /**
   * Aktivt bolag — det bolag användaren senast valt i "Dina bolag" (eller slagit upp).
   * Delas mellan Health Check, avtalsmotorn och andra verktyg och sparas i sessionStorage.
   */
  activeCompany: CompanyData | null
  setActiveCompany: (company: CompanyData | null) => void
  accountRevision: number
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function readProfile(userId: string, signal?: AbortSignal): Promise<UserProfile | null> {
  const query = supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
  if (signal) query.abortSignal(signal)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return data as UserProfile | null
}

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const oidcAuth = useOidcAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [rejectedBankIDSessionId, setRejectedBankIDSessionId] = useState<string | null>(null)
  const [loadedProfile, setLoadedProfile] = useState<{ userId: string; profile: UserProfile | null } | null>(null)
  const [isSessionLoading, setIsSessionLoading] = useState(true)
  const currentSession = useRef<Session | null>(null)
  const currentAccountRevision = useRef(0)
  const user = session?.user ?? null
  const userId = user?.id
  const currentProfile = loadedProfile?.userId === userId ? loadedProfile : null
  const profile = currentProfile?.profile ?? null
  const isLoading = isSessionLoading || (!!userId && !currentProfile)
  const verifiedBankIDSessionId = getBankIDSessionId(session)
  const bankIDSessionRejected = verifiedBankIDSessionId !== null && verifiedBankIDSessionId === rejectedBankIDSessionId
  const bankIDSessionId = bankIDSessionRejected ? null : verifiedBankIDSessionId
  const trustLevel = bankIDSessionId ? 'bankid'
    : profile?.trust_level === 'bankid' ? 'org_nr' : profile?.trust_level ?? 'org_nr'
  const [activeCompany, setActiveCompanyState] = useState<CompanyData | null>(null)
  const [accountRevision, setAccountRevision] = useState(0)

  const setActiveCompany = useCallback((company: CompanyData | null) => {
    if (!userId || currentSession.current?.user.id !== userId || currentAccountRevision.current !== accountRevision) return
    setActiveCompanyState(company)
    storeActiveCompany(sessionStorage, userId, company)
  }, [userId, accountRevision])

  useEffect(() => {
    function applySession(next: Session | null, accountChangedInStorage = false) {
      const nextUserId = next?.user.id
      const previousUserId = currentSession.current?.user.id
      const userChanged = previousUserId !== nextUserId
      if (accountChangedInStorage || (previousUserId && userChanged)) {
        storeActiveCompany(sessionStorage, nextUserId, null)
        setActiveCompanyState(null)
        currentAccountRevision.current += 1
        setAccountRevision(currentAccountRevision.current)
      } else if (!nextUserId || userChanged) {
        setActiveCompanyState(readActiveCompany(sessionStorage, nextUserId))
      }
      if (!nextUserId || userChanged) {
        setLoadedProfile(null)
        setRejectedBankIDSessionId(null)
      }
      currentSession.current = next
      setSession(next)
      setIsSessionLoading(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION' && !nextSession) applySession(null)
      else applySession(authStorage.readSession())
    })

    function onStorage(event: StorageEvent) {
      if (event.storageArea === localStorage && (event.key === authStorageKey || event.key === null)) {
        const next = authStorage.readSession()
        const tokenChanged = currentSession.current?.access_token !== next?.access_token
        // Läs själva händelsen så att även köade byten A → B → A rensar valet.
        applySession(next, didStoredAccountChange(event))
        if (tokenChanged) {
          void supabase.realtime.setAuth(next?.access_token).catch(() => {
            console.error('[AuthContext] Realtime-sessionen kunde inte synkroniseras')
          })
        }
      }
    }

    window.addEventListener('storage', onStorage)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    const controller = new AbortController()
    void readProfile(userId, controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) console.error('[AuthContext] Profilen kunde inte läsas')
        return null
      })
      .then((profile) => {
        if (!controller.signal.aborted && currentSession.current?.user.id === userId) {
          setLoadedProfile({ userId, profile })
        }
      })
    return () => controller.abort()
  }, [userId])

  const completeBankIDLogin = useCallback(async (proof: BankIDLoginProof) => {
    const { data, error } = await supabase.functions.invoke<{ accessToken: string; refreshToken: string }>(
      'bankid-auth',
      {
        body: proof,
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      },
    )
    if (error || !data?.accessToken || !data.refreshToken) {
      throw new Error('BankID-inloggningen kunde inte verifieras. Försök igen.')
    }
    const previousUserId = currentSession.current?.user.id
    const { data: { session: next }, error: sessionError } = await supabase.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    })
    if (sessionError || !next) throw new Error('Supabase-inloggningen kunde inte slutföras.')
    if (previousUserId === next.user.id) {
      await readProfile(next.user.id).then((profile) => {
        if (currentSession.current?.user.id === next.user.id) setLoadedProfile({ userId: next.user.id, profile })
      }).catch(() => {
        console.error('[AuthContext] Profilen kunde inte läsas efter BankID-inloggning')
      })
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName: string, orgNumber?: string) => {
    const trustLevel: TrustLevel = orgNumber ? 'org_nr' : 'pending_manual'
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          trust_level: trustLevel,
          ...(orgNumber && { org_number: orgNumber }),
        },
      },
    })
    if (error) throw error

    // Create user_profiles row
    if (data.user) {
      await supabase.from('user_profiles').insert({
        id: data.user.id,
        display_name: displayName,
        email,
        trust_level: trustLevel,
        ...(orgNumber && { org_number: orgNumber }),
      })
    }
  }, [])

  const signInWithBankID = useCallback(async () => {
    await requestBankIDLogin(oidcAuth.signinRedirect)
  }, [oidcAuth])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await signOutFromApp(oidcAuth.removeUser, () => supabase.auth.signOut(), toast.error)
  }, [oidcAuth])

  const rejectBankIDSession = useCallback((sessionId: string) => {
    if (getBankIDSessionId(currentSession.current) === sessionId) setRejectedBankIDSessionId(sessionId)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    const profile = await readProfile(userId)
    if (currentSession.current?.user.id === userId) setLoadedProfile({ userId, profile })
  }, [userId])

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        trustLevel,
        bankIDSessionId,
        bankIDSessionRejected,
        rejectBankIDSession,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        signOut,
        signInWithBankID,
        signInWithMagicLink,
        refreshProfile,
        completeBankIDLogin,
        activeCompany,
        setActiveCompany,
        accountRevision,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

function useAppAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAppAuth must be used within an AuthContextProvider')
  }
  return context
}

// Befintliga importer använder båda namnen för samma hook.
// eslint-disable-next-line react-refresh/only-export-components
export { useAppAuth, useAppAuth as useAuth }
