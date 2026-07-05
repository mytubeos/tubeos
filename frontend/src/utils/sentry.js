// src/utils/sentry.js
// Production error tracking. Optional — if VITE_SENTRY_DSN is unset,
// initSentry() is a no-op so local dev works without a Sentry account.

import * as Sentry from '@sentry/react'

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  })
}

export { Sentry }
