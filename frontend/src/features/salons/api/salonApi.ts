import { apiClient } from '../../../shared/api/client'
import type {
  ListResponse,
  SalonEditorDraftPayload,
  SalonEditorDraftSaveResponse,
  SalonEditorPublishResponse,
  SalonEditorStateResponse,
  SalonSummary,
} from '../../../shared/api/types'

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
  getEditorState: (salonId: string) => apiClient.request<SalonEditorStateResponse>(`/salons/${salonId}/editor`),
  saveDraft: (salonId: string, draft: SalonEditorDraftPayload) =>
    apiClient.request<SalonEditorDraftSaveResponse>(`/salons/${salonId}/editor/draft`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    }),
  publishDraft: (salonId: string) =>
    apiClient.request<SalonEditorPublishResponse>(`/salons/${salonId}/editor/publish`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}
