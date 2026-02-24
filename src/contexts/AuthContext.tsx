import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth as useOidcAuth } from 'react-oidc-context';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export type TrustLevel =
  | 'bankid'
  | 'existing_client'
  | 'verified_manual'
  | 'org_nr'
  | 'pending_manual';

export interface AppUser {
  id: string;
  name: string;
  email: string;
}

export interface ManualSignupData {
  name: string;
  email: string;
  password: string;
  country: string;
  companyInfo: string;
  // TODO: ED-2 — Add file upload field for ID copy
}

interface AuthContextType {
  user: AppUser | null;
  trustLevel: TrustLevel | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  products: string[];
  signInWithBankID: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithOrgNr: (
    email: string,
    password: string,
    orgNr: string
  ) => Promise<void>;
  signUpManual: (data: ManualSignupData) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const oidcAuth = useOidcAuth();
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [trustLevel, setTrustLevel] = useState<TrustLevel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [products] = useState<string[]>([]); // TODO: ED-2 — Populate from product_access table

  // Listen for Supabase auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseSession(session);
      if (session?.user) {
        setUser({
          id: session.user.id,
          name:
            session.user.user_metadata?.name || session.user.email || '',
          email: session.user.email || '',
        });
        setTrustLevel(
          (session.user.user_metadata?.trust_level as TrustLevel) || 'org_nr'
        );
      } else if (!oidcAuth.isAuthenticated) {
        setUser(null);
        setTrustLevel(null);
      }
      setIsLoading(false);
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSupabaseSession(session);
        setUser({
          id: session.user.id,
          name:
            session.user.user_metadata?.name || session.user.email || '',
          email: session.user.email || '',
        });
        setTrustLevel(
          (session.user.user_metadata?.trust_level as TrustLevel) || 'org_nr'
        );
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [oidcAuth.isAuthenticated]);

  // Handle OIDC auth (BankID) — sync OIDC user to local state
  useEffect(() => {
    if (oidcAuth.isAuthenticated && oidcAuth.user) {
      setUser({
        id: oidcAuth.user.profile.sub,
        name: (oidcAuth.user.profile.name as string) || '',
        email: (oidcAuth.user.profile.email as string) || '',
      });
      setTrustLevel('bankid');
      setIsLoading(false);
    }
  }, [oidcAuth.isAuthenticated, oidcAuth.user]);

  const isAuthenticated = !!(
    user && (supabaseSession || oidcAuth.isAuthenticated)
  );

  const signInWithBankID = useCallback(async () => {
    await oidcAuth.signinRedirect();
  }, [oidcAuth]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    },
    []
  );

  const signUpWithOrgNr = useCallback(
    async (email: string, password: string, orgNr: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            org_nr: orgNr,
            trust_level: 'org_nr',
          },
        },
      });
      if (error) throw error;
    },
    []
  );

  const signUpManual = useCallback(async (data: ManualSignupData) => {
    // TODO: ED-2 — Handle file upload for ID copy before signup
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          country: data.country,
          company_info: data.companyInfo,
          trust_level: 'pending_manual',
        },
      },
    });
    if (error) throw error;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (oidcAuth.isAuthenticated) {
      await oidcAuth.removeUser();
    }
    await supabase.auth.signOut();
    setUser(null);
    setTrustLevel(null);
  }, [oidcAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        trustLevel,
        isAuthenticated,
        isLoading,
        products,
        signInWithBankID,
        signInWithEmail,
        signUpWithOrgNr,
        signUpManual,
        signInWithMagicLink,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAppAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAppAuth must be used within an AuthContextProvider');
  }
  return context;
}
