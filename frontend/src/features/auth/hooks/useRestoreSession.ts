import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../authStore'

export function useRestoreSession() {
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser)
  const setAuthResolved = useAuthStore((state) => state.setAuthResolved)
  const setAuthStatus = useAuthStore((state) => state.setAuthStatus)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const query = useQuery({
    queryKey: ['auth', 'restore'],
    queryFn: async () => {
      try {
        const result = await authApi.refresh()
        setAccessToken(result.accessToken)
        try {
          const fullUser = await authApi.me()
          setCurrentUser(fullUser)
        } catch {
          setCurrentUser(result.user)
        }
        setAuthResolved(true)
        setAuthStatus(result.user ? 'authenticated' : 'unauthenticated')
        return result
      } catch (error) {
        setCurrentUser(null)
        setAuthResolved(true)
        setAuthStatus('unauthenticated')
        throw error
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
    meta: { skipAuthRefresh: true },
  })

  useEffect(() => {
    if (query.isPending) {
      setAuthStatus('initializing')
      return
    }

    if (query.isError) {
      clearAuth()
      return
    }

    if (query.data?.user) {
      setAuthStatus('authenticated')
    } else {
      setAuthStatus('unauthenticated')
    }
  }, [clearAuth, query.data?.user, query.isError, query.isPending, setAuthStatus])

  return query
}
