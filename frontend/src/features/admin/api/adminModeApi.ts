import { apiClient } from '../../../shared/api/client'

interface AuditLogItem {
  id: string
  action: string
  entityType: string
  entityId: string | null
  reason: string | null
  createdAt: string
  actor?: {
    id: string
    email: string
    role: string
  }
  actorUser?: {
    id: string
    email: string
    role: string
  }
}

export const adminModeApi = {
  setSalonProfileActive: (salonId: string, active: boolean, reason?: string) =>
    apiClient.request<{ success: boolean; isActive: boolean }>(`/admin/salons/${salonId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify({ active, reason }),
    }),

  setSalonAccessLocked: (salonId: string, locked: boolean, reason?: string) =>
    apiClient.request<{ success: boolean; openingStatus: string }>(`/admin/salons/${salonId}/access`, {
      method: 'PATCH',
      body: JSON.stringify({ locked, reason }),
    }),

  setMasterProfileActive: (masterId: string, active: boolean, reason?: string) =>
    apiClient.request<{ success: boolean; acceptsBookings: boolean }>(`/admin/masters/${masterId}/profile`, {
      method: 'PATCH',
      body: JSON.stringify({ active, reason }),
    }),

  editMasterProfile: (
    masterId: string,
    payload: {
      displayName?: string
      specialization?: string
      biography?: string
      acceptsHomeVisits?: boolean
      homeVisitRadiusKm?: number
      currentStatus?: 'AVAILABLE' | 'SOON_AVAILABLE' | 'BUSY' | 'OFFLINE'
      reason?: string
    },
  ) =>
    apiClient.request<{ success: boolean }>(`/admin/masters/${masterId}/edit`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  setUserAccessLocked: (userId: string, locked: boolean, reason?: string) =>
    apiClient.request<{ success: boolean; isActive: boolean }>(`/admin/users/${userId}/access`, {
      method: 'PATCH',
      body: JSON.stringify({ locked, reason }),
    }),

  setSalonTrialEnabled: (salonId: string, enabled: boolean, days?: number, reason?: string) =>
    apiClient.request<{ success: boolean; trialEnabled: boolean }>(`/admin/salons/${salonId}/trial`, {
      method: 'POST',
      body: JSON.stringify({ enabled, days, reason }),
    }),

  resetScope: (scope: 'DEMO_SALON' | 'DEMO_ZUHAUSE' | 'TESTBETRIEB', reason?: string) =>
    apiClient.request<{ success: boolean; scope: string }>('/admin/test-data/reset', {
      method: 'POST',
      body: JSON.stringify({ confirm: true, scope, reason }),
    }),

  getAuditLogs: (input: { entityType?: string; entityId?: string; limit?: number }) =>
    apiClient.request<{ items: AuditLogItem[] }>('/admin/audit-logs', {
      method: 'GET',
      params: input,
    }),
}
