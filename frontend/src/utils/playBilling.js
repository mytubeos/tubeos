export const PLAY_METHOD = 'https://play.google.com/billing'
export const hasOpenPlaySubscription = (purchases) =>
  purchases.some(
    (p) =>
      [
        'SUBSCRIPTION_STATE_ACTIVE',
        'SUBSCRIPTION_STATE_IN_GRACE_PERIOD',
        'SUBSCRIPTION_STATE_PENDING',
        'SUBSCRIPTION_STATE_ON_HOLD',
        'SUBSCRIPTION_STATE_PAUSED',
      ].includes(p.state) ||
      (p.state === 'SUBSCRIPTION_STATE_CANCELED' && new Date(p.expiresAt) > new Date())
  )
export const chooseBillingChannel = async (config, origin, browser = window) => {
  if (config.webEnabled && config.webOrigin === origin) return { mode: 'web', details: {} }
  if (
    !config.playEnabled ||
    typeof browser.getDigitalGoodsService !== 'function' ||
    !browser.PaymentRequest
  )
    return { mode: 'unavailable', details: {} }
  // No user-agent, query parameter, local-storage or reviewer-specific fallback.
  // Old wrappers/unsupported browsers stay unavailable, never use Dodo in-app.
  const service = await browser.getDigitalGoodsService(PLAY_METHOD)
  const items = await service.getDetails(config.products.map((p) => p.productId))
  const details = {}
  for (const product of config.products) {
    const item = items.find((i) => i.itemId === product.productId)
    if (item?.price?.currency && Number(item.price.value) > 0) details[product.plan] = item
  }
  return { mode: 'play', service, details }
}
export const formatPlayPrice = (item) =>
  new Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency: item.price.currency,
  }).format(Number(item.price.value))

export const purchaseOnPlay = async (
  item,
  verify,
  BrowserPaymentRequest = window.PaymentRequest
) => {
  // Invoke show() directly from the user gesture; async catalogue work has
  // already completed before the button becomes enabled.
  const request = new BrowserPaymentRequest(
    [{ supportedMethods: PLAY_METHOD, data: { sku: item.itemId } }],
    { total: { label: item.title || 'Vezrin plan', amount: item.price } }
  )
  const response = await request.show()
  try {
    if (!response.details?.purchaseToken)
      throw new Error(
        'Purchase confirmation is pending. Use Restore purchases before trying to buy again.'
      )
    const result = await verify(response.details.purchaseToken)
    await response.complete(result.active ? 'success' : 'unknown').catch(() => {})
    return result
  } catch (err) {
    await response.complete('unknown').catch(() => {})
    throw err
  }
}
