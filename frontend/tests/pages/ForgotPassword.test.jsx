import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../src/hooks/useAuth', () => ({
  default: vi.fn(),
}))

const { ForgotPassword } = await import('../../src/pages/auth/ForgotPassword')
const useAuth = (await import('../../src/hooks/useAuth')).default

const renderPage = () =>
  render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  )

describe('ForgotPassword page', () => {
  let forgotPassword

  beforeEach(() => {
    forgotPassword = vi.fn()
    useAuth.mockReturnValue({ forgotPassword, loading: false })
  })

  it('rejects an invalid email without calling the API', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('john@example.com'), 'raj@invalid')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(screen.getByText('Invalid email format')).toBeInTheDocument()
    expect(forgotPassword).not.toHaveBeenCalled()
  })

  it('shows the "check your email" confirmation screen on success', async () => {
    forgotPassword.mockResolvedValueOnce({ success: true, message: 'Reset link sent' })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText('john@example.com'), 'raj@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText('Check Your Email')).toBeInTheDocument()
    expect(forgotPassword).toHaveBeenCalledWith('raj@example.com')
  })

  it('disables the submit button while the request is loading', () => {
    useAuth.mockReturnValue({ forgotPassword, loading: true })
    renderPage()

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled()
  })
})
