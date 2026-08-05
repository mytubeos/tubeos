import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

let mockUser
vi.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ user: mockUser, updateUser: vi.fn() }),
}))

vi.mock('../../src/hooks/useRazorpay', () => ({
  useRazorpay: () => ({ startCheckout: vi.fn(), loadingPlan: null }),
}))

vi.mock('../../src/api/payment.api', () => ({
  default: { getHistory: vi.fn() },
}))

vi.mock('../../src/api/auth.api', () => ({
  default: {
    updateMe: vi.fn(),
    updatePreferences: vi.fn(),
    updateBranding: vi.fn(),
  },
}))

import authApi from '../../src/api/auth.api'
import paymentAPI from '../../src/api/payment.api'
import { Settings } from '../../src/pages/settings/Settings'

const openPlanTab = async (user) => {
  await user.click(screen.getByRole('button', { name: /plan & billing/i }))
}

describe('Settings — White-Label Reports card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    paymentAPI.getHistory.mockResolvedValue({ data: { data: { history: [] } } })
    authApi.updateBranding.mockResolvedValue({
      data: { data: { branding: { enabled: true, companyName: 'Acme Media', primaryColor: '' } } },
    })
  })

  it('shows a locked upgrade card below Agency plan', async () => {
    mockUser = { plan: 'pro', usage: {} }
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await openPlanTab(user)

    expect(await screen.findByText(/agency feature/i)).toBeInTheDocument()
    expect(screen.getByText(/upgrade to agency to unlock/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save branding/i })).not.toBeInTheDocument()
  })

  it('shows a real form and saves branding for an Agency user', async () => {
    mockUser = { plan: 'agency', usage: {}, branding: { enabled: false, companyName: '' } }
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )

    await openPlanTab(user)

    const nameInput = await screen.findByPlaceholderText('Your Agency Name')
    await user.type(nameInput, 'Acme Media')
    await user.click(screen.getByRole('button', { name: /save branding/i }))

    await waitFor(() =>
      expect(authApi.updateBranding).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: 'Acme Media' })
      )
    )
  })
})
