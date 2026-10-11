import { createHash } from 'crypto';

import { clientProxyPathFor } from '@/utils/image-proxy';

/**
 * The cache path is derived from the image URL (server side: first 16 hex of
 * its MD5; browser side: `clientProxyPathFor`). A request whose path is not
 * one of those for its URL is refused, so nobody can store image A under the
 * path the app uses for image B.
 */
export function isProxyPathForUrl(proxyPath: string, url: string): boolean {
  const serverPath = createHash('md5').update(url).digest('hex').substring(0, 16);
  return proxyPath === serverPath || proxyPath === clientProxyPathFor(url);
}
