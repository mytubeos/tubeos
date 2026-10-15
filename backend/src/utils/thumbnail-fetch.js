const ALLOWED_HOSTS = new Set([
  'i.ytimg.com',
  'img.youtube.com',
  'yt3.ggpht.com',
  'yt3.googleusercontent.com',
  'res.cloudinary.com',
]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const fetchThumbnail = async (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid thumbnail URL');
  }
  if (
    url.protocol !== 'https:' ||
    !ALLOWED_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  )
    throw new Error('Use a YouTube or Cloudinary HTTPS thumbnail URL');
  const response = await fetch(url.href, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Thumbnail could not be downloaded');
  const mimeType = (response.headers.get('content-type') || '').split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType))
    throw new Error('Thumbnail must be a JPEG, PNG or WebP image');
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) {
    await response.body?.cancel();
    throw new Error('Thumbnail exceeds 4 MB');
  }
  const chunks = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      total += chunk.byteLength;
      if (total > MAX_IMAGE_BYTES) throw new Error('Thumbnail exceeds 4 MB');
      chunks.push(Buffer.from(chunk));
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  return { base64: Buffer.concat(chunks).toString('base64'), mimeType };
};
module.exports = { fetchThumbnail };
