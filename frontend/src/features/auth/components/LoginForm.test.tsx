import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm } from './LoginForm'

vi.mock('../hooks/useLogin', () => ({
  useLogin: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
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

    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))

    expect(await screen.findByText('Введите email или телефон')).toBeInTheDocument()
    expect(await screen.findByText('Минимум 8 символов')).toBeInTheDocument()
  })
})
