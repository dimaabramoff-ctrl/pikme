import { apiClient } from '../../../shared/api/client'
import type { ListResponse, MasterSummary } from '../../../shared/api/types'

export const masterApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.request<ListResponse<MasterSummary>>('/masters', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      params,
    }),
  getById: (id: string) => apiClient.request<MasterSummary>(`/masters/${id}`),
}
