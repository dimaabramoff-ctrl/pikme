import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm } from './LoginForm'

const loginMock = vi.fn()

vi.mock('../hooks/useLogin', () => ({
  useLogin: () => ({
    mutateAsync: loginMock,
    isPending: false,
    error: null,
  }),
}))

describe('LoginForm', () => {
  it('shows required validation errors', async () => {
    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByText('Bitte geben Sie E-Mail oder Telefon ein')).toBeInTheDocument()
    expect(await screen.findByText('Mindestens 8 Zeichen')).toBeInTheDocument()
  })

  it('shows a clear error message when credentials are invalid', async () => {
    loginMock.mockRejectedValueOnce({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Ungültige Zugangsdaten.',
    })

    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginForm />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText('E-Mail oder Telefon'), { target: { value: 'demo@example.com' } })
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'Password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }))

    expect(await screen.findByText('Ungültige Zugangsdaten.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument()
  })
})
