import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../authStore'

export function useLogout() {
  const queryClient = useQueryClient()
  const clearAuth = useAuthStore((state) => state.clearAuth)

  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: async () => {
      clearAuth()
      await queryClient.clear()
    },
  })
}
