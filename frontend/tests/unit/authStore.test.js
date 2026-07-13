import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/auth.api', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    verifyEmail: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
  },
}))

const { useAuthStore } = await import('../../src/store/authStore')
const authApi = (await import('../../src/api/auth.api')).default

const INITIAL_STATE = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(INITIAL_STATE, true)
})

describe('authStore.login', () => {
  it('stores user + tokens and marks authenticated on success', async () => {
    authApi.login.mockResolvedValueOnce({
      data: {
        data: {
          user: { _id: 'u1', name: 'Raj' },
          accessToken: 'access-123',
          refreshToken: 'refresh-123',
        },
      },
    })

    const result = await useAuthStore.getState().login('raj@example.com', 'password123')

    expect(result).toEqual({ success: true })
    expect(useAuthStore.getState().user).toEqual({ _id: 'u1', name: 'Raj' })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().isLoading).toBe(false)
    expect(localStorage.getItem('accessToken')).toBe('access-123')
    expect(localStorage.getItem('refreshToken')).toBe('refresh-123')
  })

  it('surfaces the requiresVerification flow on 403 unverified accounts', async () => {
    authApi.login.mockRejectedValueOnce({
      response: {
        status: 403,
        data: {
          message: 'Please verify your email',
          data: { requiresVerification: true, userId: 'u1' },
        },
      },
    })

    const result = await useAuthStore.getState().login('raj@example.com', 'password123')

    expect(result).toEqual({
      success: false,
      message: 'Please verify your email',
      requiresVerification: true,
      userId: 'u1',
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('returns a generic failure message for wrong credentials', async () => {
    authApi.login.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Invalid credentials' } },
    })

    const result = await useAuthStore.getState().login('raj@example.com', 'wrong')

    expect(result).toEqual({ success: false, message: 'Invalid credentials' })
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})

describe('authStore.verifyEmail', () => {
  it('authenticates the user once OTP is verified', async () => {
    authApi.verifyEmail.mockResolvedValueOnce({
      data: {
        data: { user: { _id: 'u1' }, accessToken: 'tok', refreshToken: 'refresh' },
      },
    })

    const result = await useAuthStore.getState().verifyEmail('u1', '482913')

    expect(result).toEqual({ success: true })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(localStorage.getItem('accessToken')).toBe('tok')
  })

  it('returns failure message on invalid OTP', async () => {
    authApi.verifyEmail.mockRejectedValueOnce({
      response: { data: { message: 'Invalid OTP' } },
    })

    const result = await useAuthStore.getState().verifyEmail('u1', '000000')

    expect(result).toEqual({ success: false, message: 'Invalid OTP' })
  })
})

describe('authStore.logout', () => {
  it('clears user, tokens and auth flag even if the API call fails', async () => {
    useAuthStore.setState({
      user: { _id: 'u1' },
      accessToken: 'tok',
      isAuthenticated: true,
    })
    localStorage.setItem('accessToken', 'tok')
    localStorage.setItem('refreshToken', 'refresh')
    authApi.logout.mockRejectedValueOnce(new Error('network down'))

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })
})

describe('authStore.refreshUser', () => {
  it('updates the user on success', async () => {
    authApi.getMe.mockResolvedValueOnce({ data: { data: { _id: 'u1', plan: 'pro' } } })

    await useAuthStore.getState().refreshUser()

    expect(useAuthStore.getState().user).toEqual({ _id: 'u1', plan: 'pro' })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('logs out when the token is rejected', async () => {
    useAuthStore.setState({ user: { _id: 'u1' }, isAuthenticated: true })
    authApi.getMe.mockRejectedValueOnce({ response: { status: 401 } })
    authApi.logout.mockResolvedValueOnce({})

    await useAuthStore.getState().refreshUser()

    expect(useAuthStore.getState().user).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('keeps the existing session on a transient error (network/5xx/timeout)', async () => {
    useAuthStore.setState({ user: { _id: 'u1' }, isAuthenticated: true })
    authApi.getMe.mockRejectedValueOnce({ response: { status: 500 } })

    await useAuthStore.getState().refreshUser()

    expect(useAuthStore.getState().user).toEqual({ _id: 'u1' })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(authApi.logout).not.toHaveBeenCalled()
  })

  it('keeps the existing session when getMe rejects with no response (network error)', async () => {
    useAuthStore.setState({ user: { _id: 'u1' }, isAuthenticated: true })
    authApi.getMe.mockRejectedValueOnce(new Error('Network Error'))

    await useAuthStore.getState().refreshUser()

    expect(useAuthStore.getState().user).toEqual({ _id: 'u1' })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(authApi.logout).not.toHaveBeenCalled()
  })
})

describe('authStore.updateUser', () => {
  it('merges updates into the existing user without touching other fields', () => {
    useAuthStore.setState({ user: { _id: 'u1', name: 'Raj', plan: 'free' } })

    useAuthStore.getState().updateUser({ plan: 'pro' })

    expect(useAuthStore.getState().user).toEqual({ _id: 'u1', name: 'Raj', plan: 'pro' })
  })
})
