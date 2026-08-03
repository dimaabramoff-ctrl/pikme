import { create } from 'zustand'
import type { CurrentUser } from './authTypes'

interface AuthState {
  accessToken: string | null
  currentUser: CurrentUser | null
  isAuthResolved: boolean
  setAccessToken: (token: string | null) => void
  setCurrentUser: (user: CurrentUser | null) => void
  setAuthResolved: (value: boolean) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  currentUser: null,
  isAuthResolved: false,
  setAccessToken: (token) => set({ accessToken: token }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthResolved: (value) => set({ isAuthResolved: value }),
  clearAuth: () => set({ accessToken: null, currentUser: null, isAuthResolved: true }),
}))
