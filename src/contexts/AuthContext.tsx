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
import { supabase } from '@/lib/supabase'
import { callEdgeFunction } from '@/lib/edge-functions'
import { extractBankIDClaims } from '@/lib/bankid-claims'
import type { User } from '@supabase/supabase-js'
import type { EngagementData } from '@/types/dashboard'

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
  isAuthenticated: boolean
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string, orgNumber?: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithBankID: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
  completeBankIDLogin: (claims: { name: string; personalNumber: string; sub?: string }) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const oidcAuth = useOidcAuth()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [trustLevel, setTrustLevel] = useState<TrustLevel>('org_nr')
  const [isLoading, setIsLoading] = useState(true)
  // Guard så BankID-hydreringen i OIDC-effekten bara körs en gång per provider-mount
  const hydrationRef = useRef(false)
  // Dedupe: AuthCallback och OIDC-effekten kan anropa completeBankIDLogin samtidigt —
  // dela samma körning så bankid-auth (createUser m.m.) inte race:ar.
  const loginInFlight = useRef<Promise<void> | null>(null)

  // Debug: log OIDC state changes
  useEffect(() => {
    console.log('[AuthContext] oidcAuth.isLoading:', oidcAuth.isLoading)
    console.log('[AuthContext] oidcAuth.isAuthenticated:', oidcAuth.isAuthenticated)
    console.log('[AuthContext] oidcAuth.error:', oidcAuth.error?.message)
    console.log('[AuthContext] own isLoading:', isLoading)
  }, [oidcAuth.isLoading, oidcAuth.isAuthenticated, oidcAuth.error, isLoading])

  // Timeout fallback: if still loading after 8s, stop waiting
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.warn('[AuthContext] Loading timeout after 8s — forcing isLoading=false. OIDC isLoading:', oidcAuth.isLoading, 'error:', oidcAuth.error?.message)
        setIsLoading(false)
      }
    }, 8000)
    return () => clearTimeout(timer)
  }, [isLoading, oidcAuth.isLoading, oidcAuth.error])

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) {
      setProfile(data as UserProfile)
      setTrustLevel(data.trust_level || 'org_nr')
    }
  }, [])

  // Listen for Supabase auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else if (!oidcAuth.isAuthenticated) {
        setUser(null)
        setProfile(null)
        setTrustLevel('org_nr')
      }
      setIsLoading(false)
    })

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [oidcAuth.isAuthenticated, fetchProfile])

  /**
   * Slutför BankID-inloggningen efter lyckad Signicat-callback.
   *  1. bankid-auth: skapar/matchar Supabase-användare, hashar pnr (SHA-256),
   *     sätter trust_level='bankid', kör jävskontroll och persisterar engagemang.
   *     Gateas via sessionStorage så det tunga arbetet körs en gång per browser-session,
   *     inte vid varje refresh.
   *  2. get-my-companies: hämtar bolagsengagemangen för "Dina bolag". RLS tillåter inte
   *     anon att läsa user_profiles utan Supabase-session (policy: auth.uid()=id), så
   *     listan hämtas via denna stateless endpoint istället för en DB-läsning.
   * Felar aldrig hela inloggningen på engagemangs-problem — listan blir då tom.
   */
  const completeBankIDLogin = useCallback((claims: { name: string; personalNumber: string; sub?: string }): Promise<void> => {
    if (loginInFlight.current) return loginInFlight.current

    const run = (async () => {
      const { name, personalNumber } = claims
      const flagKey = `bankid_auth_done_${claims.sub ?? personalNumber}`
      let userId: string | undefined
      let conflictResult: 'clear' | 'flagged' | undefined

      if (!sessionStorage.getItem(flagKey)) {
        const res = await callEdgeFunction<{ userId: string; conflictResult: 'clear' | 'flagged' }>(
          'bankid-auth',
          { name, personalNumber }
        )
        userId = res.userId
        conflictResult = res.conflictResult
        sessionStorage.setItem(flagKey, '1')
      }

      let engagements: EngagementData | undefined
      try {
        const eng = await callEdgeFunction<{ data: EngagementData }>('get-my-companies', { personalNumber })
        engagements = eng.data
      } catch (err) {
        console.error('[AuthContext] get-my-companies misslyckades:', err instanceof Error ? err.message : String(err))
      }

      setProfile((prev) => ({
        id: userId ?? prev?.id ?? '',
        display_name: name || prev?.display_name || '',
        email: prev?.email ?? '',
        trust_level: 'bankid',
        engagements: engagements ?? prev?.engagements,
        ...(conflictResult && { conflict_check_result: conflictResult }),
        personal_number_hash: prev?.personal_number_hash,
        created_at: prev?.created_at ?? '',
        updated_at: new Date().toISOString(),
      }))
      setTrustLevel('bankid')
    })()

    loginInFlight.current = run.finally(() => { loginInFlight.current = null })
    return loginInFlight.current
  }, [])

  // Handle OIDC auth (BankID) — sync OIDC user to local state
  useEffect(() => {
    if (oidcAuth.isAuthenticated && oidcAuth.user) {
      setTrustLevel('bankid')
      setIsLoading(false)

      // Refresh-robusthet: AuthCallback driver inloggningsflödet, men vid en hård omladdning
      // av t.ex. /dashboard körs inte callbacken — hydrera då engagemangen här så att
      // "Dina bolag" inte töms. Körs en gång per mount; bankid-auth gateas internt.
      if (!hydrationRef.current) {
        hydrationRef.current = true
        const p = oidcAuth.user.profile
        const { personalNumber, name } = extractBankIDClaims(p)
        if (personalNumber) {
          completeBankIDLogin({ name, personalNumber, sub: p.sub }).catch((err) =>
            console.error('[AuthContext] BankID-hydrering misslyckades:', err instanceof Error ? err.message : String(err))
          )
        }
      }
    }
  }, [oidcAuth.isAuthenticated, oidcAuth.user, completeBankIDLogin])

  const isAuthenticated = !!(user || oidcAuth.isAuthenticated)

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
    await oidcAuth.signinRedirect()
  }, [oidcAuth])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (oidcAuth.isAuthenticated) {
      await oidcAuth.removeUser()
    }
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setTrustLevel('org_nr')
  }, [oidcAuth])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        trustLevel,
        isAuthenticated,
        isLoading,
        signIn,
        signUp,
        signOut,
        signInWithBankID,
        signInWithMagicLink,
        refreshProfile,
        completeBankIDLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAppAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAppAuth must be used within an AuthContextProvider')
  }
  return context
}

// Alias for cleaner imports in new components
export const useAuth = useAppAuth
