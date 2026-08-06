import { create } from 'zustand'

interface AdminModeState {
  enabled: boolean
  setEnabled: (value: boolean) => void
  toggle: () => void
}

const STORAGE_KEY = 'pickme:super-admin-mode'

function readInitialValue() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(STORAGE_KEY) === '1'
}

export const useAdminModeStore = create<AdminModeState>((set, get) => ({
  enabled: readInitialValue(),
  setEnabled: (value) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    }
    set({ enabled: value })
  },
  toggle: () => {
    const next = !get().enabled
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    }
    set({ enabled: next })
  },
}))
