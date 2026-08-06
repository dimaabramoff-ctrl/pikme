import { apiClient } from '../../../shared/api/client'
import type {
  BookingSlotsResponse,
  BookingQuotePayload,
  BookingQuoteResponse,
  BookingSummary,
  CreateBookingPayload,
  SalonPartnerBookingSummary,
} from '../../../shared/api/types'

export const bookingApi = {
  getSlots: (params: {
    salonId: string
    serviceId: string
    serviceIds?: string
    date: string
    masterId?: string
  }) =>
    apiClient.request<BookingSlotsResponse>('/bookings/slots', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      params,
    }),

  create: (payload: CreateBookingPayload) =>
    apiClient.request<BookingSummary>('/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }),

  quote: (payload: BookingQuotePayload) =>
    apiClient.request<BookingQuoteResponse>('/bookings/quote', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    }),

  getMyBookings: () =>
    apiClient.request<BookingSummary[]>('/bookings/my', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }),

  getSalonOrders: (salonId: string) =>
    apiClient.request<SalonPartnerBookingSummary[]>(`/bookings/salon/${salonId}/orders`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    }),
}
