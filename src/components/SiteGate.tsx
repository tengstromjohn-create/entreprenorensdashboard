import { useState, useEffect, type ReactNode, type FormEvent } from 'react'
import { Lock, ArrowRight } from 'lucide-react'

const STORAGE_KEY = 'grundat_site_access'

function hashCode(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return String(hash)
}

export function SiteGate({ children }: { children: ReactNode }) {
  const sitePassword = import.meta.env.VITE_SITE_PASSWORD
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(true)

  // If no password is set, skip the gate entirely
  useEffect(() => {
    if (!sitePassword) {
      setUnlocked(true)
      setChecking(false)
      return
    }
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored === hashCode(sitePassword)) {
      setUnlocked(true)
    }
    setChecking(false)
  }, [sitePassword])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (input === sitePassword) {
      sessionStorage.setItem(STORAGE_KEY, hashCode(sitePassword))
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
      setInput('')
    }
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAFAF8]">
        <p className="text-sm text-gray-400">Laddar...</p>
      </div>
    )
  }

  if (unlocked) return <>{children}</>

  return (
    <div className="flex h-screen items-center justify-center bg-[#FAFAF8] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-white rounded-full p-4 shadow-sm border border-gray-100 mb-4">
            <Lock size={24} className="text-[#2D3436]" />
          </div>
          <h1 className="text-xl font-bold text-[#2D3436]">Grundat.ai</h1>
          <p className="text-sm text-gray-400 mt-1">Plattformen är under uppbyggnad</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false) }}
            placeholder="Ange åtkomstkod"
            autoFocus
            className={`w-full rounded-lg border bg-white px-4 py-3 text-sm text-[#2D3436] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2D3436]/20 transition-colors ${
              error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-[#2D3436]'
            }`}
          />
          {error && (
            <p className="text-xs text-red-500">Fel åtkomstkod. Försök igen.</p>
          )}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-[#2D3436] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#3d4446] transition-colors"
          >
            Öppna
            <ArrowRight size={16} />
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-6">
          Kontakta John Tengström för åtkomst
        </p>
      </div>
    </div>
  )
}
