import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { NearbyCatalogItem } from '../features/catalog/api/nearbyApi'
import { HomePage, buildHomeDisplayState } from './HomePage'
import { useUiStore } from '../shared/store/uiStore'

const listWithMetaMock = vi.fn()
const getCurrentPositionMock = vi.fn()

vi.mock('../features/catalog/api/nearbyApi', () => ({
  nearbyApi: {
    listWithMeta: (...args: unknown[]) => listWithMetaMock(...args),
  },
}))

vi.mock('../shared/demo/presentationData', async () => {
  const actual = await vi.importActual<typeof import('../shared/demo/presentationData')>('../shared/demo/presentationData')
  return {
    ...actual,
    PRESENTATION_MODE: true,
  }
})

function baseItem(id: string, name: string, isPickmeConnected = false): NearbyCatalogItem {
  return {
    id,
    source: isPickmeConnected ? 'PICKME' : 'EXTERNAL',
    name,
    category: 'hair_salon',
    address: 'Test address',
    latitude: 52.52,
    longitude: 13.405,
    distanceKm: 1,
    rating: 4.5,
    reviewCount: 10,
    openNow: true,
    photoUrl: null,
    externalUrl: null,
    phone: null,
    externalProvider: isPickmeConnected ? undefined : 'GOOGLE_PLACES',
    externalPlaceId: isPickmeConnected ? undefined : `place-${id}`,
    isPickmeConnected,
    isBookable: isPickmeConnected,
    isVerified: isPickmeConnected ? true : null,
    mastersOnShift: isPickmeConnected ? 3 : null,
    availableMasters: isPickmeConnected ? 1 : null,
    busyMasters: isPickmeConnected ? 2 : null,
    nextAvailableSlot: isPickmeConnected ? '2026-08-04T10:30:00.000Z' : null,
    minPrice: isPickmeConnected ? 25 : null,
    onlineBookingAvailable: isPickmeConnected,
  }
}

function mockGeolocationUnavailable() {
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: undefined,
  })
}

function renderHomePage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('HomePage presentation mode', () => {
  beforeEach(() => {
    listWithMetaMock.mockReset()
    getCurrentPositionMock.mockReset()
    window.sessionStorage.clear()
    useUiStore.setState({ viewMode: 'LIST', entityFilter: 'SALON' })
  })

  it('shows trust intro and no radius/filter buttons', async () => {
    mockGeolocationUnavailable()
    listWithMetaMock.mockResolvedValue({
      payload: { items: [], nextCursor: null, hasMore: false, totalUniqueResults: 0, radiusMeters: 15000, appliedFilters: [], diagnostics: { googleRequestsMade: 0, googleRawResults: 0, uniqueResults: 0, returnedOnThisPage: 0, hasMore: false, radiusMetersUsed: 15000 } },
      meta: { googleRequestsMade: 0, googleRawResults: 0, uniqueResults: 0, returnedOnThisPage: 0, hasMore: false, radiusMetersUsed: 15000 },
    })
    renderHomePage()
    expect(screen.getByTestId('pickme-trust-intro')).toBeInTheDocument()
    expect(screen.getByText('Dein Termin. Ohne Anrufen. Ohne Warten.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '2 km' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '15 km' })).not.toBeInTheDocument()
    expect(screen.queryByText('Alle verfügbaren Salons im gewählten Umkreis')).not.toBeInTheDocument()
    expect(screen.queryByText(/Geladen/)).not.toBeInTheDocument()
  })

  it('uses 15km radius and keeps strict group order: demo PickMe -> real PickMe -> external', async () => {
    mockGeolocationUnavailable()

    const realPickmeFar = { ...baseItem('pickme-salon:real-1', 'Real PickMe Far', true), distanceKm: 5.1 }
    const realPickmeNear = { ...baseItem('pickme-salon:real-2', 'Real PickMe Near', true), distanceKm: 2.4 }
    const externalNear = { ...baseItem('external-google-1', 'External Near'), distanceKm: 1.2 }
    const externalFar = { ...baseItem('external-google-2', 'External Far'), distanceKm: 6.3 }

    listWithMetaMock.mockResolvedValue({
      payload: {
        items: [externalFar, realPickmeFar, externalNear, realPickmeNear],
        nextCursor: null,
        hasMore: false,
        totalUniqueResults: 4,
        radiusMeters: 15000,
        appliedFilters: [],
        diagnostics: {
          googleRequestsMade: 1,
          googleRawResults: 4,
          uniqueResults: 4,
          returnedOnThisPage: 4,
          hasMore: false,
          radiusMetersUsed: 15000,
        },
      },
      meta: {
        googleRequestsMade: 1,
        googleRawResults: 4,
        uniqueResults: 4,
        returnedOnThisPage: 4,
        hasMore: false,
        radiusMetersUsed: 15000,
      },
    })

    const { container } = renderHomePage()

    await waitFor(() => expect(listWithMetaMock).toHaveBeenCalled())
    for (const call of listWithMetaMock.mock.calls) {
      expect(call[0]).toMatchObject({ radius: 15000 })
    }

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Real PickMe Near' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'External Near' })).toBeInTheDocument()
    })

    const cardHeadings = Array.from(container.querySelectorAll('article h3')).map((node) => node.textContent?.trim())
    expect(cardHeadings.slice(0, 3)).toEqual([
      'PickMe Atelier Royal',
      'PickMe Nordic Cut House',
      'Real PickMe Near',
    ])
    expect(cardHeadings[3]).toBe('Real PickMe Far')
    expect(cardHeadings[4]).toBe('External Near')
    expect(cardHeadings[5]).toBe('External Far')

    expect(screen.getAllByText('Noch nicht mit PickMe verbunden').length).toBe(2)
  })

  it('keeps demo salons visible and shows provider error hint when nearby provider fails', async () => {
    mockGeolocationUnavailable()
    listWithMetaMock.mockRejectedValue({
      statusCode: 503,
      code: 'CATALOG_PROVIDER_UNAVAILABLE',
      message: 'Внешний каталог временно недоступен.',
    })

    renderHomePage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByRole('heading', { name: 'PickMe Atelier Royal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'PickMe Nordic Cut House' })).toBeInTheDocument()
    expect(screen.queryByText('External Near')).not.toBeInTheDocument()
  })

  it('shows 3 demo masters first, then real PickMe masters only, without external masters', async () => {
    mockGeolocationUnavailable()
    useUiStore.setState({ viewMode: 'LIST', entityFilter: 'MASTER' })

    const realMasterNear = {
      ...baseItem('pickme-master:real-1', 'Real Master Near', true),
      category: 'barber',
      distanceKm: 1.1,
    }
    const realMasterFar = {
      ...baseItem('pickme-master:real-2', 'Real Master Far', true),
      category: 'barber',
      distanceKm: 4.5,
    }
    const externalMaster = {
      ...baseItem('external-google-master-1', 'External Master', false),
      category: 'barber',
      distanceKm: 0.8,
    }

    listWithMetaMock.mockResolvedValue({
      payload: {
        items: [realMasterFar, externalMaster, realMasterNear],
        nextCursor: null,
        hasMore: false,
        totalUniqueResults: 3,
        radiusMeters: 15000,
        appliedFilters: [],
        diagnostics: {
          googleRequestsMade: 1,
          googleRawResults: 3,
          uniqueResults: 3,
          returnedOnThisPage: 3,
          hasMore: false,
          radiusMetersUsed: 15000,
        },
      },
      meta: {
        googleRequestsMade: 1,
        googleRawResults: 3,
        uniqueResults: 3,
        returnedOnThisPage: 3,
        hasMore: false,
        radiusMetersUsed: 15000,
      },
    })

    const { container } = renderHomePage()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Real Master Near' })).toBeInTheDocument()
    })

    const cardHeadings = Array.from(container.querySelectorAll('article h3')).map((node) => node.textContent?.trim())
    expect(cardHeadings.slice(0, 2)).toEqual(['PickMe Demo Zuhause', 'Anna Kovalenko'])
    expect(cardHeadings[2]).toBe('Real Master Near')
    expect(cardHeadings[3]).toBe('Real Master Far')
    expect(screen.queryByRole('heading', { name: 'External Master' })).not.toBeInTheDocument()
  })

  it('shows empty-state hint in master mode when no real PickMe masters were loaded', async () => {
    mockGeolocationUnavailable()
    useUiStore.setState({ viewMode: 'LIST', entityFilter: 'MASTER' })

    listWithMetaMock.mockResolvedValue({
      payload: {
        items: [],
        nextCursor: null,
        hasMore: false,
        totalUniqueResults: 0,
        radiusMeters: 15000,
        appliedFilters: [],
        diagnostics: {
          googleRequestsMade: 0,
          googleRawResults: 0,
          uniqueResults: 0,
          returnedOnThisPage: 0,
          hasMore: false,
          radiusMetersUsed: 15000,
        },
      },
      meta: {
        googleRequestsMade: 0,
        googleRawResults: 0,
        uniqueResults: 0,
        returnedOnThisPage: 0,
        hasMore: false,
        radiusMetersUsed: 15000,
      },
    })

    renderHomePage()

    await waitFor(() => {
      expect(screen.getByText('Derzeit sind keine weiteren mobilen Service-Profis in Ihrer Nähe verfügbar')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Anna Kovalenko' })).toBeInTheDocument()
  })

  it('restores a pending claim flow and reopens the modal on the trial step', async () => {
    mockGeolocationUnavailable()

    listWithMetaMock.mockResolvedValue({
      payload: {
        items: [],
        nextCursor: null,
        hasMore: false,
        totalUniqueResults: 0,
        radiusMeters: 15000,
        appliedFilters: [],
        diagnostics: {
          googleRequestsMade: 0,
          googleRawResults: 0,
          uniqueResults: 0,
          returnedOnThisPage: 0,
          hasMore: false,
          radiusMetersUsed: 15000,
        },
      },
      meta: {
        googleRequestsMade: 0,
        googleRawResults: 0,
        uniqueResults: 0,
        returnedOnThisPage: 0,
        hasMore: false,
        radiusMetersUsed: 15000,
      },
    })

    window.sessionStorage.setItem(
      'pickme_pending_claim',
      JSON.stringify({
        googlePlaceId: 'place-pending-1',
        salonName: 'Pending External Salon',
        address: 'Pending Address 12',
        pendingStep: 'redeem_form',
      }),
    )

    renderHomePage()

    await waitFor(() => {
      expect(screen.getByText('PickMe-Zugangscode')).toBeInTheDocument()
    }, { timeout: 3000 })

    expect(screen.getByPlaceholderText('PM-TRIAL-XXXX-XXXX')).toBeInTheDocument()
  })
})

describe('buildHomeDisplayState', () => {
  it('reports presentation counters for salons', () => {
    const realPickme = { ...baseItem('pickme-salon:real-10', 'Real Salon', true), distanceKm: 2 }
    const external = { ...baseItem('external-google-10', 'External Salon', false), distanceKm: 3 }

    const state = buildHomeDisplayState([external, realPickme], 'SALON', true)

    expect(state.demoSalonCount).toBe(2)
    expect(state.realPartnerSalonCount).toBe(1)
    expect(state.externalSalonCount).toBe(1)
    expect(state.items.length).toBe(4)
  })

  it('reports presentation counters for masters', () => {
    const realMaster = { ...baseItem('pickme-master:real-99', 'Real Master', true), category: 'barber' }
    const externalMaster = { ...baseItem('external-google-master-99', 'External Master', false), category: 'barber' }

    const state = buildHomeDisplayState([externalMaster, realMaster], 'MASTER', true)

    expect(state.demoMasterCount).toBe(2)
    expect(state.realMasterCount).toBe(1)
    expect(state.items.find((item) => item.name === 'External Master')).toBeUndefined()
  })
})
