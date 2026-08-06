import { useAuthStore } from '../auth/authStore'
import { PartnerOnboarding } from './PartnerOnboarding'

const ALLOWED_ROLES = ['SALON_OWNER', 'SALON_ADMIN', 'SUPER_ADMIN'] as const

export function PartnerOnboardingGuard() {
  const { currentUser, authStatus } = useAuthStore()

  if (authStatus === 'initializing') {
    return <div className="rounded-2xl bg-white p-4 shadow-sm text-sm text-slate-500">Sitzung wird geprüft...</div>
  }

  if (!currentUser) {
    return <div className="rounded-2xl bg-white p-4 shadow-sm text-sm text-slate-500">Zugriff wird geprüft...</div>
  }

  if (!ALLOWED_ROLES.includes(currentUser.role as typeof ALLOWED_ROLES[number])) {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-sm text-center space-y-3">
        <p className="text-lg font-semibold text-slate-800">Zugriff eingeschränkt</p>
        <p className="text-sm text-slate-500">Sie haben derzeit keinen Zugriff auf die Unternehmensverwaltung in PickMe.</p>
        <p className="text-xs text-slate-400">Aktivieren Sie einen Zugangscode, um die Inhaberrolle zu erhalten.</p>
      </div>
    )
  }

  return <PartnerOnboarding />
}
