import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../src/api/auth.api', () => ({
  default: {
    register: vi.fn(),
    verifyEmail: vi.fn(),
    resendOTP: vi.fn(),
    login: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
  },
}))

const { default: useAuth } = await import('../../src/hooks/useAuth')
const authAPI = (await import('../../src/api/auth.api')).default

describe('useAuth.register', () => {
  it('stores pending signup info and returns success', async () => {
    authAPI.register.mockResolvedValueOnce({
      data: {
        message: 'OTP sent',
        data: { userId: 'u1', user: null, requiresVerification: true },
      },
    })

    const { result } = renderHook(() => useAuth())

    let response
    await act(async () => {
      response = await result.current.register('Raj', 'raj@example.com', 'password123')
    })

    expect(response).toEqual({
      success: true,
      userId: 'u1',
      user: null,
      requiresVerification: true,
      message: 'OTP sent',
    })
    expect(localStorage.getItem('pendingUserId')).toBe('u1')
    expect(localStorage.getItem('pendingEmail')).toBe('raj@example.com')
    expect(result.current.loading).toBe(false)
  })

  it('surfaces the backend error message on failure', async () => {
    authAPI.register.mockRejectedValueOnce({
      response: { data: { message: 'Email already in use' } },
    })

    const { result } = renderHook(() => useAuth())

    let response
    await act(async () => {
      response = await result.current.register('Raj', 'raj@example.com', 'password123')
    })

    expect(response).toEqual({ success: false, error: 'Email already in use' })
    expect(result.current.error).toBe('Email already in use')
  })
})

describe('useAuth.login', () => {
  it('stores tokens and marks the user authenticated', async () => {
    authAPI.login.mockResolvedValueOnce({
      data: {
        message: 'Welcome back',
        data: { user: { _id: 'u1' }, accessToken: 'acc', refreshToken: 'ref' },
      },
    })

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.login('raj@example.com', 'password123')
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual({ _id: 'u1' })
    expect(localStorage.getItem('accessToken')).toBe('acc')
    expect(localStorage.getItem('refreshToken')).toBe('ref')
  })
})

describe('useAuth.forgotPassword', () => {
  it('always reports success, even when the request fails, to avoid leaking account existence', async () => {
    authAPI.forgotPassword.mockRejectedValueOnce(new Error('user not found'))

    const { result } = renderHook(() => useAuth())

    let response
    await act(async () => {
      response = await result.current.forgotPassword('nobody@example.com')
    })

    expect(response.success).toBe(true)
  })
})

describe('useAuth.fetchProfile', () => {
  it('loads the profile from the mounting effect when a token is present', async () => {
    localStorage.setItem('accessToken', 'existing-token')
    authAPI.getProfile.mockResolvedValueOnce({ data: { data: { _id: 'u1', name: 'Raj' } } })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(result.current.user).toEqual({ _id: 'u1', name: 'Raj' })
  })

  it('clears tokens and auth state when the stored token is invalid', async () => {
    localStorage.setItem('accessToken', 'stale-token')
    authAPI.getProfile.mockRejectedValueOnce({ response: { status: 401 } })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('accessToken')).toBeNull()
  })
})

describe('useAuth.logout', () => {
  it('clears local auth state even if the API call rejects', async () => {
    localStorage.setItem('accessToken', 'acc')
    localStorage.setItem('refreshToken', 'ref')
    authAPI.logout.mockRejectedValueOnce(new Error('network error'))

    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('accessToken')).toBeNull()
  })
})
