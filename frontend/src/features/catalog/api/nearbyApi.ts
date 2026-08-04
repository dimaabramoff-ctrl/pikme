import { apiClient } from '../../../shared/api/client'

export interface NearbyCatalogItem {
  id: string
  source: 'PICKME' | 'EXTERNAL'
  externalProvider?: string | null
  externalPlaceId?: string | null
  name: string
  category?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  distanceKm?: number | null
  rating?: number | null
  reviewCount?: number | null
  openNow?: boolean | null
  photoUrl?: string | null
  externalUrl?: string | null
  phone?: string | null
  isPickmeConnected: boolean
  isBookable?: boolean
  isVerified?: boolean
}

export const nearbyApi = {
  list: (params: { latitude: number; longitude: number; radius?: number; query?: string; category?: string; limit?: number }) =>
    apiClient.request<NearbyCatalogItem[]>('/catalog/nearby', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      params,
    }),
}
