/**
 * Image Proxy API
 *
 * Proxies images from external sources (Fandom, Wikipedia) to avoid
 * hotlink protection and CORS issues in the annotation editor.
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const ALLOWED_DOMAINS = [
  'static.wikia.nocookie.net',
  'vignette.wikia.nocookie.net',
  'images.wikia.com',
  'fandom.com',
  'upload.wikimedia.org',
  'wikipedia.org',
  'comicvine.gamespot.com',
];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.some((domain) => parsed.hostname.includes(domain));
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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MangaMetadataBot/1.0)',
        'Accept': 'image/*',
        'Referer': new URL(url).origin,
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ error: `Upstream error: ${response.status}` });
      return;
    }

    const contentType = response.headers.get('content-type') ?? 'image/png';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch image',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}
