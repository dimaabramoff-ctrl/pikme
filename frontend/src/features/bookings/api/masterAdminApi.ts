import { apiClient } from '../../../shared/api/client'

export interface PartnerAccessRequestSummary {
  id: string
  contactName: string
  salonName: string
  city: string
  phone: string
  email: string
  message?: string | null
  requestedDuration: string
  status: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown> | null
}

export interface ModerationUserSummary {
  id: string
  email: string
  phone: string
  role: string
  isActive: boolean
  accountStatus: string
  accountStatusReason?: string | null
  accountStatusUpdatedAt?: string | null
  deletionRequestedAt?: string | null
  anonymizedAt?: string | null
  lastActivityAt?: string | null
  isVerified: boolean
  createdAt: string
  updatedAt: string
  customerProfile?: { firstName?: string; lastName?: string } | null
  masterProfile?: { displayName?: string } | null
}

export const masterAdminApi = {
  listRequests: () => apiClient.request<PartnerAccessRequestSummary[]>('/admin/partner-access-requests', { method: 'GET' }),

  updateRequestStatus: (id: string, status: string, reason?: string) =>
    apiClient.request<PartnerAccessRequestSummary>(`/admin/partner-access-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),

  createAccessCode: (id: string) =>
    apiClient.request<{ code: string; voucherId: string }>(`/admin/partner-access-requests/${id}/create-access-code`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  listUsers: () => apiClient.request<ModerationUserSummary[]>('/admin/users', { method: 'GET' }),

  moderateUser: (id: string, action: string, reason?: string) =>
    apiClient.request<{ success: boolean }>(`/admin/users/${id}/moderate?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  changeRole: (id: string, role: string, reason?: string) =>
    apiClient.request<{ success: boolean }>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role, reason }),
    }),
}
