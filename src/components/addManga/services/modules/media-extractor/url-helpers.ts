import { logger } from '@/utils/logger';

/**
 * Clean Fandom/Wikia image URLs to remove smart cropping parameters
 * This ensures full-resolution images without cropping
 *
 * Fandom URL formats:
 * - /smart/width/X/height/Y - Smart crop to exact dimensions (causes cropping!)
 * - /scale-to-width-down/X - Scale proportionally to width (preserves aspect ratio)
 * - /revision/latest - Get latest revision
 */
export function cleanFandomImageUrl(url: string): string {
  if (!url) return url;

  // Don't process URLs that are already proxy URLs - they need their ?url= param
  if (url.includes('/api/image-proxy/')) {
    // For proxy URLs, we need to clean the embedded URL in the ?url= parameter
    const urlParamMatch = url.match(/[?&]url=([^&]+)/);
    if (urlParamMatch?.[1]) {
      const encodedOriginalUrl = urlParamMatch[1];
      const originalUrl = decodeURIComponent(encodedOriginalUrl);
      const cleanedOriginalUrl = cleanRawFandomUrl(originalUrl);

      // Reconstruct proxy URL with cleaned original URL
      const proxyPathEnd = url.indexOf('?');
      const proxyPath = proxyPathEnd > 0 ? url.substring(0, proxyPathEnd) : url;
      // Remove all cropping from proxy path as well
      let cleanedProxyPath = proxyPath;
      cleanedProxyPath = cleanedProxyPath.replace(/\/smart\/width\/\d+\/height\/\d+/, '');
      cleanedProxyPath = cleanedProxyPath.replace(/\/thumbnail\/width\/\d+\/height\/\d+/, '');
      cleanedProxyPath = cleanedProxyPath.replace(/\/window-crop\/[^/]+\/[^/]+\/[^/]+\/[^/]+/, '');
      cleanedProxyPath = cleanedProxyPath.replace(/\/top-crop\/width\/\d+\/height\/\d+/, '');
      cleanedProxyPath = cleanedProxyPath.replace(/([^:])\/\/+/g, '$1/');
      return `${cleanedProxyPath}?url=${encodeURIComponent(cleanedOriginalUrl)}`;
    }
    return url;
  }

  // Process raw Fandom URLs
  return cleanRawFandomUrl(url);
}

/**
 * Clean a raw (non-proxied) Fandom URL
 * Removes all cropping/resizing parameters to get full-resolution image
 */
export function cleanRawFandomUrl(url: string): string {
  // Only process Fandom/Wikia URLs
  if (!url.includes('static.wikia.nocookie.net') &&
      !url.includes('vignette.wikia.nocookie.net') &&
      !url.includes('fandom.com')) {
    return url;
  }

  let cleanUrl = url;

  // Remove ALL cropping and resizing patterns to get full-resolution image
  // These patterns cause square/cropped images:

  // Pattern 1: /smart/width/X/height/Y - Smart crop (causes square cropping!)
  cleanUrl = cleanUrl.replace(/\/smart\/width\/\d+\/height\/\d+/, '');

  // Pattern 2: /thumbnail/width/X/height/Y - Thumbnail crop
  cleanUrl = cleanUrl.replace(/\/thumbnail\/width\/\d+\/height\/\d+/, '');

  // Pattern 3: /window-crop/width/X/... - Window crop
  cleanUrl = cleanUrl.replace(/\/window-crop\/[^/]+\/[^/]+\/[^/]+\/[^/]+/, '');

  // Pattern 4: /top-crop/width/X/height/Y - Top crop
  cleanUrl = cleanUrl.replace(/\/top-crop\/width\/\d+\/height\/\d+/, '');

  // Pattern 5: /scale-to-width-down/X - Keep this but increase size for better quality
  cleanUrl = cleanUrl.replace(/\/scale-to-width-down\/\d+/, '/scale-to-width-down/600');

  // Pattern 6: /scale-to-width/X (without -down)
  cleanUrl = cleanUrl.replace(/\/scale-to-width\/\d+/, '/scale-to-width-down/600');

  // Pattern 7: /scale-to-height-down/X
  cleanUrl = cleanUrl.replace(/\/scale-to-height-down\/\d+/, '');

  // Pattern 8: /format/... image format conversions
  cleanUrl = cleanUrl.replace(/\/format\/[^/]+/, '');

  // Ensure we have /revision/latest for the freshest version
  if (cleanUrl.includes('/revision/') && !cleanUrl.includes('/revision/latest')) {
    cleanUrl = cleanUrl.replace(/\/revision\/[^/]+/, '/revision/latest');
  }

  // Remove ?cb= cache-buster but keep essential query params
  cleanUrl = cleanUrl.replace(/[?&]cb=\d+/, '');

  // Clean up any double slashes that might result from pattern removal (except http://)
  cleanUrl = cleanUrl.replace(/([^:])\/\/+/g, '$1/');

  return cleanUrl;
}

/**
 * Extract filename from Fandom/Wikia URLs using multiple pattern strategies
 *
 * Tries patterns in order of specificity:
 * 1. Old format: /images/X/XX/filename
 * 2. UUID format: /UUID/revision/latest
 * 3. Revision path: /something/revision/
 * 4. Full path fallback: everything after domain
 *
 * @param decoded - Decoded URL to extract filename from
 * @returns Extracted filename or null if no pattern matches
 */
export function extractFandomFilename(decoded: string): string | null {
  // Try old format first: /images/X/XX/filename
  const oldMatch = decoded.match(/\/images\/[a-f0-9]\/[a-f0-9]{2}\/([^/]+)/);
  if (oldMatch?.[1]) {
    logger.debug('[extractFandomFilename] OLD FORMAT matched', { filename: oldMatch[1] });
    return oldMatch[1];
  }

  // Try new UUID format: /UUID/revision/latest
  const uuidMatch = decoded.match(/\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//i);
  if (uuidMatch?.[1]) {
    logger.debug('[extractFandomFilename] UUID FORMAT matched', { filename: uuidMatch[1] });
    return uuidMatch[1];
  }

  // Fallback: Extract path segment before /revision/
  const revisionMatch = decoded.match(/\/([^/]+)\/revision\//);
  if (revisionMatch?.[1] && revisionMatch[1] !== 'images') {
    logger.debug('[extractFandomFilename] REVISION-PATH matched', { filename: revisionMatch[1] });
    return revisionMatch[1];
  }

  // Last fallback: use full path after domain as identifier
  const domainMatch = decoded.match(/static\.wikia\.nocookie\.net\/(.+)/);
  if (domainMatch?.[1]) {
    const filename = domainMatch[1]
      .replace(/\/revision\/.*$/, '')
      .replace(/\/scale-to-width.*$/, '')
      .replace(/\//g, '_');
    logger.debug('[extractFandomFilename] FULL-PATH fallback', { filename });
    return filename;
  }

  return null;
}

/**
 * Normalize an image URL for comparison (removes encoding issues and extracts core filename)
 *
 * @param url - Image URL to normalize
 * @returns Normalized filename string
 */
// eslint-disable-next-line max-statements, complexity -- Complex URL normalization with multiple processing steps
export function normalizeImageUrl(url: string): string {
  try {
    // Decode URL multiple times to handle double/triple encoding
    let decoded = url;
    let prevDecoded = '';
    let attempts = 0;
    while (decoded !== prevDecoded && attempts < 5) {
      prevDecoded = decoded;
      decoded = decodeURIComponent(decoded);
      attempts++;
    }

    // Extract the filename first
    let filename = '';

    // Special handling for Fandom duplicate URLs
    // Multiple formats supported:
    // 1. Old: static.wikia.nocookie.net/xxx/images/a/ab/filename.ext/revision/latest
    // 2. New UUID: static.wikia.nocookie.net/UUID/revision/latest
    // 3. Scale-to-width: static.wikia.nocookie.net/.../scale-to-width-down/400
    if (decoded.includes('static.wikia.nocookie.net')) {
      const extracted = extractFandomFilename(decoded);
      if (extracted) {
        filename = extracted;
      }
    } else if (decoded.includes('/wiki/Special:FilePath/')) {
      // For wiki/Special:FilePath URLs
      const parts = decoded.split('/wiki/Special:FilePath/');
      const tempFilename = parts.length > 1 ? parts[parts.length - 1] ?? '' : '';
      const questionParts = tempFilename.split('?');
      filename = questionParts[0] ?? '';
    } else {
      // Extract filename from path
      const pathParts = decoded.split('/');
      filename = pathParts[pathParts.length - 1] ?? '';
      const questionParts = filename.split('?');
      const hashParts = questionParts[0]?.split('#') ?? [];
      filename = hashParts[0] ?? '';
    }

    // Remove common suffixes and normalize
    filename = filename
      .replace(/\/revision\/.*$/, '')
      .replace(/_\d+x\d+/, '') // Remove size suffixes like _100x100
      .toLowerCase();

    // Special handling for magazine issue patterns
    // This handles semantic duplicates like "2020.jpg" vs "Issue_31,_2020.jpg"

    // Pattern 1: Issue_XX,_YYYY.ext or Issue_XX%2C_YYYY.ext
    const issuePattern = /issue[_\s]*(\d+)[,%_\s]+(\d{4})\.(jpg|png)/i;
    const issueMatch = filename.match(issuePattern);
    if (issueMatch) {
      const [, issueNum, year] = issueMatch;
      return `issue_${issueNum}_${year}`;
    }

    // Pattern 2: Just year like "2020.jpg" - check if it's issue 31 (Fire Force specific)
    const yearOnlyPattern = /^(\d{4})\.(jpg|png)$/i;
    const yearMatch = filename.match(yearOnlyPattern);
    if (yearMatch) {
      const year = yearMatch[1] ?? '';
      // Known Fire Force magazine issues that use just year as filename
      if (year === '2020') {
        return 'issue_31_2020'; // Issue 31, 2020 is sometimes just "2020.jpg"
      }
      // Default: keep as is but normalized
      return `year_${year}`;
    }

    // Pattern 3: WSM_Issue_XX or WSM_Issue_No.XX
    const wsmPattern = /wsm[_\s]*issue[_\s]*(no\.?)?[_\s]*(\d+)/i;
    const wsmMatch = filename.match(wsmPattern);
    if (wsmMatch) {
      const issueNum = wsmMatch[2] ?? '';
      return `wsm_issue_${issueNum}`;
    }

    // Pattern 4: Fire_Brigade_of_Flames_Cover_(Issue_XX)
    const fbofPattern = /fire[_\s]*brigade[_\s]*of[_\s]*flames[_\s]*cover[_\s]*\(issue[_\s]*(\d+)\)/i;
    const fbofMatch = filename.match(fbofPattern);
    if (fbofMatch) {
      const issueNum = fbofMatch[1] ?? '';
      return `fbof_issue_${issueNum}`;
    }

    // Pattern 5: FBOF_on_WSM_cover
    if (filename.includes('fbof') && filename.includes('wsm') && filename.includes('cover')) {
      return 'fbof_wsm_cover';
    }

    return filename;
  } catch (_e) {
    // If decoding fails, just return cleaned original
    const questionParts = url.toLowerCase().split('?');
    const hashParts = questionParts[0]?.split('#') ?? [];
    return (hashParts[0] ?? '').replace(/\/revision\/.*$/, '');
  }
}

/**
 * Create a simple hash from a string for duplicate detection
 *
 * @param str - String to hash
 * @returns Hash string in base36
 */
export function createImageHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Fix double-encoded URLs
 *
 * @param url - URL that might be double-encoded
 * @returns Fixed URL
 */
export function fixDoubleEncodedUrl(url: string): string {
  try {
    // Check if URL contains double-encoded patterns like %252C or %2528
    if (url.includes('%25')) {
      // Decode once to fix double encoding
      return decodeURIComponent(url);
    }
    return url;
  } catch {
    return url;
  }
}
