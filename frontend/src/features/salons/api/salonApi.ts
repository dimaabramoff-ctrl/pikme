import { apiClient } from '../../../shared/api/client'
import type { ListResponse, SalonSummary } from '../../../shared/api/types'

export const salonApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.request<ListResponse<SalonSummary>>('/salons', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      params,
    }),
  getById: (id: string) => apiClient.request<SalonSummary>(`/salons/${id}`),
  getBySlug: (slug: string) => apiClient.request<SalonSummary>(`/salons/slug/${slug}`),
}
