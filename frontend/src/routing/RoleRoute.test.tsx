import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useAuthStore } from '../features/auth/authStore'
import { RoleRoute } from './RoleRoute'

describe('RoleRoute', () => {
  it('blocks route for wrong role', async () => {
    useAuthStore.setState({
      currentUser: {
        id: '1',
        name: 'Test',
        email: 'test@example.test',
        phone: '+49000000000',
        role: 'CUSTOMER',
        isActive: true,
        isVerified: true,
      },
      authStatus: 'resolved',
      accessToken: 'token',
    })

    render(
      <MemoryRouter initialEntries={['/master']}>
        <Routes>
          <Route path="/profile" element={<div>Profile page</div>} />
          <Route element={<RoleRoute allowedRoles={['MASTER']} />}>
            <Route path="/master" element={<div>Master page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Profile page')).toBeInTheDocument()
    })
  })
})
