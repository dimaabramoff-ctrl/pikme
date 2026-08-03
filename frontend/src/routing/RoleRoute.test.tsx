import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useAuthStore } from '../features/auth/authStore'
import { RoleRoute } from './RoleRoute'

describe('RoleRoute', () => {
  it('blocks route for wrong role', () => {
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
      isAuthResolved: true,
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

    expect(screen.getByText('Profile page')).toBeInTheDocument()
  })
})
