# Vezrin: Dodo web checkout and Google Play subscriptions

Status: implementation candidate, not live payment activation. The existing
1.0.3/code 5 Play release has no billing bridge. Candidate 1.0.4/code 6 adds it.
Use a higher version code if 6 has already been uploaded. Keep both new-purchase
flags off until the corresponding provider configuration and payment checks pass.
Existing Dodo payment webhooks remain available.

## Routes and purchase behavior

| Surface                                                         | Purchase provider                             | Access                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `https://buy.vezrin.com` (configure first)                      | Dodo hosted checkout                          | One month of access, manual renewal, existing USD admin prices.                              |
| `https://vezrin.com` inside the new Play-installed TWA          | Google Play Billing through Digital Goods API | One monthly auto-renewing subscription, using Play's localized price and confirmation sheet. |
| Old wrapper or browser without a supported Play billing service | New purchases unavailable                     | Existing account access continues. No external-checkout fallback.                            |

Both providers update the same authenticated Vezrin account. A Google purchase
token can belong to only one account. The ABH billing bridge does not provide
an obfuscated Vezrin account ID: users must sign in to the original Vezrin account
when restoring. A unique server-side token claim prevents moving a purchase to
another account. Lost-account recovery requires ownership verification by support.

The application origin must never contain a link/button leading to the separate
Dodo storefront. Do not add `buy.vezrin.com` to the wrapper's trusted/launch hosts
or asset links. Do not decide billing by user-agent, reviewer identity, query
parameter, local storage or a failed DGAPI call. Any new app-origin navigation
to external purchase destinations needs a fresh policy review.

## Dodo setup

1. Add `buy.vezrin.com` to the existing frontend's Vercel domain configuration and
   create the DNS record Vercel specifies. The same frontend works on both origins.
   The checkout host is a separate browser storefront, not an app navigation link.
2. Add `https://buy.vezrin.com` to backend `CORS_EXTRA_ORIGINS` along with any
   already-authorized origins. Keep `CLIENT_URL=https://vezrin.com`.
3. Verify the existing Dodo account is approved for live payments/payouts. Keep
   API key, webhook secret and product IDs in backend environment variables.
4. Configure the three existing plan products as **one-time Pay-What-You-Want**
   products so the backend's existing admin price can be passed to checkout.
   Do not use recurring products with this one-month manual-access handler.
5. Keep the signed Standard Webhooks endpoint
   `https://api.vezrin.com/api/v1/payment/dodo/webhook`, subscribed to
   `payment.succeeded`. New checkout metadata includes a server-created intent;
   activation validates its session, account, product and plan. Redirect query
   parameters cannot activate access. Existing recorded receipts remain idempotent.
6. Confirm there are no unfulfilled pre-migration sessions before enabling strict
   intents. Previously recorded receipts are still recognized; unknown legacy
   payments need manual support/refund review rather than automatic access.
7. Run a sandbox checkout with a real test account: valid redirect, signed webhook,
   correct account/price/plan, refresh/re-login, duplicate delivery and failed checkout.
   Review a refund in Dodo and reconcile Vezrin access manually: automatic Dodo
   refund/chargeback entitlement adjustments are **not implemented** in this candidate.
   Establish this support procedure before accepting real payments.
8. Configure live credentials and enable the web flag only after these checks.

```dotenv
DODO_WEB_ENABLED=false
DODO_WEB_ORIGIN=https://buy.vezrin.com
DODO_REQUIRE_CHECKOUT_INTENT=true
DODO_MODE=test
DODO_PAYMENTS_API_KEY=
DODO_WEBHOOK_SECRET=
DODO_PRODUCT_ID_CREATOR=
DODO_PRODUCT_ID_PRO=
DODO_PRODUCT_ID_MAX=
```

Do not put secrets into GitHub, chat, frontend variables or screenshots. Use
`DODO_MODE=live` only for the live merchant account's IDs and credentials.

## Google Play setup

1. In the existing Vezrin listing, complete the payments/merchant profile and
   payout bank setup. Under **Monetize with Play → Products → Subscriptions**, create:

| Product ID (exact)       | Existing Vezrin plan      | Base plan ID |
| ------------------------ | ------------------------- | ------------ |
| `vezrin_creator_monthly` | Creator                   | `monthly`    |
| `vezrin_pro_monthly`     | Pro                       | `monthly`    |
| `vezrin_max_monthly`     | Max (`agency` internally) | `monthly`    |

2. Give each product exactly **one monthly auto-renewing base plan**, with no
   trials/offers/additional base plans in this release. Set the previously agreed
   prices, countries and localized prices in Play Console; activate the products
   and base plans. DGAPI/ABH exposes only the first eligible offer, so multiple
   offers are deliberately unsupported. Mid-period upgrades/downgrades are also
   not offered: manage/cancel the existing subscription before another purchase.
3. Enable the Google Play Android Developer API in the chosen Google Cloud
   project. Create a service account and grant it the required app-specific
   subscription/order-management permissions in Play Console (not broad owner
   access). Put its JSON credentials in backend `PLAY_SERVICE_ACCOUNT_JSON`.
4. Generate a separate 32-byte encryption key and save its 64-character hex form
   in `PLAY_TOKEN_ENCRYPTION_KEY`. Keep a secure backup; changing it without
   migrating stored tokens prevents reconciliation of existing purchases.
5. Set up a Google Cloud Pub/Sub topic and authenticated push subscription for
   real-time developer notifications. Grant Play's notification publisher account
   topic publishing access following Google's setup guide. Configure the listing
   to publish RTDN to that topic, and send a test notification.
6. Push endpoint: `https://api.vezrin.com/api/v1/billing/play/notifications`.
   Use a dedicated push service account. Set `PLAY_RTDN_SERVICE_ACCOUNT_EMAIL` to
   that exact email and `PLAY_RTDN_AUDIENCE` to the push audience (normally this URL).
   The server verifies Google OIDC identity/audience/email, validates the package
   and fetches current subscription state from Google; event order grants no access.
7. Build/sign candidate 1.0.4/code 6 with the existing upload key and install from
   a Play internal track with a license tester. The existing app-signing asset
   links stay in place. Use a browser provider supporting Digital Goods API.
   The new ABH billing 1.2.0 dependency uses Play Billing Library 8.3.0.
8. Temporarily enable test purchases only for the controlled test period. Confirm
   buy/cancel, pending payment, purchase restoration on the original account,
   cross-account rejection, renewal, grace period, on-hold, expiry/refund,
   authenticated RTDN delivery, webhook retry and account deletion disclosure.
   Verify purchase acknowledgement, correct same-account access on the website,
   receipts in Google Play and the server's hourly reconciliation worker.
9. Disable test purchases before ordinary production use unless a controlled
   license-testing session explicitly requires them. Enable new Play purchases
   only after real product/API/RTDN and signed-device checks pass.

```dotenv
PLAY_BILLING_ENABLED=false
PLAY_ALLOW_TEST_PURCHASES=false
PLAY_SERVICE_ACCOUNT_JSON=
PLAY_TOKEN_ENCRYPTION_KEY=
PLAY_RTDN_AUDIENCE=https://api.vezrin.com/api/v1/billing/play/notifications
PLAY_RTDN_SERVICE_ACCOUNT_EMAIL=
```

Turning `PLAY_BILLING_ENABLED` off pauses new in-app sales. Keep credentials,
RTDN and reconciliation running for existing subscriptions. Credentials and
encryption key must remain solely in the backend environment.

Google cancellations keep access until the verified expiry. Active/grace/canceled
states with future expiry retain access; pending/hold/paused/expired states do not.
Transient Google verification errors preserve access through the last verified expiry and retry. Google
purchase tokens are stored encrypted; status/order references are shown in-app,
but monetary receipts remain in Play order history, not fabricated local charges.
Account deletion does not cancel Google subscriptions automatically; the deletion
page explains cancellation in Play and still permits deletion without it.

## Deployment and marketing gate

Merge/deploy the code with both flags **off** first, then configure the separate
web origin, provider accounts and test environments. No live charge, refund,
provider-dashboard change or Play upload was performed by the code checks.
This document does not certify policy approval or merchant approval.

After both purchase paths have real provider-backed evidence, confirm production
flags and the signed Android release. Marketing should link web customers to the
separate web storefront and Android customers to the Play listing. Track completed
paid activations and returning users rather than checkout-button clicks alone.

Sources: [Chrome TWA billing](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing),
[ABH billing 8 migration](https://github.com/GoogleChrome/android-browser-helper/blob/main/playbilling/docs/play-billing-library-8-migration.md),
[Google verification security](https://developer.android.com/google/play/billing/security),
[Subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions),
[Play Developer API](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2),
[Dodo API source](https://github.com/dodopayments/dodopayments-typescript/blob/main/src/resources/payments.ts),
[Play Payments FAQ](https://support.google.com/googleplay/android-developer/answer/10281818).
