import { apiClient } from '../../../shared/api/client'

export interface AdminBookingSummary {
  id: string
  bookingNumber: string
  customerName: string
  masterName: string
  salonName: string | null
  serviceName: string
  startsAt: string
  endsAt: string
  status: string
  totalPrice: string
  currency: string
}

export const adminBookingsApi = {
  list: () => apiClient.request<AdminBookingSummary[]>('/bookings/admin/all', { method: 'GET' }),
  confirm: (bookingId: string) => apiClient.request(`/bookings/${bookingId}/confirm`, { method: 'PATCH' }),
  cancel: (bookingId: string, reason?: string) =>
    apiClient.request(`/bookings/${bookingId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  reject: (bookingId: string, reason?: string) =>
    apiClient.request(`/bookings/${bookingId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
  complete: (bookingId: string) => apiClient.request(`/bookings/${bookingId}/complete`, { method: 'PATCH' }),
  noShow: (bookingId: string) => apiClient.request(`/bookings/${bookingId}/no-show`, { method: 'PATCH' }),
  reschedule: (bookingId: string, startsAt: string, reason?: string) =>
    apiClient.request(`/bookings/${bookingId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ startsAt, reason }),
    }),
}