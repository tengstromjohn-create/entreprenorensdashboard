import { useAuth } from '@/contexts/AuthContext'
import { TrustBadge } from '@/components/shared/TrustBadge'

export function SettingsPage() {
  const { user, profile, trustLevel, signOut } = useAuth()

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#2D3436]">Inställningar</h1>

      <div className="bg-white rounded-lg border border-gray-100 p-6">
        <h3 className="font-semibold text-[#2D3436] mb-4">Profil</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Namn</span>
            <span className="text-[#2D3436] font-medium">{profile?.display_name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">E-post</span>
            <span className="text-[#2D3436]">{user?.email || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Verifieringsnivå</span>
            <TrustBadge level={trustLevel} size="sm" />
          </div>
          {profile?.org_number && (
            <div className="flex justify-between">
              <span className="text-gray-500">Organisationsnummer</span>
              <span className="text-[#2D3436]">{profile.org_number}</span>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={signOut}
        className="text-sm text-red-600 hover:text-red-700 font-medium"
      >
        Logga ut
      </button>
    </div>
  )
}
