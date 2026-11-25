import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { bankIDOidcClient } from '@/lib/auth';
import { readBankIDCallback } from '@/lib/bankid-flow';

export function AuthCallback() {
  const { completeBankIDLogin } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const url = window.location.href;
    window.history.replaceState(window.history.state, '', window.location.pathname);

    const handleCallback = async () => {
      try {
        const proof = await readBankIDCallback(bankIDOidcClient, url);
        await completeBankIDLogin(proof);
        navigate('/dashboard', { replace: true });
      } catch {
        setError('BankID-inloggningen kunde inte slutföras. Starta en ny inloggning.');
      }
    };

    void handleCallback();
  }, [navigate, completeBankIDLogin]);

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
