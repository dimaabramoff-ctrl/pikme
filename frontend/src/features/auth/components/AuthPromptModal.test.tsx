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

    expect(screen.getByText('Чтобы продолжить, войдите в Пикми')).toBeInTheDocument()
  })
})
