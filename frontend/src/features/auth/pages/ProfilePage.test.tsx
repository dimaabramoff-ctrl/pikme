import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { bookingApi } from '../../bookings/api/bookingApi'

vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(),
}))

vi.mock('../hooks/useLogout', () => ({
  useLogout: () => ({ mutateAsync: vi.fn(async () => undefined) }),
}))

vi.mock('../../bookings/api/bookingApi', () => ({
  bookingApi: {
    getMyBookings: vi.fn(),
  },
}))

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: {
        id: 'user-1',
        name: 'Mina Muster',
        email: 'mina@example.test',
        phone: '+491701234567',
        role: 'CUSTOMER',
        isActive: true,
        isVerified: true,
      },
      isLoading: false,
      isError: false,
    } as never)

    vi.mocked(bookingApi.getMyBookings).mockResolvedValue([
      {
        id: 'booking-1',
        customerProfileId: 'customer-1',
        masterId: 'master-1',
        salonId: 'salon-1',
        serviceId: 'Haarschnitt',
        startsAt: '2026-08-10T10:00:00.000Z',
        endsAt: '2026-08-10T11:00:00.000Z',
        totalPrice: '45',
        currency: 'EUR',
        status: 'CONFIRMED',
      },
    ])
  })

  it('renders the customer bookings section', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Meine Buchungen')).toBeInTheDocument()
    expect(await screen.findByText('Haarschnitt')).toBeInTheDocument()
    expect(await screen.findByText('Gesamt: 45 EUR')).toBeInTheDocument()
    expect(await screen.findByText('Status: Bestätigt')).toBeInTheDocument()
  })
})
