import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { sanitizeMonitoringEvent } = require('../../src/utils/monitoring-privacy');
const { fetchThumbnail } = require('../../src/utils/thumbnail-fetch');
afterEach(() => vi.unstubAllGlobals());
describe('diagnostic and image-fetch privacy', () => {
  it('removes request credentials, bodies, identities and token URL queries', () => {
    const event = sanitizeMonitoringEvent({
      request: {
        url: 'https://vezrin.com/reset-password?token=secret',
        headers: { Authorization: 'Bearer secret' },
        data: { password: 'secret' },
      },
      user: { email: 'test@example.com' },
      extra: { token: 'secret' },
      breadcrumbs: [
        { data: { url: 'https://api.example.com/reset?token=secret', body: 'secret' } },
      ],
    });
    expect(JSON.stringify(event)).not.toContain('secret');
    expect(event.request.url).toBe('https://vezrin.com/reset-password');
  });
  it.each([
    'http://127.0.0.1/private',
    'https://metadata.google.internal/',
    'https://i.ytimg.com.evil.test/image.jpg',
  ])('rejects unsafe URL %s without any network request', async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchThumbnail(url)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('disallows redirects and enforces the image size while streaming', async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'content-type': 'image/jpeg' }),
        body: {
          getReader: () => ({
            read: async () => ({ done: false, value: new Uint8Array(4 * 1024 * 1024 + 1) }),
            cancel,
          }),
        },
      }))
    );
    await expect(fetchThumbnail('https://i.ytimg.com/vi/test/default.jpg')).rejects.toThrow('4 MB');
    expect(fetch.mock.calls[0][1].redirect).toBe('error');
    expect(cancel).toHaveBeenCalled();
  });
});
