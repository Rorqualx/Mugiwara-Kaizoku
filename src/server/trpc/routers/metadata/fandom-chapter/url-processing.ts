/**
 * URL processing utilities for Fandom chapter images
 */

import { logger } from '@/utils/logger';

/**
 * Extract chapter number from Fandom URL
 */
export function extractChapterNumberFromUrl(url: string): string | null {
  const urlMatch = url.match(/Chapter[_\s](\d+)/i);
  return urlMatch?.[1] ?? null;
}

/**
 * Normalize Fandom image URL to ensure proper protocol and scale
 */
export function normalizeFandomImageUrl(url: string): string {
  let normalized = url;

  // Ensure https protocol
  if (!normalized.startsWith('http')) {
    normalized = 'https:' + normalized;
  }

  // For Fandom images, clean up the URL to a standard format
  if (normalized.includes('static.wikia.nocookie.net')) {
    // Keep scale-to-width-down but use a reasonable size
    if (normalized.includes('/revision/latest/scale-to-width-down/')) {
      // Replace with a larger size for better quality
      normalized = normalized.replace(
        /\/scale-to-width-down\/\d+/,
        '/scale-to-width-down/700'
      );
      logger.debug(`Adjusted scale parameter in URL: ${normalized}`);
    }
    // If it has /revision/latest without scale, add scale parameter
    else if (normalized.includes('/revision/latest')) {
      normalized = normalized.replace(
        '/revision/latest',
        '/revision/latest/scale-to-width-down/700'
      );
      logger.debug(`Added scale parameter to URL: ${normalized}`);
    }
    // If no revision parameter, add it with scale
    else if (!normalized.includes('/revision/')) {
      // Insert before the file extension
      const parts = normalized.split('.');
      const ext = parts.pop();
      normalized =
        parts.join('.') + '/revision/latest/scale-to-width-down/700.' + ext;
      logger.debug(`Added revision and scale to URL: ${normalized}`);
    }
  }

  return normalized;
}

/**
 * Generate proxy URL for an image
 */
export async function generateProxyUrl(imageUrl: string): Promise<string> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('md5').update(imageUrl).digest('hex');
  const proxyPath = hash.substring(0, 16);
  // Use relative URL that will work in both dev and production
  const proxiedUrl = `/api/image-proxy/${proxyPath}?url=${encodeURIComponent(imageUrl)}`;
  logger.info(`Generated proxy URL: ${proxiedUrl} for original: ${imageUrl}`);
  return proxiedUrl;
}
