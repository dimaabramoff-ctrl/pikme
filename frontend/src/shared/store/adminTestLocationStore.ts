import { create } from 'zustand'

interface AdminTestLocationState {
  enabled: boolean
  cityLabel: string
  latitude: number
  longitude: number
  radiusMeters: number
  setEnabled: (value: boolean) => void
  setPreset: (input: { cityLabel: string; latitude: number; longitude: number }) => void
  setCoordinates: (input: { latitude: number; longitude: number }) => void
  setRadiusMeters: (value: number) => void
  reset: () => void
}

const STORAGE_KEY = 'pickme:admin-test-location'

const DEFAULT_STATE = {
  enabled: false,
  cityLabel: 'Hamburg',
  latitude: 53.5511,
  longitude: 9.9937,
  radiusMeters: 15000,
}

function readInitialState() {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<AdminTestLocationState>
    return {
      enabled: parsed.enabled === true,
      cityLabel: typeof parsed.cityLabel === 'string' && parsed.cityLabel.trim().length > 0 ? parsed.cityLabel : DEFAULT_STATE.cityLabel,
      latitude: typeof parsed.latitude === 'number' ? parsed.latitude : DEFAULT_STATE.latitude,
      longitude: typeof parsed.longitude === 'number' ? parsed.longitude : DEFAULT_STATE.longitude,
      radiusMeters: typeof parsed.radiusMeters === 'number' ? parsed.radiusMeters : DEFAULT_STATE.radiusMeters,
    }
  } catch {
    return DEFAULT_STATE
  }
}

function persist(state: Pick<AdminTestLocationState, 'enabled' | 'cityLabel' | 'latitude' | 'longitude' | 'radiusMeters'>) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const useAdminTestLocationStore = create<AdminTestLocationState>((set, get) => ({
  ...readInitialState(),
  setEnabled: (value) => {
    const next = { ...get(), enabled: value }
    persist(next)
    set({ enabled: value })
  },
  setPreset: ({ cityLabel, latitude, longitude }) => {
    const next = {
      ...get(),
      cityLabel,
      latitude,
      longitude,
    }
    persist(next)
    set({ cityLabel, latitude, longitude })
  },
  setCoordinates: ({ latitude, longitude }) => {
    const next = {
      ...get(),
      latitude,
      longitude,
    }
    persist(next)
    set({ latitude, longitude })
  },
  setRadiusMeters: (value) => {
    const radiusMeters = Math.max(1000, Math.min(15000, Math.round(value)))
    const next = {
      ...get(),
      radiusMeters,
    }
    persist(next)
    set({ radiusMeters })
  },
  reset: () => {
    persist(DEFAULT_STATE)
    set(DEFAULT_STATE)
  },
}))
