import { create } from 'zustand'

type EntityFilter = 'ALL' | 'SALON' | 'MASTER'
type ViewMode = 'LIST' | 'MAP'

interface UiState {
  viewMode: ViewMode
  entityFilter: EntityFilter
  setViewMode: (next: ViewMode) => void
  setEntityFilter: (next: EntityFilter) => void
}

export const useUiStore = create<UiState>((set) => ({
  viewMode: 'LIST',
  entityFilter: 'SALON',
  setViewMode: (next) => set({ viewMode: next }),
  setEntityFilter: (next) => set({ entityFilter: next }),
}))
