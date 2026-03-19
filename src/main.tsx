import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { oidcConfig } from '@/lib/auth';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import './index.css';
import App from './App';

console.log('[Auth Init] OIDC authority:', import.meta.env.VITE_OIDC_AUTHORITY);
console.log('[Auth Init] Client ID:', import.meta.env.VITE_SCRIVE_CLIENT_ID);
console.log('[Auth Init] Client secret set:', !!import.meta.env.VITE_SCRIVE_CLIENT_SECRET);

function Root() {
  if (!import.meta.env.VITE_SCRIVE_CLIENT_ID) {
    console.error(
      '[Auth] VITE_SCRIVE_CLIENT_ID is missing or empty in .env — OIDC cannot initialize.'
    );
    return (
      <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Auth ej konfigurerad</h1>
        <p>
          <code>VITE_SCRIVE_CLIENT_ID</code> saknas i <code>.env</code>.
          Se konsolen för detaljer.
        </p>
      </div>
    );
  }

  return (
    <AuthProvider {...oidcConfig}>
      <AuthContextProvider>
        <App />
        <Toaster />
      </AuthContextProvider>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
