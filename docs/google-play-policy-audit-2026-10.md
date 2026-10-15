# Vezrin Google Play readiness audit — October 16, 2026

Scope: repository frontend, backend, Android manifest/build configuration,
dependency audit and the supplied Google removal evidence. Static inspection
and automated tests do not certify every runtime path or guarantee approval.
No access to the current Play declarations, production secrets, provider
contracts, reviewer account or physical Android device was assumed.

## Confirmed findings and changes

| Area                   | Finding                                                                                                             | Change / remaining boundary                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing removal       | Version code 3 was removed for unresponsive functionality; reviewer credentials also fail according to the owner    | PR #3 fixes login 401 reload and stalled refresh. The owner must reset/verify the dedicated reviewer account. No claim that a wrapper migration solves removal.                                                                                                       |
| Digital purchases      | Dodo checkout was reachable from the Play app without a verified Play Billing or eligible alternative-billing setup | New purchases paused for **all** clients at UI/hook and authenticated backend route, as requested by owner. Existing receipts, webhook processing and paid access remain. No reviewer/UA-specific switch.                                                             |
| Account deletion       | No prominent Settings path; only support email in privacy page                                                      | `/delete-account` is public and linked in Settings. Signed-in request requires current password and explicit confirmation. Signed-out users have a support-email path without reinstalling.                                                                           |
| Deletion semantics     | Admin “delete” did not deactivate access; purge removed only User/Channel documents                                 | Disable account, increment session version, clear sessions/tokens, cancel queued jobs and disconnect credentials. After 30 days cascade through account/channel data. Cleanup processing claim prevents restoring an account while its data is being purged.          |
| Stored files           | Deleting records could orphan staging and thumbnail files                                                           | Provider deletion occurs before dropping DB references. Failures keep references and are retried/logged. Configured Cloudinary user prefixes cover historical generated thumbnails. Verify provider credentials and backup retention before promising fulfillment.    |
| YouTube data           | Disconnect left local OAuth credentials behind                                                                      | Local channel credentials are removed on disconnect. YouTube-published content is not deleted; users are told to manage existing YouTube schedules and permissions there.                                                                                             |
| AI reporting           | No report path for generated text/images                                                                            | In-app reporting, authenticated bounded API, private admin queue (oldest open reports first) and report TTL. Reports are not public or sent by mail. Operators must monitor the queue and act.                                                                        |
| AI safety              | No common safety instruction or explicit Gemini safety settings                                                     | Add safety instruction to text/vision/image requests and medium-or-higher Gemini filters; retain provider filters. This is defense in depth, **not a validated complete moderation system**. Live red-team checks and provider data-use verification remain required. |
| AI data disclosure     | Privacy page omitted active providers and made unsupported security claims                                          | Explain task-specific AI processing, providers, user choices, reporting, retention and limitations near AI controls and in privacy page. No claim of zero provider retention, universal encryption or certified GDPR compliance.                                      |
| Slow external requests | AI calls and thumbnail fetch could wait unbounded                                                                   | Bound provider/YouTube metadata-token requests and image download; existing UI can surface failures instead of indefinite waiting.                                                                                                                                    |
| Thumbnail fetch        | User URL could reach arbitrary server/internal addresses and buffer large responses                                 | HTTPS host allowlist, redirects disabled, timeout, image MIME restriction and streaming 4 MB limit. Text-only scoring fallback is identified in API response.                                                                                                         |
| Authentication email   | Missing sender or email-send errors could still show “sent”                                                         | Auth mail now fails explicitly with actionable service error. Test delivery is explicitly fake; no live emails were sent. Account owner must verify Brevo/sender delivery and reset-email functionality.                                                              |
| Email compatibility    | Model rejected valid plus-addresses and longer TLDs; case/space handling differed                                   | Trim/lowercase consistently; retain password exactly as entered. Broaden model format validation.                                                                                                                                                                     |
| Error classification   | Unexpected login server errors were classified as 401                                                               | Server failures remain 5xx with a retryable message; device-history write failure does not block core login or weaken token revocation.                                                                                                                               |
| Diagnostics            | OTP/reset URLs and sensitive query parameters could enter logs                                                      | Remove plaintext auth-secret debug logs; request/error logging uses path without query. Sentry strips request bodies/headers, URL queries, identities and extra payloads. Check hosting-level logs independently.                                                     |
| CORS                   | Any `*.vercel.app` / `*.onrender.com` origin was accepted with credentials                                          | Exact configured origins only. Explicitly authorize trusted preview URLs through CORS_EXTRA_ORIGINS.                                                                                                                                                                  |
| Upload reliability     | Production without GCS could buffer a 2 GB upload in memory                                                         | Return actionable 503 when production streaming storage is unavailable. Local memory fallback limited to 50 MB; avoid duplicate stream callbacks. Verify deployed storage before offering uploads.                                                                    |
| Marketing/terms        | Hardcoded “88 spots”, unsupported click multiplier, auto-renewal claim despite manual access periods                | Remove unverified scarcity/multiplier claims; describe the purchase pause and actual access-period billing.                                                                                                                                                           |
| Offline messaging      | Cached app shell was described as fully ready offline                                                               | Message now clarifies sign-in/live data need internet.                                                                                                                                                                                                                |
| Dependencies           | npm audit reported production high/critical advisories                                                              | Apply compatible updates. Re-run audit records 0 high/critical production findings; moderate transitive advisories remain (backend 27, frontend 2), plus development-only findings. No forced major upgrades.                                                         |
| Android                | API target is already 36; TWA remains browser-backed                                                                | Preserve package/signing identity; disable cleartext and native backup. Candidate defaults 1.0.3 / code 5. Exact artifact must still be signed, inspected and device-tested.                                                                                          |

## Release blockers outside this patch

1. **Reviewer account:** test the exact App access credentials in a clean browser
   and signed Android install. It must be a real verified account with sufficient
   access, no personal inbox/expiring OTP dependency. Never create a review-only
   code bypass. Update Console credentials and access instructions after testing.
2. **Android evidence:** install the exact signed candidate, test login/retry,
   reset, onboarding, keyboard/back/scroll, network interruption, re-entry,
   YouTube OAuth return, file upload/schedule, deletion and report controls.
   AAB build/lint alone does not prove these work. Check Android vitals and
   pre-launch report, app links/Play signing certificate, target/API/device
   compatibility and 16 KB compatibility of the final artifact.
3. **Billing:** paused purchases are deliberate. Do not re-enable external
   checkout in Play-distributed flows until a supported billing integration or
   documented eligible program is implemented and tested. Review existing
   recurring processor subscriptions separately if any exist outside this code.
4. **Data safety and listing:** manually compare the current Console form with
   this code: account identifiers, photos/videos, YouTube/comments, diagnostics,
   payment/referral data, optional versus required collection, third-party
   processing/sharing definitions, security, deletion URL and retention. Use
   `https://vezrin.com/delete-account` and the current privacy URL. Also verify
   target audience, content rating, ads declaration, developer contacts, store
   screenshots/descriptions and feature claims. These were not accessed here.
5. **Providers/operations:** confirm sender domain/inbox, backend uptime, actual
   cloud storage deletion permissions, backup/log retention, alerting and that
   the retention worker runs. Test sample deletion including provider files
   before advertising it as completed. Process public email requests promptly.
6. **AI:** validate harmful-content handling across every enabled text/image
   provider; system instructions alone are insufficient. Verify configured
   account/model availability, retention and training/data-use terms, especially
   for YouTube data. Review YouTube API/Google user-data requirements and obtain
   any required disclosure/consent or change provider routing before release.
   Monitor `/admin/content-reports` regularly and change safeguards based on reports.
7. **Remaining dependency advisories:** assess moderate Sentry/OpenTelemetry,
   uuid/GCS and router advisories and plan supported upgrades. Development
   tooling also has advisories; do not expose dev servers to untrusted networks.
8. After the above checks, submit an accurate compliant update for the existing
   removed listing. Google alone decides reinstatement. No appeal was sent.

## Sources checked

- [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [AI-generated content](https://support.google.com/googleplay/android-developer/answer/13985936)
- [Target API requirements](https://developer.android.com/google/play/requirements/target-sdk)
- [16 KB compatibility](https://developer.android.com/guide/practices/page-sizes)
- [Gemini safety settings](https://ai.google.dev/gemini-api/docs/safety-settings)

Validation results belong in the PR after CI finishes. Backend Mongo test
startup is restricted in the local execution environment; CI is required.
