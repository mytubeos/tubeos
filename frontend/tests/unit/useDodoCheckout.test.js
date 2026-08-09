import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../../src/api/payment.api', () => ({
  default: {
    createDodoCheckout: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => {
  const toastFn = vi.fn()
  toastFn.success = vi.fn()
  toastFn.error = vi.fn()
  return { default: toastFn }
})

let mockSearchParams = new URLSearchParams()
const mockSetSearchParams = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  }
})

const { useDodoCheckout } = await import('../../src/hooks/useDodoCheckout')
const { useAuthStore } = await import('../../src/store/authStore')
const paymentAPI = (await import('../../src/api/payment.api')).default
const toast = (await import('react-hot-toast')).default

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchParams = new URLSearchParams()
  sessionStorage.clear()
  // jsdom throws "Not implemented: navigation" on a real href assignment —
  // replace window.location with a plain writable object for these tests.
  delete window.location
  window.location = { href: '' }
})

describe('useDodoCheckout.startDodoCheckout', () => {
  it('creates a session, stashes the pending plan, and redirects to the hosted checkout URL', async () => {
    paymentAPI.createDodoCheckout.mockResolvedValueOnce({
      data: {
        data: { sessionId: 'cks_1', url: 'https://checkout.dodopayments.com/session/cks_1' },
      },
    })

    const { result } = renderHook(() => useDodoCheckout())

    await act(async () => {
      await result.current.startDodoCheckout('pro', 'SAVE20')
    })

    expect(paymentAPI.createDodoCheckout).toHaveBeenCalledWith('pro', 'SAVE20')
    expect(sessionStorage.getItem('dodo_pending_plan')).toBe('pro')
    expect(window.location.href).toBe('https://checkout.dodopayments.com/session/cks_1')
  })

  it('ignores a second call while one is already loading', async () => {
    paymentAPI.createDodoCheckout.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useDodoCheckout())

    act(() => {
      result.current.startDodoCheckout('pro')
    })
    expect(result.current.loadingPlan).toBe('pro')

    act(() => {
      result.current.startDodoCheckout('pro')
    })

    expect(paymentAPI.createDodoCheckout).toHaveBeenCalledTimes(1)
  })

  it('shows an error toast and clears loading state when session creation fails', async () => {
    paymentAPI.createDodoCheckout.mockRejectedValueOnce({
      response: { data: { message: 'Dodo not configured' } },
    })

    const { result } = renderHook(() => useDodoCheckout())

    await act(async () => {
      await result.current.startDodoCheckout('pro')
    })

    expect(toast.error).toHaveBeenCalledWith('Dodo not configured')
    expect(result.current.loadingPlan).toBeNull()
  })
})

describe('useDodoCheckout — return-from-Dodo verification (polls, never trusts the URL status)', () => {
  it('activates once refreshUser reflects the pending plan, without ever reading the URL status param', async () => {
    mockSearchParams = new URLSearchParams('dodo_return=1&payment_id=pay_1&status=succeeded')
    sessionStorage.setItem('dodo_pending_plan', 'pro')
    const refreshUser = vi.fn(() => {
      useAuthStore.setState({ user: { plan: 'pro' } })
      return Promise.resolve()
    })
    useAuthStore.setState({ refreshUser })
    const onSuccess = vi.fn()

    renderHook(() => useDodoCheckout({ onSuccess }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Plan activated!'))
    expect(refreshUser).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledWith('pro')
    expect(mockSetSearchParams).toHaveBeenCalled()
  })

  it('polls again if the plan has not updated yet, then activates on a later attempt', async () => {
    mockSearchParams = new URLSearchParams('dodo_return=1')
    sessionStorage.setItem('dodo_pending_plan', 'creator')
    let call = 0
    const refreshUser = vi.fn(() => {
      call += 1
      if (call >= 2) useAuthStore.setState({ user: { plan: 'creator' } })
      return Promise.resolve()
    })
    useAuthStore.setState({ refreshUser, user: { plan: 'free' } })

    renderHook(() => useDodoCheckout())

    await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Plan activated!'), {
      timeout: 5000,
    })
    expect(refreshUser.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('does nothing when dodo_return is not present', () => {
    renderHook(() => useDodoCheckout())

    expect(mockSetSearchParams).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('clears the return params without activating when there is no pending plan in sessionStorage', async () => {
    mockSearchParams = new URLSearchParams('dodo_return=1')
    // sessionStorage deliberately left empty — simulates a stale/replayed return URL.

    renderHook(() => useDodoCheckout())

    await waitFor(() => expect(mockSetSearchParams).toHaveBeenCalled())
    expect(toast.success).not.toHaveBeenCalled()
  })
})
