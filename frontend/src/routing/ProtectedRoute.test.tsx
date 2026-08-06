import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useAuthStore } from '../features/auth/authStore'
import { ProtectedRoute } from './ProtectedRoute'

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to login', async () => {
    useAuthStore.setState({ currentUser: null, authStatus: 'resolved', accessToken: null })

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<div>Profile page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Login page')).toBeInTheDocument()
    })
  })
})
