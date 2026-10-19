export const BillingControls = ({ billing, user }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300 my-4">
    {billing.mode === 'play' ? (
      <>
        <p>
          Google Play monthly subscriptions renew automatically until canceled. Confirm the price
          and renewal terms on the Google Play payment screen. Cancellation keeps access until the
          paid expiry.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Purchases belong to the Vezrin account signed in when restored. Use your original Vezrin
          account.
        </p>
        <button
          className="mt-3 underline text-brand disabled:opacity-50"
          disabled={billing.verifying}
          onClick={() => billing.restore()}
        >
          {billing.verifying ? 'Checking purchases…' : 'Restore purchases'}
        </button>
      </>
    ) : billing.mode === 'web' ? (
      <p>
        Secure checkout by Dodo Payments. This is a one-month access purchase, without automatic
        renewal. Payment activation may take a moment.
      </p>
    ) : (
      <p>
        {billing.mode === 'loading'
          ? 'Checking payment availability…'
          : 'New purchases are temporarily unavailable here. Existing paid access continues until its expiry.'}
      </p>
    )}
    {(user?.subscriptionProvider === 'google-play' || billing.playPurchases?.length > 0) && (
      <a
        className="block mt-3 underline text-brand"
        href="https://play.google.com/store/account/subscriptions?package=com.vezrin.app"
        target="_blank"
        rel="noopener noreferrer"
      >
        Manage or cancel in Google Play
      </a>
    )}
    {billing.playPurchases?.length > 0 && (
      <div className="mt-3 text-xs text-gray-400 space-y-2">
        <p>
          Google Play subscription records. Receipts and refunds are available in Google Play order
          history.
        </p>
        {billing.playPurchases.slice(0, 3).map((purchase) => (
          <p key={purchase._id} className="break-words">
            {purchase.productId}:{' '}
            {purchase.state.replace('SUBSCRIPTION_STATE_', '').toLowerCase().replaceAll('_', ' ')}
            {purchase.orderId ? ` · Order ${purchase.orderId}` : ''}
          </p>
        ))}
      </div>
    )}
  </div>
)
