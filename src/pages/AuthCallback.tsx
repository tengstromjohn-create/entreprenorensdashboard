import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth as useOidcAuth } from 'react-oidc-context';
import { useAuth } from '@/contexts/AuthContext';

export function AuthCallback() {
  const oidcAuth = useOidcAuth();
  const { completeBankIDLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // PKCE-callbacken kan rendera om flera gånger — kör hanteringen exakt en gång
  const handledRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // oidc-client-ts hanterar code/PKCE-utbytet automatiskt; här tar vi vid
        // när användaren är autentiserad.

        if (oidcAuth.error) {
          setError(oidcAuth.error.message);
          return;
        }

        if (oidcAuth.isAuthenticated && oidcAuth.user && !handledRef.current) {
          handledRef.current = true;

          const { id_token: idToken, access_token: accessToken } = oidcAuth.user;
          if (!idToken || !accessToken) {
            setError('BankID-svaret saknade inloggningsbevis.');
            return;
          }

          await completeBankIDLogin(idToken, accessToken);

          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Autentiseringen misslyckades'
        );
      }
    };

    if (!oidcAuth.isLoading) {
      handleCallback();
    }
  }, [oidcAuth.isLoading, oidcAuth.isAuthenticated, oidcAuth.user, oidcAuth.error, navigate, completeBankIDLogin]);

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
