import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../../src/api/payment.api', () => ({
  default: {
    createOrder: vi.fn(),
    verifyPayment: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const { useRazorpay } = await import('../../src/hooks/useRazorpay')
const { useAuthStore } = await import('../../src/store/authStore')
const paymentAPI = (await import('../../src/api/payment.api')).default
const toast = (await import('react-hot-toast')).default

// The hook injects a <script id="razorpay-script"> tag and waits for its
// onload event. Pre-seed the tag so loadRazorpayScript() resolves instantly
// instead of hanging forever in jsdom (which never fires script onload).
beforeEach(() => {
  document.body.innerHTML = ''
  const script = document.createElement('script')
  script.id = 'razorpay-script'
  document.body.appendChild(script)

  window.Razorpay = vi.fn().mockImplementation((options) => ({
    open: vi.fn(),
    on: vi.fn(),
    _options: options,
  }))
})

describe('useRazorpay.startCheckout', () => {
  it('creates an order and opens the Razorpay checkout modal', async () => {
    paymentAPI.createOrder.mockResolvedValueOnce({
      data: {
        data: {
          orderId: 'order_1',
          amount: 49900,
          currency: 'INR',
          keyId: 'rzp_test_key',
          userName: 'Raj',
          userEmail: 'raj@example.com',
          label: 'Pro Plan',
        },
      },
    })

    const { result } = renderHook(() => useRazorpay())

    await act(async () => {
      await result.current.startCheckout('pro', 'SAVE20')
    })

    expect(paymentAPI.createOrder).toHaveBeenCalledWith('pro', 'SAVE20')
    expect(window.Razorpay).toHaveBeenCalledWith(
      expect.objectContaining({ order_id: 'order_1', amount: 49900, key: 'rzp_test_key' })
    )
  })

  it('ignores a second call while a checkout is already loading', async () => {
    paymentAPI.createOrder.mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useRazorpay())

    // Synchronous act() flushes the setLoadingPlan() call that happens
    // before startCheckout's first await, so loadingPlan is up to date
    // before we fire the second call — otherwise it'd race a stale closure.
    act(() => {
      result.current.startCheckout('pro')
    })

    expect(result.current.loadingPlan).toBe('pro')

    // loadRazorpayScript() resolves over a microtask, so createOrder isn't
    // called until that settles — wait for it before firing the 2nd call.
    await waitFor(() => expect(paymentAPI.createOrder).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.startCheckout('pro')
    })

    expect(paymentAPI.createOrder).toHaveBeenCalledTimes(1)
  })

  it('shows an error toast when order creation fails', async () => {
    paymentAPI.createOrder.mockRejectedValueOnce({
      response: { data: { message: 'Coupon invalid' } },
    })

    const { result } = renderHook(() => useRazorpay())

    await act(async () => {
      await result.current.startCheckout('pro', 'BADCODE')
    })

    expect(toast.error).toHaveBeenCalledWith('Coupon invalid')
    expect(result.current.loadingPlan).toBeNull()
  })

  it("updates the user's plan and calls onSuccess after the payment handler verifies", async () => {
    paymentAPI.createOrder.mockResolvedValueOnce({
      data: {
        data: {
          orderId: 'order_1',
          amount: 49900,
          currency: 'INR',
          keyId: 'rzp_test_key',
          userName: 'Raj',
          userEmail: 'raj@example.com',
          label: 'Pro Plan',
        },
      },
    })
    paymentAPI.verifyPayment.mockResolvedValueOnce({})
    const onSuccess = vi.fn()

    const { result } = renderHook(() => useRazorpay({ onSuccess }))

    await act(async () => {
      await result.current.startCheckout('pro')
    })

    const razorpayOptions = window.Razorpay.mock.calls[0][0]
    await act(async () => {
      await razorpayOptions.handler({
        razorpay_order_id: 'order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig_1',
      })
    })

    expect(paymentAPI.verifyPayment).toHaveBeenCalledWith({
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: 'sig_1',
      plan: 'pro',
      couponCode: null,
    })
    expect(useAuthStore.getState().user?.plan).toBe('pro')
    expect(onSuccess).toHaveBeenCalledWith('pro')
  })
})
