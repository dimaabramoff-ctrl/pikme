import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { useAuthStore } from '../features/auth/authStore'
import { SalonDetailPage } from './SalonDetailPage'

const GOOGLE_COVER = '/api/catalog/google-photo?name=google-cover&maxHeight=800'
const OWN_COVER = 'https://cdn.pickme.test/own-cover.jpg'

const salonState = {
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
  photos: [
    { id: 'google-photo', imageUrl: GOOGLE_COVER, sortOrder: 0 },
    { id: 'own-photo', imageUrl: OWN_COVER, sortOrder: 1 },
  ],
}

const editorState = {
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
    photos: [...salonState.photos],
    coverPhotoId: '__GOOGLE_COVER__',
    googleCoverUrl: GOOGLE_COVER,
  },
  published: {
    overview: {} as never,
    moreInfo: {} as never,
    coverPhotoId: '__GOOGLE_COVER__',
    googleCoverUrl: GOOGLE_COVER,
    publishedAt: '2026-08-05T10:00:00.000Z',
  },
  validationIssues: [],
  updatedAt: '2026-08-05T10:00:00.000Z',
  publishedAt: '2026-08-05T10:00:00.000Z',
}

editorState.published.overview = editorState.draft.overview
editorState.published.moreInfo = editorState.draft.moreInfo

vi.mock('../shared/demo/presentationData', async () => {
  const actual = await vi.importActual<typeof import('../shared/demo/presentationData')>('../shared/demo/presentationData')
  return {
    ...actual,
    PRESENTATION_MODE: false,
  }
})

vi.mock('../features/salons/api/salonApi', () => ({
  salonApi: {
    getById: vi.fn(async () => ({ ...salonState })),
    getEditorState: vi.fn(async () => structuredClone(editorState)),
    saveDraft: vi.fn(async (_salonId: string, draft: typeof editorState.draft) => {
      editorState.draft = structuredClone(draft)
      return { salonId: 'salon-1', draft: structuredClone(editorState.draft), validationIssues: [] }
    }),
    publishDraft: vi.fn(async () => {
      editorState.published = {
        overview: structuredClone(editorState.draft.overview),
        moreInfo: structuredClone(editorState.draft.moreInfo),
        coverPhotoId: editorState.draft.coverPhotoId ?? null,
        googleCoverUrl: editorState.draft.googleCoverUrl ?? null,
        publishedAt: '2026-08-05T10:10:00.000Z',
      }

      if (editorState.draft.photos.length > 0) {
        salonState.photos = editorState.draft.photos.map((photo, index) => ({
          id: photo.id ?? `new-photo-${index}`,
          imageUrl: photo.imageUrl,
          sortOrder: index,
        }))
      }

      salonState.name = editorState.draft.overview.name

      return {
        salonId: 'salon-1',
        publishedAt: '2026-08-05T10:10:00.000Z',
        draft: structuredClone(editorState.draft),
        publicSalon: { ...salonState },
      }
    }),
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

function renderCoverPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/salons/:salonId', element: <SalonDetailPage /> }], { initialEntries: ['/salons/salon-1'] })

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('SalonDetailPage cover logic', () => {
  beforeEach(() => {
    salonState.name = 'Studio Nord'
    salonState.photos = [
      { id: 'google-photo', imageUrl: GOOGLE_COVER, sortOrder: 0 },
      { id: 'own-photo', imageUrl: OWN_COVER, sortOrder: 1 },
    ]
    editorState.draft.photos = [...salonState.photos]
    editorState.draft.coverPhotoId = '__GOOGLE_COVER__'
    editorState.draft.googleCoverUrl = GOOGLE_COVER
    editorState.published.coverPhotoId = '__GOOGLE_COVER__'
    editorState.published.googleCoverUrl = GOOGLE_COVER

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

  it('uses Google cover by default', async () => {
    renderCoverPage()
    expect((await screen.findByTestId('salon-cover-image')).getAttribute('src')).toContain('google-cover')
  })

  it('keeps public cover until preview and publish, then updates it', async () => {
    const view = renderCoverPage()
    expect((await screen.findByTestId('salon-cover-image')).getAttribute('src')).toContain('google-cover')

    fireEvent.click(screen.getByRole('button', { name: 'Profil bearbeiten' }))
    fireEvent.click(screen.getAllByAltText('Studio Nord')[1])
    fireEvent.click(screen.getAllByRole('button', { name: 'Als Cover' })[1])

    expect(await screen.findByText(/Das aktuelle Titelbild hilft Kundinnen und Kunden/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Eigenes Titelbild verwenden' }))
    fireEvent.click(screen.getByRole('button', { name: 'Entwurf speichern' }))

    await waitFor(() => {
      expect(screen.getByTestId('salon-cover-image').getAttribute('src')).toContain('google-cover')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }))
    await waitFor(() => {
      expect(screen.getByTestId('salon-cover-image').getAttribute('src')).toContain('own-cover')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlichen' }))
    await waitFor(() => {
      expect(screen.getByTestId('salon-cover-image').getAttribute('src')).toContain('own-cover')
    })

    view.unmount()
    renderCoverPage()
    expect((await screen.findByTestId('salon-cover-image')).getAttribute('src')).toContain('own-cover')
  })

  it('falls back to Google cover when the selected own cover is deleted and allows restoring Google cover explicitly', async () => {
    editorState.published.coverPhotoId = 'own-photo'
    editorState.draft.coverPhotoId = 'own-photo'

    renderCoverPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Profil bearbeiten' }))
    fireEvent.click(screen.getAllByAltText('Studio Nord')[1])
    fireEvent.click(screen.getAllByRole('button', { name: 'Entfernen' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }))

    await waitFor(() => {
      expect(screen.getByTestId('salon-cover-image').getAttribute('src')).toContain('google-cover')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Google cover verwenden' }))
    await waitFor(() => {
      expect(screen.getByTestId('salon-cover-image').getAttribute('src')).toContain('google-cover')
    })
  })
})