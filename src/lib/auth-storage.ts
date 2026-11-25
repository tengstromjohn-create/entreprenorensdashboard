import type { Session } from '@supabase/supabase-js'

type WebStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type StoredAuth = Partial<Session> & { bankIDSessionId?: string }

function parseAuth(value: string | null): StoredAuth | null {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function isBankIDAccount(auth: StoredAuth | null): boolean {
  const metadata = auth?.user?.app_metadata
  return typeof metadata?.bankid_identity_key === 'string' || typeof metadata?.bankid_session_id === 'string'
}

function tokenSessionId(token?: string): string | null {
  try {
    const payload = token?.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/')
    const id: unknown = payload && JSON.parse(atob(payload)).session_id
    return typeof id === 'string' && id.length > 0 ? id : null
  } catch {
    return null
  }
}

// Visningsstatus. Avtalsfunktionen verifierar tokenen och läser aktuell app_metadata hos Auth.
export function getBankIDSessionId(session: Session | null): string | null {
  const id = tokenSessionId(session?.access_token)
  return id && session?.user?.app_metadata?.bankid_session_id === id ? id : null
}

export function createAuthStorage(authKey: string, shared: WebStorage, tab: WebStorage) {
  return {
    getItem(key) {
      const value = shared.getItem(key)
      if (key !== authKey) return value

      const stored = parseAuth(value)
      if (stored?.bankIDSessionId) {
        const tabValue = tab.getItem(key)
        if (tokenSessionId(parseAuth(tabValue)?.access_token) === stored.bankIDSessionId) return tabValue
      }

      tab.removeItem(key)
      if (isBankIDAccount(stored)) {
        // Äldre versioner sparade hela BankID-sessionen i localStorage.
        shared.removeItem(key)
        return null
      }
      return stored?.bankIDSessionId ? null : value
    },
    setItem(key, value) {
      const stored = parseAuth(value)
      if (key === authKey && isBankIDAccount(stored)) {
        const id = tokenSessionId(stored?.access_token)
        if (!id) throw new Error('BankID-sessionen saknar sessions-id')
        tab.setItem(key, value)
        // Flikarna delar bara sessions-id så att ett kontobyte kan ersätta föregående session.
        shared.setItem(key, JSON.stringify({ bankIDSessionId: id }))
        return
      }
      if (key === authKey) tab.removeItem(key)
      shared.setItem(key, value)
    },
    removeItem(key) {
      if (key === authKey) tab.removeItem(key)
      shared.removeItem(key)
    },
    readSession(): Session | null {
      const session = parseAuth(this.getItem(authKey))
      return session?.user?.id && session.access_token && session.refresh_token ? session as Session : null
    },
  } satisfies WebStorage & { readSession(): Session | null }
}
