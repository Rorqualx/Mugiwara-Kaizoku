/**
 * Image Proxy API
 *
 * GET /api/image-proxy/[...path] - Proxy and cache external images
 *
 * Features:
 * - Caches images in database for performance
 * - Validates image sources for security
 * - Returns placeholder on error
 * - Binary response handling
 *
 * NOTE: Requires ImageCache Prisma model in schema.prisma
 */
import axios from 'axios';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { createBinaryRoute } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';


// Validation schema for query parameters
const querySchema = z.object({
  path: z.union([z.string(), z.array(z.string())]),
  url: z.string().url().optional()
});

/**
 * SECURITY: SSRF Protection (OWASP A10:2021 - SSRF)
 * Validates URLs to prevent Server-Side Request Forgery attacks
 *
 * Blocks:
 * - Private IP ranges (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
 * - Localhost (127.0.0.1, localhost)
 * - Link-local addresses (169.254.x.x)
 * - Non-whitelisted domains
 */
function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Block localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { safe: false, reason: 'Localhost access blocked' };
    }

    // Block private IP ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const [, o1, o2] = ipMatch;
      const octet1 = parseInt(o1 ?? '0', 10);
      const octet2 = parseInt(o2 ?? '0', 10);

      // 10.0.0.0/8
      if (octet1 === 10) {
        return { safe: false, reason: 'Private IP range 10.x.x.x blocked' };
      }
      // 172.16.0.0/12
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
        return { safe: false, reason: 'Private IP range 172.16-31.x.x blocked' };
      }
      // 192.168.0.0/16
      if (octet1 === 192 && octet2 === 168) {
        return { safe: false, reason: 'Private IP range 192.168.x.x blocked' };
      }
      // 169.254.0.0/16 (link-local)
      if (octet1 === 169 && octet2 === 254) {
        return { safe: false, reason: 'Link-local address blocked' };
      }
    }

    // Whitelist allowed domains
    const allowedDomains = [
      'static.wikia.nocookie.net',
      'fandom.com',
      'anilist.co',
      's4.anilist.co',
      'comicvine.gamespot.com',
      'upload.wikimedia.org',
      'uploads.mangadex.org',
      'mangadex.org',
    ];

    const isAllowed = allowedDomains.some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return { safe: false, reason: `Domain ${hostname} not whitelisted` };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}
// Placeholder SVG for failed images
const placeholderSvg = `
  <svg width="300" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="300" height="400" fill="#2a2a2a"/>
    <text x="150" y="200" font-family="Arial" font-size="14" fill="#666" text-anchor="middle">
      Image unavailable
    </text>
  </svg>
`;
/** Fetch an image with retry on timeout/network errors */
async function fetchImageWithRetry(
  url: string,
  maxRetries = 2,
): Promise<import('axios').AxiosResponse<ArrayBuffer>> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': new URL(url).origin,
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
  };
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Sequential retry
      return await axios.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        headers,
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024,
      });
    } catch (err) {
      const isRetryable = err instanceof Error && (
        err.message.includes('timeout') || err.message.includes('ECONNRESET') || err.message.includes('socket')
      );
      if (!isRetryable || attempt === maxRetries) throw err;
      // eslint-disable-next-line no-await-in-loop -- Backoff delay between retries
      await new Promise<void>(r => { setTimeout(r, 1000 * (attempt + 1)); });
    }
  }
  throw new Error('Unreachable');
}

export default createBinaryRoute({
  requireAuth: false, // Public endpoint for image serving
  cache: {
    maxAge: 31536000, // Cache for 1 year
    sMaxAge: 31536000, // CDN cache for 1 year
    private: false
  },
  validation: {
    query: querySchema
  },
  handlers: {
    GET: async (req, res): Promise<void> => {
      const { path, url: originalUrl } = req.query as z.infer<typeof querySchema>;
      const proxyPath = Array.isArray(path) ? path.join('/') : path;
      if (!proxyPath) {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res["status"](404).send(placeholderSvg);
      }
      try {
        // First, check if we have this image cached
        const cached = await prisma.imageCache.findUnique({
          where: { proxyPath }
        });
        if (cached) {
          // Update last accessed time asynchronously (don't wait)
          prisma.imageCache.update({
            where: { id: cached.id },
            data: { lastAccessed: new Date() }
          }).catch((err: unknown) => logger.error('Failed to update last accessed:', err));
          // Return cached image
          res.setHeader('Content-Type', cached.contentType);
          res.setHeader('X-Image-Source', 'cache');
          // Convert Prisma Bytes type to Buffer
          const imageBuffer = Buffer.from(cached.imageData);
          return res["status"](200).send(imageBuffer);
        }
        // If no URL provided, return placeholder
        if (!originalUrl) {
          res.setHeader('Content-Type', 'image/svg+xml');
          res.setHeader('X-Image-Source', 'placeholder');
          return res["status"](404).send(placeholderSvg);
        }

        // SECURITY: Validate URL for SSRF protection (OWASP A10:2021)
        const urlValidation = isUrlSafe(originalUrl);
        if (!urlValidation.safe) {
          logger.warn('Blocked image proxy request - SSRF protection', {
            url: originalUrl,
            reason: urlValidation.reason,
            ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
          });
          res.setHeader('Content-Type', 'image/svg+xml');
          return res["status"](403).send(placeholderSvg);
        }
        logger.info(`Fetching image: ${originalUrl}`);
        // Fetch the image from the source with retry on timeout/network errors
        const response = await fetchImageWithRetry(originalUrl);
        const imageBuffer = Buffer.from(response.data);
        const contentType = (response.headers['content-type'] as string | undefined) ?? 'image/png';
        // Validate content type
        if (!contentType.startsWith('image/')) {
          logger.error(`Invalid content type: ${contentType}`);
          res.setHeader('Content-Type', 'image/svg+xml');
          return res["status"](400).send(placeholderSvg);
        }
        // Store in cache asynchronously
        prisma.imageCache.create({
          data: {
            originalUrl,
            proxyPath,
            imageData: imageBuffer,
            contentType,
            size: imageBuffer.length,
            source: new URL(originalUrl).hostname,
            metadata: {
              fetchedAt: new Date().toISOString(),
              headers: Object.fromEntries(
                Object.entries(response.headers).map(([key, value]) => [
                  key,
                  typeof value === 'string' ? value : String(value)
                ])
              )
            }
          }
        }).then(() => {
          logger.info(`Cached image: ${proxyPath}`);
        }).catch((err: unknown) => {
          // Log but don't fail the request
          logger.error('Failed to cache image:', err);
        });
        // Return the image
        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Image-Source', 'fetched');
        return res["status"](200).send(imageBuffer);
      }
      catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Image proxy error:', errorMessage);
        // Return placeholder on any error
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('X-Image-Source', 'error-placeholder');
        return res["status"](200).send(placeholderSvg);
      }
    }
  },
  onError: (error, req, res) => {
    logger.error('Image proxy fatal error:', error);
    res.setHeader('Content-Type', 'image/svg+xml');
    res["status"](500).send(placeholderSvg);
  }
});
// Increase payload size limit for images
export const config = {
  api: {
    responseLimit: '10mb'
  }
};