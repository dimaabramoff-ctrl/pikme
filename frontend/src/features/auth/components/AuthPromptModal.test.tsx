import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthPromptModal } from './AuthPromptModal'

describe('AuthPromptModal', () => {
  it('renders the guest auth prompt message', () => {
    render(
      <MemoryRouter>
        <AuthPromptModal isOpen onClose={() => undefined} returnTo="/salons" />
      </MemoryRouter>,
    )

    expect(screen.getByText('Um fortzufahren, melden Sie sich bei PickMe an')).toBeInTheDocument()
  })

  it('shows that Google and Apple sign-in are not available yet', () => {
    render(
      <MemoryRouter>
        <AuthPromptModal isOpen onClose={() => undefined} returnTo="/salons" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /Mit Google fortfahren/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Mit Apple fortfahren/i })).toBeDisabled()
    expect(screen.getByText(/Google und Apple sind derzeit nicht konfiguriert/i)).toBeInTheDocument()
  })
})
