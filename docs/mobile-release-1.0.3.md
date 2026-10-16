# Vezrin 1.0.3 / version code 5 release checklist

This candidate includes the mobile polish, login recovery and policy safeguards
merged through `4bbcdb37c5641195bb01fe913620265dfa5a745a`.
The Android package remains `com.vezrin.app`, a Trusted Web Activity opening
`https://vezrin.com/app`. Native migration has not been implemented.

## Available build

[Android workflow 38798046543](https://github.com/mytubeos/tubeos/actions/runs/38798046543)
passed build and lint for source commit
`cfd8fbad736d38147b58152f1248f84c9859d4c6`, subsequently merged in PR #4.
Download its `android-test-builds-unsigned-release` artifact:

| File | Use | Limitation |
| --- | --- | --- |
| Debug APK | Developer smoke testing | Debug certificate differs from Play signing; fullscreen domain trust cannot be established from this test alone. |
| Release AAB | Candidate for signing with the existing upload key | Unsigned; cannot be submitted as-is. |
| Release lint HTML | Build diagnostics | Does not establish runtime or policy compliance. |

The ZIP digest reported by GitHub is
`sha256:4e51a12778a98edfa29d47b149ca4b3c3ea9ca28f84c759899febf240b8e2c45`.
Confirm the artifact source and inspect its manifest/version before signing.
Code 5 is usable only if it exceeds every version already uploaded in Console;
otherwise rebuild with a higher code.

## Required order

1. Verify a dedicated, real reviewer account in a clean browser. Registration,
   email verification and successful dashboard access must work. If credentials
   fail, reset them and test again before updating Console App access. Preserve
   the password exactly; do not put credentials in this repository or reports.
2. Sign the release AAB with the existing Play upload key. Compare its upload
   certificate against Console's **upload key certificate**, not the separate
   Play app-signing certificate. Do not use a newly generated PWABuilder key.
3. Upload to an internal test track and install through Play using an eligible
   tester account. Check the installed version, package and app links. This is
   the build to use for release evidence; the debug APK is insufficient.
4. Run the checks below, capture failures, and resolve them before production.
5. Reconcile Console App access, Data safety, privacy/deletion links, target
   audience, content rating, ads and listing claims against the current app.
   Complete provider/AI operational checks in the policy audit.
6. Submit the corrected update for the existing removed listing with accurate
   review instructions. Google decides whether to reinstate it.

## Device checks and evidence

Record device/Android version, browser provider/version, installed version code,
date and result for each row. Use test content and a dedicated test account for
destructive actions. Account deletion requires a separate disposable account;
do not delete the reviewer account.

| Check | Expected result |
| --- | --- |
| Cold launch and re-entry | Welcome/dashboard loads; no indefinite spinner. Record any browser toolbar flash. |
| Wrong password, then correct password | Wrong password shows an error without losing form state; correct credentials reach dashboard. |
| Slow/offline login and retry | Actionable error or slow-state message; reconnect/retry succeeds. |
| Reset password | Email really arrives, link opens the intended page, new password works and old password fails. |
| Navigation and keyboard | Back, scroll, keyboard and small-screen controls remain usable; menus are not clipped. |
| YouTube authorization and return | Consent completes, app returns correctly and channel data loads. |
| Video upload and schedule | Real small test upload completes and schedule status is accurate; clean up test content. |
| Purchases | New purchase controls stay paused; existing entitled features remain accessible. |
| AI generation and report | Allowed content works; live safety cases are handled; report reaches the private admin queue. |
| Deletion | Public request path works; disposable account is deactivated and queued data/provider cleanup is verified. |
| Notifications | Permission choice and notification tap return work on supported versions. |

No physical-device, real reviewer-login, signed-release or Console verification
has been completed by the automated repository checks. See
[the policy audit](google-play-policy-audit-2026-10.md) for the complete remaining
provider, data-use, retention and declaration checks.
