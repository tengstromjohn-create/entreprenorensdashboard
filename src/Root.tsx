import { AuthProvider } from 'react-oidc-context';
import { oidcConfig } from '@/lib/auth';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import { SiteGate } from '@/components/SiteGate';
import App from './App';

export function Root() {
  if (!import.meta.env.VITE_SIGNICAT_CLIENT_ID) {
    console.error(
      '[Auth] VITE_SIGNICAT_CLIENT_ID is missing or empty in .env — OIDC cannot initialize.'
    );
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Auth ej konfigurerad</h1>
        <p>
          <code>VITE_SIGNICAT_CLIENT_ID</code> saknas i <code>.env</code>.
          Se konsolen för detaljer.
        </p>
      </div>
    );
  }

  return (
    <SiteGate>
      <AuthProvider {...oidcConfig}>
        <AuthContextProvider>
          <App />
          <Toaster />
        </AuthContextProvider>
      </AuthProvider>
    </SiteGate>
  );
}
