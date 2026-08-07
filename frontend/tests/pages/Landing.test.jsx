import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

let mockIsAuthenticated
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ isAuthenticated: mockIsAuthenticated }),
}))

import { Landing } from '../../src/pages/Landing'

const renderLanding = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('Landing — already-authenticated redirect', () => {
  it('redirects straight to /dashboard when already logged in, without rendering the marketing page', () => {
    mockIsAuthenticated = true
    renderLanding()

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    expect(screen.queryByText(/creator command center/i)).not.toBeInTheDocument()
  })

  it('renders the marketing page as normal when not authenticated', () => {
    mockIsAuthenticated = false
    renderLanding()

    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument()
    expect(screen.getAllByText(/vezrin/i).length).toBeGreaterThan(0)
  })
})
