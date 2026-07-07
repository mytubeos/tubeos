import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../src/store/authStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('../../src/api/auth.api', () => ({
  default: { resendOTP: vi.fn() },
}))

const { Login } = await import('../../src/pages/auth/Login')
const { useAuthStore } = await import('../../src/store/authStore')
const authApi = (await import('../../src/api/auth.api')).default

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )

describe('Login page', () => {
  let login
  let verifyEmail

  beforeEach(() => {
    login = vi.fn()
    verifyEmail = vi.fn()
    useAuthStore.mockReturnValue({ login, verifyEmail, isLoading: false })
  })

  it('rejects an invalid email before calling the login API', async () => {
    const user = userEvent.setup()
    renderLogin()

    // "raj@invalid" passes the native type="email" constraint (has an @ and
    // a domain label) so jsdom lets the submit through, but fails the app's
    // own stricter regex (requires a dot after @) — that's the path we want
    // to exercise. A value like "not-an-email" would get blocked by jsdom's
    // native validation before handleSubmit ever runs.
    await user.type(screen.getByPlaceholderText('john@example.com'), 'raj@invalid')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(screen.getByText('Invalid email format')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('navigates to the dashboard on successful login', async () => {
    login.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('john@example.com'), 'raj@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
    expect(login).toHaveBeenCalledWith('raj@example.com', 'password123')
  })

  it('switches to the OTP screen for an unverified account instead of showing a plain error', async () => {
    login.mockResolvedValueOnce({
      success: false,
      requiresVerification: true,
      userId: 'u1',
      message: 'Please verify your email',
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('john@example.com'), 'raj@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Verify Email')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows the backend error message for wrong credentials', async () => {
    login.mockResolvedValueOnce({ success: false, message: 'Invalid credentials' })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('john@example.com'), 'raj@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })

  it('requires a 6-digit OTP before allowing verification', async () => {
    login.mockResolvedValueOnce({
      success: false,
      requiresVerification: true,
      userId: 'u1',
      message: 'verify',
    })
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('john@example.com'), 'raj@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByText('Verify Email')
    const verifyButton = screen.getByRole('button', { name: /verify & sign in/i })
    expect(verifyButton).toBeDisabled()

    await user.type(screen.getByPlaceholderText('000000'), '12345')
    expect(verifyButton).toBeDisabled()
  })

  it('calls resendOTP when the user asks for a new code', async () => {
    login.mockResolvedValueOnce({
      success: false,
      requiresVerification: true,
      userId: 'u1',
      message: 'verify',
    })
    authApi.resendOTP.mockResolvedValueOnce({})
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByPlaceholderText('john@example.com'), 'raj@example.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByText('Verify Email')
    await user.click(screen.getByRole('button', { name: /resend otp/i }))

    expect(authApi.resendOTP).toHaveBeenCalledWith('raj@example.com')
  })
})
