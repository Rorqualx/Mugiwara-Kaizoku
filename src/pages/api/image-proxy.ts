
/**
 * Image Proxy API
 *
 * Proxies images from external sources (Fandom, Wikipedia) to avoid
 * hotlink protection and CORS issues in the annotation editor.
 */

import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { fetchPublicUrl, isHostInDomains, OutboundUrlError } from '@/server/utils/outbound-url-guard';

import type { NextApiRequest, NextApiResponse } from 'next';

const ALLOWED_DOMAINS = [
  'static.wikia.nocookie.net',
  'vignette.wikia.nocookie.net',
  'images.wikia.com',
  'fandom.com',
  'upload.wikimedia.org',
  'wikipedia.org',
  'comicvine.gamespot.com',
] as const;

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function isAllowedUrl(url: string): boolean {
  try {
    return isHostInDomains(new URL(url).hostname, ALLOWED_DOMAINS);
  } catch {
    return false;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Checked here as well as in the edge middleware: this route fetches on the
  // caller's behalf, so it must not depend on a single gate.
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  if (!isAllowedUrl(url)) {
    res.status(403).json({ error: 'Domain not allowed' });
    return;
  }

  try {
    const response = await fetchPublicUrl(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MangaMetadataBot/1.0)',
          'Accept': 'image/*',
          'Referer': new URL(url).origin,
        },
      },
      ALLOWED_DOMAINS
    );

    if (!response.ok) {
      res.status(response.status).json({ error: `Upstream error: ${response.status}` });
      return;
    }

    // Only ever relay images: passing an upstream text/html through would
    // serve third-party markup from this origin.
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (!contentType.startsWith('image/') || contentType === 'image/svg+xml') {
      res.status(415).json({ error: 'Upstream response is not an image' });
      return;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      res.status(413).json({ error: 'Image too large' });
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=86400'); // Cache for 1 day
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    if (error instanceof OutboundUrlError) {
      res.status(403).json({ error: error.message });
      return;
    }
    res.status(500).json({
      error: 'Failed to fetch image',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
