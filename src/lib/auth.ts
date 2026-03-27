import { WebStorageStateStore } from 'oidc-client-ts';

export const oidcConfig = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY || '',
  client_id: import.meta.env.VITE_SCRIVE_CLIENT_ID || '',
  client_secret: import.meta.env.VITE_SCRIVE_CLIENT_SECRET || undefined,
  redirect_uri: import.meta.env.DEV
    ? 'http://localhost:5173/callback'
    : 'https://entreprenorensdashboard.vercel.app/callback',
  scope: 'openid',
  response_type: 'code' as const,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
};
