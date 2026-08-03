import { apiClient } from '../../../shared/api/client'

export interface NearbyCatalogItem {
  id: string
  sourceType: 'PICKME' | 'EXTERNAL'
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
  openingStatus?: string | null
  photoReference?: string | null
  phone?: string | null
  isBookable?: boolean
  isPrivate?: boolean
  isVerified?: boolean
}

export const nearbyApi = {
  list: (params: { latitude: number; longitude: number; radiusKm?: number; query?: string; category?: string; limit?: number }) =>
    apiClient.request<NearbyCatalogItem[]>('/catalog/nearby', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      params,
    }),
}
