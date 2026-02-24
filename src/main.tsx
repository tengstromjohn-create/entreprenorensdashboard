import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from 'react-oidc-context';
import { oidcConfig } from '@/lib/auth';
import { AuthContextProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider {...oidcConfig}>
      <AuthContextProvider>
        <App />
        <Toaster />
      </AuthContextProvider>
    </AuthProvider>
  </StrictMode>
);
