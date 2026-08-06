import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'
import { BusinessAccessCodesAdminPage } from './BusinessAccessCodesAdminPage'

export function BusinessAccessCodesAdminGuard() {
  const { currentUser, authStatus } = useAuthStore()

  if (authStatus === 'initializing') {
    return <div className="rounded-2xl bg-white p-4 shadow-sm text-sm text-slate-500">Sitzung wird geprüft...</div>
  }

  if (!currentUser) {
    return <Navigate to="/login?returnTo=/master-admin/business-access-codes" replace />
  }

  if (currentUser.role !== 'SUPER_ADMIN') {
    return (
      <div className="rounded-[28px] bg-white p-6 shadow-sm text-center space-y-3">
        <p className="text-lg font-semibold text-slate-800">Zugriff verweigert</p>
        <p className="text-sm text-slate-500">Der Business-Code-Generator ist nur für Super Admin verfügbar.</p>
      </div>
    )
  }

  return <BusinessAccessCodesAdminPage />
}
