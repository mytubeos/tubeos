import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
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

const { Signup } = await import('../../src/pages/auth/Signup')
const { useAuthStore } = await import('../../src/store/authStore')

const renderSignup = () =>
  render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  )

const fillSignupForm = async (user, overrides = {}) => {
  const values = {
    name: 'Raj Yadav',
    email: 'raj@example.com',
    password: 'password123',
    confirmPassword: 'password123',
    ...overrides,
  }
  await user.type(screen.getByPlaceholderText('John Doe'), values.name)
  await user.type(screen.getByPlaceholderText('john@example.com'), values.email)
  const pwdInputs = screen.getAllByPlaceholderText('••••••••')
  await user.type(pwdInputs[0], values.password)
  await user.type(pwdInputs[1], values.confirmPassword)
  await user.click(screen.getByRole('button', { name: /sign up/i }))
}

describe('Signup page', () => {
  let register
  let verifyEmail

  beforeEach(() => {
    register = vi.fn()
    verifyEmail = vi.fn()
    useAuthStore.mockReturnValue({ register, verifyEmail, isLoading: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects a password shorter than 8 characters', async () => {
    const user = userEvent.setup()
    renderSignup()

    await fillSignupForm(user, { password: 'short', confirmPassword: 'short' })

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('rejects mismatched password confirmation', async () => {
    const user = userEvent.setup()
    renderSignup()

    await fillSignupForm(user, { confirmPassword: 'differentPassword1' })

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('advances to the OTP step after a successful registration', async () => {
    register.mockResolvedValueOnce({ success: true, userId: 'u1' })
    const user = userEvent.setup()
    renderSignup()

    await fillSignupForm(user)

    expect(await screen.findByRole('heading', { name: 'Verify Email' })).toBeInTheDocument()
    expect(register).toHaveBeenCalledWith('Raj Yadav', 'raj@example.com', 'password123', null)
  })

  it('shows the backend error message when registration fails (e.g. duplicate email)', async () => {
    register.mockResolvedValueOnce({ success: false, message: 'Email already registered' })
    const user = userEvent.setup()
    renderSignup()

    await fillSignupForm(user)

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
  })

  it('verifies the OTP and redirects to login', async () => {
    // Signup.jsx schedules a real 1.5s setTimeout(navigate, ...) after OTP
    // success. Left as a real timer, it fires after this test has already
    // finished — during whatever test happens to be running next — and can
    // make unrelated tests flaky. Fake timers keep it fully deterministic
    // and let us assert on the redirect too.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    register.mockResolvedValueOnce({ success: true, userId: 'u1' })
    verifyEmail.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderSignup()

    await fillSignupForm(user)
    await screen.findByRole('heading', { name: 'Verify Email' })

    await user.type(screen.getByPlaceholderText('000000'), '123456')
    await user.click(screen.getByRole('button', { name: /verify email/i }))

    expect(verifyEmail).toHaveBeenCalledWith('u1', '123456')
    await waitFor(() => expect(screen.getByText(/email verified/i)).toBeInTheDocument())

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(mockNavigate).toHaveBeenCalledWith('/login?verified=1')

    vi.useRealTimers()
  })
})
