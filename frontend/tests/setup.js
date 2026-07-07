import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

// Default waitFor/findBy timeout (1000ms) is too tight when many test files
// run in parallel and CPU is contended (e.g. CI) — bump it so slow renders
// don't turn into flaky failures.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => {
  cleanup()
  localStorage.clear()
  // resetAllMocks (not just restoreAllMocks) — plain vi.fn() mocks created by
  // vi.mock() factories aren't spies, so restoreAllMocks leaves their queued
  // mockResolvedValueOnce()/mockRejectedValueOnce() values to leak into the
  // next test. reset clears those queues too.
  vi.resetAllMocks()
})

beforeEach(() => {
  localStorage.clear()
})

if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  })
}
