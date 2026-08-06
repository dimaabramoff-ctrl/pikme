import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { SalonDetailPage } from './SalonDetailPage'

vi.mock('../shared/demo/presentationData', async () => {
  const actual = await vi.importActual<typeof import('../shared/demo/presentationData')>('../shared/demo/presentationData')
  return {
    ...actual,
    PRESENTATION_MODE: true,
  }
})

function renderSalonPage(path = '/salons/demo-atelier-royal') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const router = createMemoryRouter(
    [
      {
        path: '/salons/:salonId',
        element: <SalonDetailPage />,
      },
    ],
    { initialEntries: [path] },
  )

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('SalonDetailPage booking flow', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('does not show google branded rating block', async () => {
    renderSalonPage()

    expect((await screen.findAllByText(/PickMe Bewertung/i)).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Google Rating/i)).not.toBeInTheDocument()
  })

  it('uses top CTAs and keeps pricing inside the booking flow', async () => {
    renderSalonPage()

    expect(await screen.findByRole('link', { name: 'Mehr erfahren' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Jetzt buchen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Jetzt buchen' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Leistungen & Preise' })).not.toBeInTheDocument()
  })

  it('keeps base service unique after selecting it', async () => {
    renderSalonPage()
    const addButtons = await screen.findAllByRole('button', { name: 'Hinzufügen' })
    fireEvent.click(addButtons[0])

    const summary = screen.getByRole('heading', { name: 'Auswahl' }).closest('section')
    expect(summary).toBeTruthy()

    if (!summary) return
    expect(within(summary).getAllByText(/Entfernen/i).length).toBeGreaterThan(0)
    expect(within(summary).getByText('1 Leistungen')).toBeInTheDocument()
  })

  it('requires payment method selection on payment step', async () => {
    renderSalonPage()
    const addButtons = await screen.findAllByRole('button', { name: 'Hinzufügen' })
    fireEvent.click(addButtons[0])

    fireEvent.click(screen.getByRole('button', { name: /Weiter zu Mitarbeiter/i }))
    fireEvent.click(screen.getByRole('button', { name: /Beliebiger verfügbarer Mitarbeiter/i }))
    fireEvent.click(screen.getByRole('button', { name: /Verfügbare Zeiten anzeigen/i }))

    const slotButtons = await screen.findAllByRole('button', { name: /verfügbar/i })
    fireEvent.click(slotButtons[0])

    expect(screen.getByText(/Bitte wählen Sie eine Zahlungsart/i)).toBeInTheDocument()
    const nextButton = screen.getByRole('button', { name: 'Weiter' })
    expect(nextButton).toBeDisabled()
  })
})
