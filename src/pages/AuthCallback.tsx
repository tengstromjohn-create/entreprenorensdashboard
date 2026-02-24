import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth as useOidcAuth } from 'react-oidc-context';

export function AuthCallback() {
  const oidcAuth = useOidcAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // The OIDC library handles the callback automatically via signinCallback
        // After processing, the user will be available in the auth context

        if (oidcAuth.error) {
          setError(oidcAuth.error.message);
          return;
        }

        if (oidcAuth.isAuthenticated && oidcAuth.user) {
          // TODO: ED-2 — Call edge function "bankid-auth" which:
          //   a) Hashes personalNumber (SHA-256)
          //   b) Creates/matches Supabase user
          //   c) Sets trust_level='bankid'
          //   d) Runs conflict of interest check (jävskontroll)
          //   e) Returns session token
          //
          // const { personalNumber, name } = oidcAuth.user.profile;
          // const response = await fetch('/api/bankid-auth', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({ personalNumber, name }),
          // });
          // const { sessionToken } = await response.json();
          // await supabase.auth.setSession(sessionToken);

          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Autentiseringen misslyckades'
        );
      }
    };

    // Wait a moment for OIDC to process the callback
    if (!oidcAuth.isLoading) {
      handleCallback();
    }
  }, [oidcAuth.isLoading, oidcAuth.isAuthenticated, oidcAuth.user, oidcAuth.error, navigate]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-4">
          <h1 className="text-xl font-bold text-destructive">
            Autentisering misslyckades
          </h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <a
            href="/"
            className="inline-block text-sm underline hover:no-underline"
          >
            Tillbaka till startsidan
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-2">
        <div className="text-muted-foreground">Verifierar din identitet...</div>
        <div className="text-xs text-muted-foreground">
          Du omdirigeras automatiskt.
        </div>
      </div>
    </div>
  );
}
