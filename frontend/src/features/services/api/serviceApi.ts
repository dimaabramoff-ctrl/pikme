import { apiClient } from '../../../shared/api/client'
import type { ServiceListResponse, ServiceSummary } from '../../../shared/api/types'

export const serviceApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.request<ServiceListResponse>('/services', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      params,
    }),
  getById: (id: string) => apiClient.request<ServiceSummary>(`/services/${id}`),
}
