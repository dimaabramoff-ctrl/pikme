import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('renders the client-facing home surface', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <HomePage />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    expect(screen.getByPlaceholderText('Поиск салона, услуги или мастера')).toBeInTheDocument()
  })
})
