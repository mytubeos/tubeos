import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../../src/api/payment.api', () => ({
  default: {
    createStripeCheckout: vi.fn(),
    verifyStripeSession: vi.fn(),
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

const { useStripeCheckout } = await import('../../src/hooks/useStripeCheckout')
const { useAuthStore } = await import('../../src/store/authStore')
const paymentAPI = (await import('../../src/api/payment.api')).default
const toast = (await import('react-hot-toast')).default

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchParams = new URLSearchParams()
  // jsdom throws "Not implemented: navigation" on a real href assignment —
  // replace window.location with a plain writable object for these tests.
  delete window.location
  window.location = { href: '' }
})

describe('useStripeCheckout.startStripeCheckout', () => {
  it('creates a session and redirects the browser to its hosted URL', async () => {
    paymentAPI.createStripeCheckout.mockResolvedValueOnce({
      data: { data: { sessionId: 'cs_1', url: 'https://checkout.stripe.com/pay/cs_1' } },
    })

    const { result } = renderHook(() => useStripeCheckout())

    await act(async () => {
      await result.current.startStripeCheckout('pro', 'EUR', 'SAVE20')
    })

    expect(paymentAPI.createStripeCheckout).toHaveBeenCalledWith('pro', 'EUR', 'SAVE20')
    expect(window.location.href).toBe('https://checkout.stripe.com/pay/cs_1')
  })

  it('defaults to INR when no currency is passed', async () => {
    paymentAPI.createStripeCheckout.mockResolvedValueOnce({
      data: { data: { sessionId: 'cs_2', url: 'https://checkout.stripe.com/pay/cs_2' } },
    })

    const { result } = renderHook(() => useStripeCheckout())

    await act(async () => {
      await result.current.startStripeCheckout('pro')
    })

    expect(paymentAPI.createStripeCheckout).toHaveBeenCalledWith('pro', 'INR', null)
  })

  it('ignores a second call while one is already loading', async () => {
    paymentAPI.createStripeCheckout.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useStripeCheckout())

    act(() => {
      result.current.startStripeCheckout('pro')
    })
    expect(result.current.loadingPlan).toBe('pro')

    act(() => {
      result.current.startStripeCheckout('pro')
    })

    expect(paymentAPI.createStripeCheckout).toHaveBeenCalledTimes(1)
  })

  it('shows an error toast and clears loading state when session creation fails', async () => {
    paymentAPI.createStripeCheckout.mockRejectedValueOnce({
      response: { data: { message: 'Stripe not configured' } },
    })

    const { result } = renderHook(() => useStripeCheckout())

    await act(async () => {
      await result.current.startStripeCheckout('pro')
    })

    expect(toast.error).toHaveBeenCalledWith('Stripe not configured')
    expect(result.current.loadingPlan).toBeNull()
  })
})

describe('useStripeCheckout — return-from-Stripe verification', () => {
  it('verifies the session, activates the plan, and strips the URL param on success', async () => {
    mockSearchParams = new URLSearchParams('stripe_session_id=cs_return1')
    paymentAPI.verifyStripeSession.mockResolvedValueOnce({ data: { data: { plan: 'agency' } } })
    const onSuccess = vi.fn()

    renderHook(() => useStripeCheckout({ onSuccess }))

    await waitFor(() => expect(paymentAPI.verifyStripeSession).toHaveBeenCalledWith('cs_return1'))
    expect(useAuthStore.getState().user?.plan).toBe('agency')
    expect(toast.success).toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledWith('agency')
    expect(mockSetSearchParams).toHaveBeenCalled()
  })

  it('shows an error toast if verification fails, without throwing', async () => {
    mockSearchParams = new URLSearchParams('stripe_session_id=cs_return_bad')
    paymentAPI.verifyStripeSession.mockRejectedValueOnce(new Error('not paid yet'))

    renderHook(() => useStripeCheckout())

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
  })

  it('shows a cancelled toast and does not call verifyStripeSession when stripe_cancelled is set', async () => {
    mockSearchParams = new URLSearchParams('stripe_cancelled=1')

    renderHook(() => useStripeCheckout())

    await waitFor(() => expect(toast).toHaveBeenCalledWith('Payment cancelled.'))
    expect(paymentAPI.verifyStripeSession).not.toHaveBeenCalled()
  })

  it('does nothing when neither param is present', () => {
    renderHook(() => useStripeCheckout())

    expect(paymentAPI.verifyStripeSession).not.toHaveBeenCalled()
    expect(toast).not.toHaveBeenCalled()
  })
})
