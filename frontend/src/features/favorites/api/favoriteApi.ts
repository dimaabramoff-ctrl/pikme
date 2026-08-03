import { apiClient } from '../../../shared/api/client'
import type { FavoritesResponse } from '../../../shared/api/types'

export const favoriteApi = {
  list: () => apiClient.request<FavoritesResponse>('/favorites'),
  addSalon: (salonId: string) => apiClient.request<FavoritesResponse>(`/favorites/salons/${salonId}`, { method: 'POST' }),
  removeSalon: (salonId: string) => apiClient.request<FavoritesResponse>(`/favorites/salons/${salonId}`, { method: 'DELETE' }),
  addMaster: (masterId: string) => apiClient.request<FavoritesResponse>(`/favorites/masters/${masterId}`, { method: 'POST' }),
  removeMaster: (masterId: string) => apiClient.request<FavoritesResponse>(`/favorites/masters/${masterId}`, { method: 'DELETE' }),
}
