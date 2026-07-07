import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

const { ResetPassword } = await import('../../src/pages/auth/ResetPassword')
const useAuth = (await import('../../src/hooks/useAuth')).default

const renderPage = (initialEntry = '/reset-password?token=abc123') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ResetPassword />
    </MemoryRouter>
  )

describe('ResetPassword page', () => {
  let resetPassword

  beforeEach(() => {
    resetPassword = vi.fn()
    useAuth.mockReturnValue({ resetPassword, loading: false })
  })

  it('shows the invalid-link screen when no token is present in the URL', () => {
    renderPage('/reset-password')

    expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument()
  })

  it('rejects a password shorter than 8 characters', async () => {
    const user = userEvent.setup()
    renderPage()

    const [pwd, confirm] = screen.getAllByPlaceholderText('••••••••')
    await user.type(pwd, 'short')
    await user.type(confirm, 'short')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched password confirmation', async () => {
    const user = userEvent.setup()
    renderPage()

    const [pwd, confirm] = screen.getAllByPlaceholderText('••••••••')
    await user.type(pwd, 'password123')
    await user.type(confirm, 'differentPassword1')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('submits the token + new password and redirects to /login on success', async () => {
    resetPassword.mockResolvedValueOnce({ success: true, message: 'Password reset successfully' })
    const user = userEvent.setup()
    renderPage()

    const [pwd, confirm] = screen.getAllByPlaceholderText('••••••••')
    await user.type(pwd, 'newPassword123')
    await user.type(confirm, 'newPassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(resetPassword).toHaveBeenCalledWith('abc123', 'newPassword123')
    expect(await screen.findByText('Password Reset')).toBeInTheDocument()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'), { timeout: 3000 })
  })

  it('shows the backend error message when the reset fails', async () => {
    resetPassword.mockResolvedValueOnce({ success: false, error: 'Token expired' })
    const user = userEvent.setup()
    renderPage()

    const [pwd, confirm] = screen.getAllByPlaceholderText('••••••••')
    await user.type(pwd, 'newPassword123')
    await user.type(confirm, 'newPassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText('Token expired')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
