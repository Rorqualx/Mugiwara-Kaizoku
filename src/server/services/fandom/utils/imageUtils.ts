/**
 * Utilities for handling Fandom wiki images
 */

import type { Cheerio } from 'cheerio';
import type { AnyNode } from 'domhandler';

/**
 * Clean and normalize a Wikia/Fandom image URL
 * Removes revision parameters and scale-to-width to get the highest quality version
 * Based on the archived implementation with improvements
 * 
 * @param url - The image URL from Fandom
 * @returns The cleaned, full-size image URL
 */
export function cleanWikiaImageUrl(url: string | undefined): string {
  if (!url || url === 'none' || url.includes('data:image/gif')) return '';
  
  let cleanUrl = url;
  
  // Handle data URIs (base64 encoded images) - skip these
  if (cleanUrl.startsWith('data:')) {
    return '';
  }
  
  // Fandom CDN requires /revision/latest AND path-prefix query param
  // Strip only scale-to-width sub-paths to get full-size originals, but keep /revision/latest
  cleanUrl = cleanUrl.replace(/(\/revision\/latest)\/scale-to-width(?:-down)?\/\d+/, '$1');
  cleanUrl = cleanUrl.replace(/(\/revision\/latest)\/smart\/width\/\d+\/height\/\d+/, '$1');

  // Remove thumbnail markers
  cleanUrl = cleanUrl.replace(/\/thumb\//, '/');

  // Remove size suffixes like /200px-Image.png
  cleanUrl = cleanUrl.replace(/\/\d+px-[^/]+$/, '');

  // Strip only non-essential query params (keep path-prefix and cb which Fandom CDN requires)
  if (cleanUrl.includes('?')) {
    try {
      const urlObj = new URL(cleanUrl);
      const pathPrefix = urlObj.searchParams.get('path-prefix');
      const cb = urlObj.searchParams.get('cb');
      // Rebuild with only essential params
      urlObj.search = '';
      if (pathPrefix) urlObj.searchParams.set('path-prefix', pathPrefix);
      if (cb) urlObj.searchParams.set('cb', cb);
      cleanUrl = urlObj.toString();
    } catch {
      // Fallback: keep original URL if parsing fails
    }
  }
  
  // Ensure HTTPS protocol
  if (cleanUrl.startsWith('//')) {
    cleanUrl = 'https:' + cleanUrl;
  } else if (!cleanUrl.startsWith('http')) {
    cleanUrl = 'https://' + cleanUrl;
  }
  
  // Fix double slashes in path (but not in protocol)
  cleanUrl = cleanUrl.replace(/([^:])\/\/+/g, '$1/');
  
  return cleanUrl;
}

/**
 * Convert a Fandom thumbnail URL to the full-size image URL
 * 
 * Fandom serves thumbnails with various size restrictions that need to be removed
 * to get the original full-size image.
 * 
 * @param thumbnailUrl - The thumbnail URL from Fandom
 * @returns The full-size image URL
 */
export function getFullSizeImageUrl(thumbnailUrl: string | undefined): string | undefined {
  if (!thumbnailUrl) return undefined;
  
  // Use the more comprehensive cleaning function
  const cleaned = cleanWikiaImageUrl(thumbnailUrl);
  return cleaned;
}

/**
 * Extract the best available image URL from various attributes
 * Enhanced with more attribute checks from archived implementation
 *
 * @param element - Cheerio element containing the image
 * @returns The best available image URL, preferring full-size versions
 */
export function extractBestImageUrl($img: Cheerio<AnyNode>): string | undefined {
  if (!$img.length) return undefined;

  // Check for lazy-loaded images with data URIs
  const src = $img.attr('src');

  // For lazy-loaded Fandom gallery images, check noscript tag first
  if (src?.startsWith('data:')) {
    // Check if there's a noscript sibling with the actual image
    const parent = $img.parent();
    const noscript = parent.find('noscript').first();
    if (noscript.length) {
      // Parse the noscript content to get the actual image
      const noscriptHtml = noscript.html();
      if (noscriptHtml) {
        // Extract src from the noscript img tag
        const srcMatch = noscriptHtml.match(/src="([^"]+)"/);
        if (srcMatch?.[1]) {
          return getFullSizeImageUrl(srcMatch[1]);
        }
      }
    }

    // Try data-src which often has the actual URL
    const dataSrc = $img.attr('data-src');
    if (dataSrc && !dataSrc.startsWith('data:')) {
      return getFullSizeImageUrl(dataSrc);
    }
  }

  // Try different attributes in order of preference (enhanced list)
  const possibleUrls = [
    $img.attr('data-src'),         // Often has the full image
    $img.attr('data-image-url'),   // Alternative data attribute
    $img.attr('data-original'),    // Original image reference
    src,                           // Regular source (if not data URI)
    $img.attr('data-image-key'),   // Fandom's image key
    $img.attr('data-image-name'),  // Alternative image reference
    $img.parent('a').attr('href')  // Sometimes the full image is in parent link
  ];

  for (const url of possibleUrls) {
    if (url && !url.startsWith('data:')) {
      // Handle data-image-key and data-image-name specially
      if (url === $img.attr('data-image-key') || url === $img.attr('data-image-name')) {
        // These need to be converted to full URLs
        if (!url.startsWith('http')) {
          const fullUrl = `https://static.wikia.nocookie.net/${url}`;
          return getFullSizeImageUrl(fullUrl);
        }
      }
      return getFullSizeImageUrl(url);
    }
  }
  
  return undefined;
}

/**
 * Check if a URL is a valid image URL
 */
export function isValidImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  
  // Check for common image extensions
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

  // Remove query parameters for extension check
  const urlPart = url.split('?')[0];
  const urlWithoutParams = urlPart ?? url;

  return imageExtensions.test(urlWithoutParams) || 
         url.includes('static.wikia.nocookie.net') ||
         url.includes('vignette.wikia.nocookie.net');
}