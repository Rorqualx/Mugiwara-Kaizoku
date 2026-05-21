/**
 * Image URL processing utilities for sourceManagementService
 *
 * This module provides functions for normalizing, hashing, and fixing image URLs
 * to detect duplicates and handle encoding issues.
 */

/**
 * Normalize an image URL for comparison (removes encoding issues and extracts core filename)
 *
 * @param url - The image URL to normalize
 * @returns Normalized URL string suitable for comparison
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
    // static.wikia.nocookie.net/xxx/images/a/b/c/filename.ext/revision/latest
    if (decoded.includes('static.wikia.nocookie.net')) {
      const match = decoded.match(/\/images\/[a-f0-9]\/[a-f0-9]{2}\/([^/]+)/);
      if (match?.[1]) {
        filename = match[1];
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
 * @param str - The string to hash
 * @returns Base-36 encoded hash string
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
 * @param url - The URL to fix
 * @returns URL with double-encoding removed
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
