import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root';
import './index.css';

console.log('[Auth Init] OIDC authority:', import.meta.env.VITE_OIDC_AUTHORITY);
console.log('[Auth Init] Client ID:', import.meta.env.VITE_SIGNICAT_CLIENT_ID);
console.log('[Auth Init] Mode: PKCE Public Client (inget client_secret i frontend)');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
