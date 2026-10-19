import { describe, it, expect, vi } from 'vitest'
import { chooseBillingChannel, purchaseOnPlay, PLAY_METHOD } from '../../src/utils/playBilling'
const item = { itemId: 'vezrin_pro_monthly', title: 'Pro', price: { currency: 'USD', value: '9' } }
const config = {
  webEnabled: true,
  webOrigin: 'https://buy.vezrin.com',
  playEnabled: true,
  products: [{ productId: item.itemId, plan: 'pro' }],
}
describe('platform payment routing', () => {
  it('only enables Dodo on the exact dedicated origin', async () => {
    expect((await chooseBillingChannel(config, 'https://buy.vezrin.com', {})).mode).toBe('web')
    for (const origin of ['https://vezrin.com', 'https://buy.vezrin.com.attacker.test'])
      expect((await chooseBillingChannel(config, origin, {})).mode).toBe('unavailable')
  })
  it('unsupported or disabled Play billing never falls back to external checkout', async () => {
    const browser = {
      PaymentRequest: vi.fn(),
      getDigitalGoodsService: vi.fn().mockRejectedValue(new Error('not supported')),
    }
    await expect(chooseBillingChannel(config, 'https://vezrin.com', browser)).rejects.toThrow()
    expect(
      (await chooseBillingChannel({ ...config, playEnabled: false }, 'https://vezrin.com', browser))
        .mode
    ).toBe('unavailable')
  })
  it('uses product details from Google for the configured IDs', async () => {
    const getDetails = vi.fn().mockResolvedValue([item])
    const browser = {
      PaymentRequest: vi.fn(),
      getDigitalGoodsService: vi.fn().mockResolvedValue({ getDetails }),
    }
    const result = await chooseBillingChannel(config, 'https://vezrin.com', browser)
    expect(browser.getDigitalGoodsService).toHaveBeenCalledWith(PLAY_METHOD)
    expect(result.details.pro).toBe(item)
  })
  it('reports success only after server validation and never consumes a subscription', async () => {
    const complete = vi.fn().mockResolvedValue()
    const verify = vi.fn().mockResolvedValue({ active: true })
    const show = vi.fn().mockResolvedValue({ details: { purchaseToken: 'token-secret' }, complete })
    class Request {
      show = show
    }
    await purchaseOnPlay(item, verify, Request)
    expect(verify).toHaveBeenCalledWith('token-secret')
    expect(complete).toHaveBeenCalledWith('success')
  })
  it('retains a pending/uncertain result rather than declaring payment failed or paid', async () => {
    const complete = vi.fn().mockResolvedValue()
    class Request {
      show = async () => ({ details: { purchaseToken: 'token-secret' }, complete })
    }
    await purchaseOnPlay(item, async () => ({ active: false }), Request)
    expect(complete).toHaveBeenCalledWith('unknown')
    await expect(
      purchaseOnPlay(
        item,
        async () => {
          throw new Error('verification offline')
        },
        Request
      )
    ).rejects.toThrow('verification offline')
    expect(complete).not.toHaveBeenCalledWith('success')
  })
})
