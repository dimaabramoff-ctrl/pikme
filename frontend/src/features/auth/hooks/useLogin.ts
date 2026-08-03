import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../authStore'

export function useLogin() {
  const queryClient = useQueryClient()
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser)
  const setAuthResolved = useAuthStore((state) => state.setAuthResolved)

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (result) => {
      setAccessToken(result.accessToken)
      setCurrentUser(result.user)
      setAuthResolved(true)
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })
}
