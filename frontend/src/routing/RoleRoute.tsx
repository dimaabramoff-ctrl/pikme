import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'
import type { UserRole } from '../features/auth/authTypes'

interface RoleRouteProps {
  allowedRoles: UserRole[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const authStatus = useAuthStore((state) => state.authStatus)
  const user = useAuthStore((state) => state.currentUser)

  if (authStatus === 'initializing') {
    return <div className="rounded-2xl bg-white p-4 shadow-sm">Zugriff wird geprüft...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/profile" replace state={{ forbidden: true }} />
  }

  return <Outlet />
}
