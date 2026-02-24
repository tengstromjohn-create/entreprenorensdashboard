import { WebStorageStateStore } from 'oidc-client-ts';

export const oidcConfig = {
  authority:
    import.meta.env.VITE_SCRIVE_OIDC_AUTHORITY ||
    'https://testbed-eid.scrive.com/oidc',
  client_id: import.meta.env.VITE_SCRIVE_CLIENT_ID || '',
  redirect_uri: `${window.location.origin}/auth/callback`,
  scope: 'openid profile',
  response_type: 'code' as const,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  extraQueryParams: { acr_values: 'urn:scrive:eid:se:bankid' },
};
