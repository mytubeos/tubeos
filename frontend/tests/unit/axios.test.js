import { describe, it, expect, vi, afterEach } from 'vitest'
import axios, { AxiosError } from 'axios'
import api from '../../src/api/axios'

vi.mock('../../src/store/authStore', () => ({ useAuthStore: { setState: vi.fn() } }))
vi.mock('../../src/store/channelStore', () => ({
  useChannelStore: { getState: () => ({ clearChannels: vi.fn() }) },
}))
const originalAdapter = api.defaults.adapter
const rejectStatus = (config, status) =>
  Promise.reject(
    new AxiosError('Rejected', 'ERR_BAD_REQUEST', config, null, {
      status,
      data: { message: 'Invalid email or password' },
      config,
    })
  )
afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('auth HTTP failure handling', () => {
  it.each(['/auth/login', '/auth/reset-password?token=test', '/auth/verify-email'])(
    'keeps %s failures on the current screen without clearing a session',
    async (url) => {
      const location = { href: '/current-form' }
      vi.stubGlobal('window', { location })
      localStorage.setItem('accessToken', 'existing-access')
      localStorage.setItem('refreshToken', 'existing-refresh')
      api.defaults.adapter = (config) => rejectStatus(config, 401)
      const refresh = vi.spyOn(axios, 'post')
      await expect(api.post(url, {})).rejects.toMatchObject({ response: { status: 401 } })
      expect(location.href).toBe('/current-form')
      expect(refresh).not.toHaveBeenCalled()
      expect(localStorage.getItem('accessToken')).toBe('existing-access')
      expect(localStorage.getItem('refreshToken')).toBe('existing-refresh')
    }
  )
  it('keeps tokens and settles queued requests when refresh times out', async () => {
    const location = { href: '/dashboard' }
    vi.stubGlobal('window', { location })
    localStorage.setItem('accessToken', 'old-access')
    localStorage.setItem('refreshToken', 'valid-refresh')
    api.defaults.adapter = (config) => rejectStatus(config, 401)
    let rejectRefresh
    const refresh = vi.spyOn(axios, 'post').mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectRefresh = reject
        })
    )
    const first = api.get('/auth/me')
    const second = api.get('/youtube/channels')
    const settled = Promise.allSettled([first, second])
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    rejectRefresh(new AxiosError('timeout', 'ECONNABORTED'))
    expect((await settled).map((r) => r.status)).toEqual(['rejected', 'rejected'])
    expect(refresh.mock.calls[0][2].timeout).toBe(60000)
    expect(location.href).toBe('/dashboard')
    expect(localStorage.getItem('refreshToken')).toBe('valid-refresh')
  })
  it('clears revoked credentials and returns to login after refresh is rejected', async () => {
    const location = { href: '/dashboard' }
    vi.stubGlobal('window', { location })
    localStorage.setItem('accessToken', 'old-access')
    localStorage.setItem('refreshToken', 'revoked-refresh')
    api.defaults.adapter = (config) => rejectStatus(config, 401)
    vi.spyOn(axios, 'post').mockRejectedValueOnce({ response: { status: 401 } })
    await expect(api.get('/auth/me')).rejects.toMatchObject({ response: { status: 401 } })
    expect(location.href).toBe('/login')
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })
})
