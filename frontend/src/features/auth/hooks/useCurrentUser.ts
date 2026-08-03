import { useQuery } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../authStore'

export function useCurrentUser() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser)
  const setAuthResolved = useAuthStore((state) => state.setAuthResolved)

  return useQuery({
    queryKey: ['auth', 'me', accessToken],
    queryFn: async () => {
      const user = await authApi.me()
      setCurrentUser(user)
      setAuthResolved(true)
      return user
    },
    enabled: Boolean(accessToken),
    retry: false,
  })
}
