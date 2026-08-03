import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'

export function ProtectedRoute() {
  const location = useLocation()
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved)
  const user = useAuthStore((state) => state.currentUser)

  if (!isAuthResolved) {
    return <div className="rounded-2xl bg-white p-4 shadow-sm">Проверяем сессию...</div>
  }

  if (!user) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
