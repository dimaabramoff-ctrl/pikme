import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'
import type { UserRole } from '../features/auth/authTypes'

interface RoleRouteProps {
  allowedRoles: UserRole[]
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const user = useAuthStore((state) => state.currentUser)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/profile" replace state={{ forbidden: true }} />
  }

  return <Outlet />
}
