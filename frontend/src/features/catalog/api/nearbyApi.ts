import { apiClient } from '../../../shared/api/client'
import type { NearbyCatalogItem } from '@pickme/api-types'

export type { NearbyCatalogItem }

export const nearbyApi = {
  list: (params: { latitude: number; longitude: number; radius?: number; query?: string; category?: string; limit?: number }) =>
    apiClient.request<NearbyCatalogItem[]>('/catalog/nearby', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      params,
    }),
}
