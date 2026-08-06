import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { ExternalSalonDetailPage } from './ExternalSalonDetailPage'

function renderExternalSalonPage(path = '/salons/external/test-place?name=Studio%20Nord&address=Testweg%201%2C%20Berlin&distanceKm=1.2&openNow=true') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const router = createMemoryRouter(
    [
      {
        path: '/salons/external/:externalId',
        element: <ExternalSalonDetailPage />,
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

describe('ExternalSalonDetailPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('shows claim CTA in the top business block and does not show google rating UI', async () => {
    renderExternalSalonPage()

    expect(screen.getAllByText(/Ist das Ihr Unternehmen\?/i).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /30 Tage kostenlos testen/i })).toHaveLength(2)
    expect(screen.queryByText(/Google Rating/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/review count/i)).not.toBeInTheDocument()
  })

  it('opens claim modal with verification info', async () => {
    renderExternalSalonPage()
    fireEvent.click(screen.getAllByRole('button', { name: /30 Tage kostenlos testen/i })[0])

    expect(await screen.findByText(/Unternehmen bestätigen/i)).toBeInTheDocument()
    expect(screen.getByText(/Profil übernehmen und Trial starten/i)).toBeInTheDocument()
  })
})