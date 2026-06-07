import { WebStorageStateStore } from 'oidc-client-ts';

/**
 * OIDC-konfiguration för Signicat eID Hub.
 *
 * Säkerhetsmodell: Public Client + PKCE (S1, 2026-05-17).
 * `client_secret` finns INTE i frontend — Vite skulle exponera den till klient-bundlen.
 * PKCE aktiveras automatiskt av oidc-client-ts när `response_type: 'code'` och inget secret ges.
 *
 * Tenant: astra-advokater.sandbox.signicat.com (sandbox per 2026-05-17).
 * Redirect URIs konfigureras i Signicat-portalen — alla tre måste vara aktiva:
 *   - http://localhost:5173/callback           (dev)
 *   - https://entreprenorensdashboard.vercel.app/callback  (Vercel preview)
 *   - https://grundat.ai/callback              (produktion)
 */
export const oidcConfig = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY || '',
  client_id: import.meta.env.VITE_SIGNICAT_CLIENT_ID || '',
  redirect_uri: import.meta.env.DEV
    ? 'http://localhost:5173/callback'
    : 'https://grundat.ai/callback',
  scope: 'openid profile nin',
  response_type: 'code' as const,
  // PKCE: automatiskt aktiverat när client_secret saknas och response_type är 'code'.
  // code_challenge_method 'S256' är default i oidc-client-ts v3.
  // Signicat levererar nin/namn via UserInfo-endpointen, INTE i id_token. Med loadUserInfo:true
  // hämtar oidc-client-ts UserInfo och mergar claims in i user.profile efter callbacken.
  loadUserInfo: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
};
