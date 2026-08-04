import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, waitFor } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from './HomePage'
import { useUiStore } from '../shared/store/uiStore'

const nearbyListMock = vi.fn()

vi.mock('../features/catalog/api/nearbyApi', () => ({
  nearbyApi: {
    list: (...args: unknown[]) => nearbyListMock(...args),
  },
}))

function mockGeolocationSuccess() {
  Object.defineProperty(window.navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback) => {
        success({
          coords: {
            latitude: 52.52,
            longitude: 13.405,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        } as GeolocationPosition)
      },
    },
  })
}

async function renderWithLocationAndData(items: unknown[]) {
  nearbyListMock.mockResolvedValue(items)
  mockGeolocationSuccess()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>
    </MemoryRouter>,
  )

  fireEvent.click(screen.getAllByRole('button', { name: 'Вокруг меня' })[0])
  await waitFor(() => expect(nearbyListMock).toHaveBeenCalled())
  queryClient.setQueryData(['home-nearby', 52.52, 13.405, 'SALON'], items)
}

describe('HomePage', () => {
  beforeEach(() => {
    nearbyListMock.mockReset()
    useUiStore.setState({ viewMode: 'LIST', entityFilter: 'SALON' })
  })

  it('renders the client-facing home surface', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <HomePage />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('button', { name: 'Вокруг меня' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Ввести адрес' })).toBeInTheDocument()
  })

  it('renders PickMe partner operational fields and booking CTA', async () => {
    await renderWithLocationAndData([
      {
        id: 'pickme-salon:1',
        source: 'PICKME',
        name: 'PickMe Salon Berlin Mitte',
        address: 'Friedrichstraße 10, Berlin',
        latitude: 52.521,
        longitude: 13.406,
        distanceKm: 0.45,
        rating: 4.9,
        reviewCount: 72,
        openNow: true,
        isPickmeConnected: true,
        isBookable: true,
        mastersOnShift: 4,
        availableMasters: 2,
        busyMasters: 2,
        nextAvailableSlot: '2026-08-04T10:30:00.000Z',
        minPrice: 25,
        onlineBookingAvailable: true,
      },
    ])

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'PickMe Salon Berlin Mitte' }).length).toBeGreaterThan(0)
    })
    expect(screen.getByText('Мастеров на смене')).toBeInTheDocument()
    expect(screen.getByText('Свободны сейчас')).toBeInTheDocument()
    expect(screen.getByText('Заняты')).toBeInTheDocument()
    expect(screen.getByText('Цена от')).toBeInTheDocument()
    expect(screen.getByText('от €25')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Записаться' })).toBeInTheDocument()
  })

  it('renders external salon without internal PickMe operational metrics', async () => {
    await renderWithLocationAndData([
      {
        id: 'external-google-2',
        source: 'EXTERNAL',
        externalProvider: 'GOOGLE_PLACES',
        externalPlaceId: 'google-2',
        name: 'Friseur Atelier Berlin',
        address: 'Alexanderplatz 2, Berlin',
        latitude: 52.522,
        longitude: 13.41,
        distanceKm: 0.9,
        rating: 4.4,
        reviewCount: 24,
        openNow: false,
        externalUrl: 'https://maps.google.com/?cid=123',
        isPickmeConnected: false,
        mastersOnShift: null,
        availableMasters: null,
        busyMasters: null,
        nextAvailableSlot: null,
        minPrice: null,
        onlineBookingAvailable: false,
      },
    ])

    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: 'Friseur Atelier Berlin' }).length).toBeGreaterThan(0)
    })
    expect(screen.getByRole('link', { name: 'Подробнее' })).toBeInTheDocument()
    expect(screen.queryByText('Мастеров на смене')).not.toBeInTheDocument()
    expect(screen.queryByText('Свободны сейчас')).not.toBeInTheDocument()
    expect(screen.queryByText('Цена от')).not.toBeInTheDocument()
  })
})
