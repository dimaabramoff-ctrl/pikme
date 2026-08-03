import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../authStore'

export function useRestoreSession() {
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser)
  const setAuthResolved = useAuthStore((state) => state.setAuthResolved)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const query = useQuery({
    queryKey: ['auth', 'restore'],
    queryFn: async () => {
      const result = await authApi.refresh()
      setAccessToken(result.accessToken)
      setCurrentUser(result.user)
      setAuthResolved(true)
      return result
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
    meta: { skipAuthRefresh: true },
  })

  useEffect(() => {
    if (query.isError) {
      clearAuth()
    }
  }, [clearAuth, query.isError])

  return query
}
