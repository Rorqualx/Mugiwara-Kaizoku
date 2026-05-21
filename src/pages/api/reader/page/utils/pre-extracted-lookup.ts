/**
 * Pre-extracted Page Lookup for Page Reader API
 *
 * Checks for and serves pre-extracted (cached) manga pages.
 * Uses parallel file checks to avoid await-in-loop violations.
 */

import fs from 'fs/promises';
import path from 'path';

import type { NextApiResponse } from 'next';

/**
 * Result of finding a pre-extracted page
 */
export interface PreExtractedPageResult {
  found: true;
  buffer: Buffer;
  contentType: string;
  format: string;
}

/**
 * Supported image formats for pre-extracted pages
 */
const PAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const;

/**
 * Map file extension to content type
 */
function getContentType(format: string): string {
  switch (format) {
    case '.webp':
      return 'image/webp';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}

/**
 * Check if a single page file exists
 */
async function checkPageExists(
  extractedDir: string,
  pageNumber: number,
  format: string
): Promise<{ exists: true; path: string; format: string } | { exists: false }> {
  const pagePath = path.join(extractedDir, `${pageNumber}${format}`);
  try {
    const stats = await fs.stat(pagePath);
    if (stats.isFile()) {
      return { exists: true, path: pagePath, format };
    }
  } catch {
    // File doesn't exist
  }
  return { exists: false };
}

/**
 * Finds a pre-extracted page using parallel file checks
 * This avoids the no-await-in-loop ESLint violation
 *
 * @returns PreExtractedPageResult if found, null if not cached
 */
export async function findPreExtractedPage(
  mangaId: number,
  chapterId: number,
  pageNumber: number
): Promise<PreExtractedPageResult | null> {
  const baseDir = process.env['MANGA_FILES_DIR'] ?? process.cwd() + '/data/cache';
  const extractedDir = path.join(baseDir, 'extracted', `manga-${mangaId}`, `chapter-${chapterId}`);

  // Check all formats in parallel (fixes await-in-loop)
  const checkResults = await Promise.all(
    PAGE_FORMATS.map(format => checkPageExists(extractedDir, pageNumber, format))
  );

  // Find first existing file (type narrowing: if found, exists is always true)
  const foundResult = checkResults.find(
    (result): result is { exists: true; path: string; format: string } => result.exists
  );
  if (!foundResult) {
    return null;
  }

  // Read the found file
  const pageBuffer = await fs.readFile(foundResult.path);
  const contentType = getContentType(foundResult.format);

  return {
    found: true,
    buffer: pageBuffer,
    contentType,
    format: foundResult.format
  };
}

/**
 * Serves a pre-extracted page with appropriate headers
 */
export function servePreExtractedPage(
  res: NextApiResponse,
  page: PreExtractedPageResult,
  pageNumber: number,
  totalPages: number
): void {
  res.setHeader('Content-Type', page.contentType);
  res.setHeader('Content-Length', page.buffer.length.toString());
  res.setHeader('X-Page-Number', pageNumber.toString());
  res.setHeader('X-Total-Pages', totalPages.toString());
  res.setHeader('X-Cache-Status', 'HIT');
  res.send(page.buffer);
}
