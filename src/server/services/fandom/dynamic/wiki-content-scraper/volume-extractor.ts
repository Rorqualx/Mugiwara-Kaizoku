/**
 * Volume Extractor Module
 *
 * Extracts volume information from wiki page links.
 * Reduces extractVolumeFromLink from 6 params to 2 params using context object.
 *
 * Extracted from: WikiContentScraper.ts (lines 332-358)
 *
 * Fixes:
 * - max-params violation (6 params → 2 params)
 * - Explicit return type annotation
 */

import type { VolumeExtractionContext, VolumeInfo } from './types';

/**
 * Extract volume information from a link
 *
 * Parses link text for volume patterns (e.g., "Volume 1") and creates
 * or updates volume entries in the provided volumes array.
 *
 * @param context - Extraction context containing cheerio instances and link data
 * @param volumes - Array of volumes to populate or update
 */
export function extractVolumeFromLink(
  context: VolumeExtractionContext,
  volumes: VolumeInfo[]
): void {
  const { text, href, pageUrl } = context;

  const volumeMatch = text.match(/Volume\s*(\d+)/i);
  if (volumeMatch?.[1]) {
    const volumeNum = parseInt(volumeMatch[1], 10);
    let volume = volumes.find(v => v.number === volumeNum);

    if (!volume) {
      volume = {
        number: volumeNum,
        title: text,
        chapters: []
      };

      const volumeUrl = resolveUrl(href, pageUrl);
      if (volumeUrl !== undefined) volume.url = volumeUrl;

      volumes.push(volume);
    }
  }
}

/**
 * Resolve relative or absolute URLs
 * (Internal helper - duplicated from WikiContentScraper for now)
 */
function resolveUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;

  try {
    const base = new URL(baseUrl);

    if (url.startsWith('http')) {
      return url;
    } else if (url.startsWith('//')) {
      return base.protocol + url;
    } else if (url.startsWith('/')) {
      return base.origin + url;
    } else {
      // Relative path
      const pathParts = base.pathname.split('/');
      pathParts.pop(); // Remove filename
      return base.origin + pathParts.join('/') + '/' + url;
    }
  } catch {
    return url;
  }
}
