import { apiClient } from '../../../shared/api/client'
import type { ListResponse, ReviewSummary } from '../../../shared/api/types'

export const reviewApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.request<ListResponse<ReviewSummary>>('/reviews', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      params,
    }),
}
