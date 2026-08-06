import { create } from 'zustand'
import type { CurrentUser } from './authTypes'

interface AuthState {
  accessToken: string | null
  currentUser: CurrentUser | null
  isAuthResolved: boolean
  authStatus: 'initializing' | 'authenticated' | 'unauthenticated'
  setAccessToken: (token: string | null) => void
  setCurrentUser: (user: CurrentUser | null) => void
  setAuthResolved: (value: boolean) => void
  setAuthStatus: (status: 'initializing' | 'authenticated' | 'unauthenticated') => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  currentUser: null,
  isAuthResolved: false,
  authStatus: 'initializing',
  setAccessToken: (token) => set({ accessToken: token }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setAuthResolved: (value) => set({ isAuthResolved: value }),
  setAuthStatus: (status) => set({ authStatus: status }),
  clearAuth: () => set({ accessToken: null, currentUser: null, isAuthResolved: true, authStatus: 'unauthenticated' }),
}))
