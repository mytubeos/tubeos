# Google Play removal: login reliability recovery

Google's October 15 notice identifies version code 3 under Broken Functionality
(unresponsive app). The evidence shows the sign-in flow returning to the login
screen. It does not establish that the TWA architecture caused the removal.

## Confirmed code defect

The shared Axios interceptor treated a 401 from `/auth/login` as an expired
session and assigned `window.location.href = '/login'`. This reload could clear
the entered credentials and hide the backend's error. Public authentication
failures now reject back to the form, preserving the input and visible error.

Refresh requests now have a 60-second timeout. Offline, timeout and server
failures no longer erase refresh credentials; a definitive 401/403 still clears
the session. Queued requests settle when refresh fails, and each request gets
at most one refresh retry. Login explains a slow connection after eight seconds
and gives actionable timeout/network errors. Successful verification on the
login page navigates to the dashboard.

## Validation

- 213 frontend tests pass, including real store/interceptor/form integration
  with a 401 followed by a successful retry. HTTP responses in tests are simulated.
- Production build and TypeScript pass; lint has zero errors (16 existing warnings).
- Live unauthenticated health request returned 200. A single diagnostic login
  with deliberately invalid example.com credentials returned 401 and correct
  `Access-Control-Allow-Origin: https://vezrin.com`.
- These observations do not validate the reviewer account, a real successful
  login, the Android runtime, or all Google Play policy requirements.

## Required before resubmission

1. Verify the dedicated account entered under Play Console App content > App
   access. It must be usable by reviewers without access to a personal inbox or
   an expiring OTP. Use ordinary verified-account access, not a review bypass.
2. From a clean installation of the exact candidate Android build, record a
   successful login, dashboard access, back navigation and scrolling. Also test
   invalid password recovery, slow/offline network and relaunch with a session.
3. Confirm backend availability and examine authentication server logs during
   those attempts. Frontend error handling cannot repair a wrong password,
   inactive account, backend outage or missing server configuration.
4. Use the same application ID/signing identity and a version code higher than
   every previous upload. Test the signed candidate internally, then submit the
   compliant update for the existing removed app with accurate access instructions.
5. Do not claim resolution in an appeal or review note until the real flow has
   been verified. Google decides whether to reinstate the listing.

Keep credentials out of source code, logs, screenshots and public PRs.
