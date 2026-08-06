import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'

export function ProtectedRoute() {
  const location = useLocation()
  const authStatus = useAuthStore((state) => state.authStatus)
  const user = useAuthStore((state) => state.currentUser)

  if (authStatus === 'initializing') {
    return <div className="rounded-2xl bg-white p-4 shadow-sm">Sitzung wird geprüft...</div>
  }

  if (!user) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
