import { apiClient } from '../../../shared/api/client'

export interface NotificationSummary {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  readAt: string | null
  payload: Record<string, unknown> | null
}

export const notificationsApi = {
  list: () => apiClient.request<NotificationSummary[]>('/notifications', { method: 'GET' }),
  unreadCount: () => apiClient.request<number>('/notifications/unread-count', { method: 'GET' }),
  markRead: (id: string) => apiClient.request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => apiClient.request(`/notifications/read-all`, { method: 'PATCH' }),
}