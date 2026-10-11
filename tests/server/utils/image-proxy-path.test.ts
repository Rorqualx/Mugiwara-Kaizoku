import { createHash } from 'crypto';

import { describe, expect, it } from '@jest/globals';

import { isProxyPathForUrl } from '@/server/utils/image-proxy-path';
import { proxyImageUrl } from '@/utils/image-proxy';

describe('isProxyPathForUrl', () => {
  const url = 'https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx147149-9DQ4upJAV2kQ.jpg';
  const other = 'https://s4.anilist.co/file/anilistcdn/media/manga/banner/198372-adfdCwjjq4h8.jpg';

  it('accepts the path the server derives for the URL', () => {
    const serverPath = createHash('md5').update(url).digest('hex').substring(0, 16);
    expect(isProxyPathForUrl(serverPath, url)).toBe(true);
  });

  it('accepts the path the browser derives for the URL', () => {
    // Value stored in production for this URL.
    expect(isProxyPathForUrl('88975e088eb33c88', url)).toBe(true);
  });

  it('accepts whatever proxyImageUrl builds', () => {
    const fandom = 'https://static.wikia.nocookie.net/onepiece/images/a/b/Cover.png';
    const proxied = proxyImageUrl(fandom);
    const match = /^\/api\/image-proxy\/([^?]+)\?url=(.+)$/.exec(proxied ?? '');
    expect(match).not.toBeNull();
    expect(isProxyPathForUrl(match?.[1] ?? '', decodeURIComponent(match?.[2] ?? ''))).toBe(true);
  });

  it('refuses a path that belongs to a different URL', () => {
    expect(isProxyPathForUrl('88975e088eb33c88', other)).toBe(false);
    expect(isProxyPathForUrl('covers/one-piece', url)).toBe(false);
  });
});
