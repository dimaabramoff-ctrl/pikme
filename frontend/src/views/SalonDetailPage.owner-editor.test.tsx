import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'
import { SalonDetailPage } from './SalonDetailPage'

vi.mock('../shared/demo/presentationData', async () => {
  const actual = await vi.importActual<typeof import('../shared/demo/presentationData')>('../shared/demo/presentationData')
  return {
    ...actual,
    PRESENTATION_MODE: false,
  }
})

vi.mock('../features/salons/api/salonApi', () => ({
  salonApi: {
    getById: vi.fn(async () => ({
      id: 'salon-1',
      name: 'Studio Nord',
      description: 'Beste Schnitte in Berlin',
      sourceType: 'PICKME',
      addressLine: 'Testweg 1',
      city: 'Berlin',
      postalCode: '10115',
      phone: '+49 30 111111',
      ratingAverage: 4.7,
      reviewCount: 12,
      homeVisitEnabled: false,
      openingHoursJson: { displayText: 'Mo-Fr 09:00 - 18:00' },
      photos: [{ id: 'photo-1', imageUrl: 'https://img/1.jpg', sortOrder: 0 }],
    })),
    getEditorState: vi.fn(async () => ({
      salonId: 'salon-1',
      draft: {
        overview: {
          name: 'Studio Nord',
          businessType: 'Friseursalon',
          tagline: 'Beste Schnitte in Berlin',
          description: 'Beste Schnitte in Berlin',
          phone: '+49 30 111111',
          email: 'studio@example.test',
          website: 'https://studio.example.test',
          addressLine: 'Testweg 1',
          city: 'Berlin',
          postalCode: '10115',
          openingHoursText: 'Mo-Fr 09:00 - 18:00',
          languages: ['DE'],
          amenities: ['WLAN'],
          parking: 'Hinterhof',
          accessibility: 'Ebenerdig',
          paymentMethods: ['IN_SALON', 'CARD'],
          foundedYear: 2020,
        },
        moreInfo: {
          about: 'Beste Schnitte in Berlin',
          history: 'Seit 2020',
          serviceDirections: ['Haarschnitte'],
          rules: ['Termin absagen'],
          teamNote: 'Kleines Team',
        },
        services: [{
          id: 'service-1',
          name: 'Herrenschnitt',
          description: 'Kurz',
          category: 'Herren',
          basePrice: 27,
          durationMinutes: 30,
          availableInSalon: true,
          availableAtHome: false,
          isActive: true,
        }],
        staff: [{
          id: 'master-1',
          displayName: 'Anna',
          specialization: 'Coloration',
          biography: 'Bio',
          experienceYears: 5,
          acceptsHomeVisits: false,
          currentStatus: 'AVAILABLE',
          avatarUrl: '',
          serviceIds: ['service-1'],
          schedules: [{
            dayOfWeek: 1,
            shiftStart: '09:00',
            shiftEnd: '18:00',
            isDayOff: false,
            acceptsBookings: true,
            acceptsUrgentBookings: true,
            supportsHomeVisits: false,
            breaks: [],
          }],
        }],
        photos: [{ id: 'photo-1', imageUrl: 'https://img/1.jpg', sortOrder: 0 }],
        coverPhotoId: 'photo-1',
      },
      published: {
        overview: {
          name: 'Studio Nord',
          businessType: 'Friseursalon',
          tagline: 'Beste Schnitte in Berlin',
          description: 'Beste Schnitte in Berlin',
          phone: '+49 30 111111',
          email: 'studio@example.test',
          website: 'https://studio.example.test',
          addressLine: 'Testweg 1',
          city: 'Berlin',
          postalCode: '10115',
          openingHoursText: 'Mo-Fr 09:00 - 18:00',
          languages: ['DE'],
          amenities: ['WLAN'],
          parking: 'Hinterhof',
          accessibility: 'Ebenerdig',
          paymentMethods: ['IN_SALON', 'CARD'],
          foundedYear: 2020,
        },
        moreInfo: {
          about: 'Beste Schnitte in Berlin',
          history: 'Seit 2020',
          serviceDirections: ['Haarschnitte'],
          rules: ['Termin absagen'],
          teamNote: 'Kleines Team',
        },
        coverPhotoId: 'photo-1',
        publishedAt: '2026-08-05T10:00:00.000Z',
      },
      validationIssues: [],
      updatedAt: '2026-08-05T10:00:00.000Z',
      publishedAt: '2026-08-05T10:00:00.000Z',
    })),
    saveDraft: vi.fn(async (_, draft) => ({ salonId: 'salon-1', draft, validationIssues: [] })),
    publishDraft: vi.fn(async () => ({ salonId: 'salon-1', publishedAt: '2026-08-05T10:10:00.000Z', draft: null, publicSalon: {} })),
  },
}))

vi.mock('../features/services/api/serviceApi', () => ({
  serviceApi: {
    list: vi.fn(async () => ({ items: [{ id: 'service-1', name: 'Herrenschnitt', category: 'Herren', basePrice: 27, durationMinutes: 30 }] })),
  },
}))

vi.mock('../features/masters/api/masterApi', () => ({
  masterApi: {
    list: vi.fn(async () => ({ items: [{ id: 'master-1', displayName: 'Anna', specialization: 'Coloration', acceptsHomeVisits: false, currentStatus: 'AVAILABLE' }] })),
  },
}))

vi.mock('../features/bookings/api/bookingApi', () => ({
  bookingApi: {
    quote: vi.fn(async () => ({ salonId: 'salon-1', items: [], totalPrice: 0, totalDurationMinutes: 0, currency: 'EUR', additionalWish: null })),
    getSlots: vi.fn(async () => ({ salonId: 'salon-1', serviceId: 'service-1', durationMinutes: 30, date: '2026-08-05', slots: [] })),
    create: vi.fn(),
  },
}))

function renderOwnerSalonPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  const router = createMemoryRouter(
    [{ path: '/salons/:salonId', element: <SalonDetailPage /> }],
    { initialEntries: ['/salons/salon-1'] },
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('SalonDetailPage owner editor', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'token',
      authStatus: 'authenticated',
      isAuthResolved: true,
      currentUser: {
        id: 'owner-1',
        name: 'Owner',
        email: 'admin@example.test',
        phone: '+49 30 000000',
        role: 'SALON_OWNER',
        isActive: true,
        isVerified: true,
        salonAdminProfile: [{ id: 'membership-1', isActive: true, salon: { id: 'salon-1', name: 'Studio Nord' } }],
      },
    })
  })

  it('shows owner editor controls and opens inline hero editing on the public page', async () => {
    renderOwnerSalonPage()

    expect(await screen.findByRole('button', { name: 'Profil bearbeiten' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Profil bearbeiten' }))

    expect(await screen.findByDisplayValue('Studio Nord')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Friseursalon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entwurf speichern' })).toBeInTheDocument()
  })
})