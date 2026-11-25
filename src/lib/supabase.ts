import { createClient, navigatorLock } from '@supabase/supabase-js'
import { createAuthStorage } from '@/lib/auth-storage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
export const authStorage = createAuthStorage(authStorageKey, window.localStorage, window.sessionStorage)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // En tom SDK-nyckel stänger av BroadcastChannel, som annars skickar hela sessionen.
    // Behåll repots lagringsnyckel och lås för förnyelse mellan flikar.
    storageKey: '',
    storage: {
      getItem: (key) => authStorage.getItem(authStorageKey + key),
      setItem: (key, value) => authStorage.setItem(authStorageKey + key, value),
      removeItem: (key) => authStorage.removeItem(authStorageKey + key),
    },
    lock: navigator.locks ? (_, timeout, run) => navigatorLock(`lock:${authStorageKey}`, timeout, run) : undefined,
  },
})
