import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/api/referral.api', () => ({
  default: {
    getStats: vi.fn(),
    getEarnings: vi.fn(),
    getReferrals: vi.fn(),
    getPayouts: vi.fn(),
    requestPayout: vi.fn(),
  },
}))

vi.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({ user: { plan: 'agency', referral: { myCode: 'RAJ123' } } }),
}))

import referralAPI from '../../src/api/referral.api'
import { Referral } from '../../src/pages/referral/Referral'

describe('Referral withdraw flow (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    referralAPI.getStats.mockResolvedValue({
      data: {
        data: {
          code: 'RAJ123',
          tier: 'Grower',
          commissionRate: 12,
          totalReferrals: 12,
          activeReferrals: 5,
          minPayout: 200,
          wallet: { balance: 500, totalEarned: 800, totalWithdrawn: 100, pendingPayout: 0 },
        },
      },
    })
  })

  it('shows the withdraw button with the real balance', async () => {
    render(<Referral />)
    await waitFor(() => expect(referralAPI.getStats).toHaveBeenCalled())
    expect(await screen.findByText('₹500')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeEnabled()
  })

  it('disables withdraw when balance is below minPayout', async () => {
    referralAPI.getStats.mockResolvedValue({
      data: {
        data: {
          code: 'RAJ123',
          minPayout: 200,
          wallet: { balance: 50, totalEarned: 50, totalWithdrawn: 0, pendingPayout: 0 },
        },
      },
    })
    render(<Referral />)
    await waitFor(() => expect(referralAPI.getStats).toHaveBeenCalled())
    expect(await screen.findByText(/minimum ₹200 required/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /withdraw/i })).toBeDisabled()
  })

  it('opens the modal and submits a UPI payout request', async () => {
    referralAPI.requestPayout.mockResolvedValue({
      data: { message: 'Payout request submitted. Processed within 3 business days.' },
    })
    const user = userEvent.setup()
    render(<Referral />)
    await waitFor(() => expect(referralAPI.getStats).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /withdraw/i }))
    expect(screen.getByText('Withdraw Earnings')).toBeInTheDocument()

    await user.type(screen.getByLabelText('UPI ID'), 'raj@upi')
    await user.click(screen.getByRole('button', { name: /request payout/i }))

    await waitFor(() =>
      expect(referralAPI.requestPayout).toHaveBeenCalledWith({
        amount: 500,
        method: 'upi',
        upi: 'raj@upi',
        bankAccount: undefined,
      })
    )
  })

  it('switches to bank method and requires all bank fields', async () => {
    const user = userEvent.setup()
    render(<Referral />)
    await waitFor(() => expect(referralAPI.getStats).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /withdraw/i }))
    await user.selectOptions(screen.getByLabelText('Payout Method'), 'bank')

    await user.click(screen.getByRole('button', { name: /request payout/i }))
    // Missing bank fields — request should NOT fire
    expect(referralAPI.requestPayout).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Account Holder Name'), 'Raj Yadav')
    await user.type(screen.getByLabelText('Account Number'), '1234567890')
    await user.type(screen.getByLabelText('IFSC Code'), 'hdfc0001234')

    await user.click(screen.getByRole('button', { name: /request payout/i }))

    await waitFor(() =>
      expect(referralAPI.requestPayout).toHaveBeenCalledWith({
        amount: 500,
        method: 'bank',
        upi: undefined,
        bankAccount: { accountNumber: '1234567890', ifsc: 'HDFC0001234', holderName: 'Raj Yadav' },
      })
    )
  })
})
