import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useAuth as useOidcAuth } from 'react-oidc-context'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export type TrustLevel = 'org_nr' | 'pending_manual' | 'verified_manual' | 'bankid' | 'existing_client'

export interface UserProfile {
  id: string
  display_name: string
  email: string
  trust_level: TrustLevel
  org_number?: string
  personal_number_hash?: string
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const oidcAuth = useOidcAuth()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [trustLevel, setTrustLevel] = useState<TrustLevel>('org_nr')
  const [isLoading, setIsLoading] = useState(true)
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

  // Handle OIDC auth (BankID) — sync OIDC user to local state
  useEffect(() => {
    if (oidcAuth.isAuthenticated && oidcAuth.user) {
      // BankID users get trust_level='bankid' via the bankid-auth edge function
      // For now, set a temporary user object until the edge function creates the Supabase user
      setTrustLevel('bankid')
      setIsLoading(false)
    }
  }, [oidcAuth.isAuthenticated, oidcAuth.user])

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
