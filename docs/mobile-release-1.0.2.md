# Mobile polish release 1.0.2

The mobile recording exposed incomplete shared-control CSS, nested full-height authentication pages, timed reset redirects and video menus trapped beneath other cards.

## Changes

- Include TS/TSX in Tailwind's content scan. Shared buttons size to content and keep usable touch targets.
- Use one edge-to-edge authentication background for sign-in, signup and password recovery. Keep email/reset confirmation visible until the user chooses to leave; add resend cooldown and change-email action. Transport errors remain actionable. Reset success clears the now-invalid local session.
- Compact landing layout, readable secondary text and manually swiped plan cards with selectors, position dots and a comparison link. Remove hard-coded scarcity and unsubstantiated growth/time-saving hero metrics.
- Open video actions in a portalled, scrollable mobile sheet. Shared dialogs trap keyboard focus, restore it on dismissal and escape stacking contexts. Avoid the duplicate initial video fetch that could remove a menu while it was being tapped.
- Settings list on mobile, profile photo and bio, saved display timezone, existing billing/report preferences, operational upload/publish notices, device sessions, sign-out-other-devices and support links. The schedule editor continues to use the clearly labelled device timezone; saved display timezone affects formatted dates, not existing scheduled instants.
- Device tracking stores session ID, generation, approximate browser/OS, refresh/sign-in time and expiry, never credentials. Older sessions become visible after refresh; sign-out-other-devices also invalidates older untracked sessions through the existing session generation check.
- Operational notices respect their own toggles, independently of mascot nudges; delivery errors cannot fail an upload. These are in-app notices, not OS push notifications.
- Lazy page loading, branded startup fallback and channel-loading skeletons. `/app` is the compact installed-app welcome route and sends signed-in users to the dashboard.
- Android 1.0.2 (versionCode 4) and PWA launch at `/app`. The signing key, asset links and browser trust configuration are preserved.

## Verification

- Frontend: 205 existing/updated tests pass; build, TypeScript and ESLint pass (pre-existing lint warnings remain).
- Backend: TypeScript and ESLint pass locally. New session isolation/revocation and notification preference integration tests require MongoDB. The local MongoMemoryServer cannot start in this execution environment; GitHub CI must pass before merge.
- Chromium with mocked API data: 64 layout/interaction checks; public screens at 320/360/390/430/1280px, settings and video actions at 320/390/430/1280px, pricing selection, persistent reset-email confirmation and editing inside a dialog. No horizontal page overflow or JavaScript page errors. This is not a live payment/email/YouTube integration test.

## Release order and remaining gate

Deploy backend and frontend together after CI. Do not release the Android wrapper before `/app` is deployed. Check that versionCode 4 exceeds every Play upload, sign with the existing upload key, and upload through internal testing.

The provider-controlled opening toolbar flash is NOT confirmed fixed. The current wrapper uses a Trusted Web Activity; the web UI cannot hide browser security UI. Test a Play-signed internal build on the affected phone, with Chrome and the user's current provider, including cold/warm launch, email reset links, keyboard resize, Back, Google channel connection, upload/scheduling, checkout return and notification taps. Capture provider/version and domain-verification logs if the flash persists.

Marketing readiness requires this real-device gate plus a live smoke test of signup/email delivery, channel connection, a controlled upload and payment return. No live emails, purchases, public uploads or marketing messages were performed by this change.
