/**
 * ComicVine Image Extractor
 *
 * Extracts images from ComicVine metadata including:
 * - Main cover image
 * - Issue covers
 *
 * Extracted from: src/services/imageExtractor.ts (lines 178-208)
 * Created: 2025-11-20
 */

import type { ComicVineMetadata, ComicVineIssue, ImageOption } from '../types';

/**
 * Extract images from ComicVine metadata
 *
 * Processes ComicVine metadata to extract:
 * - Main cover image (from comicvineData.image)
 * - Individual issue covers (from issues array)
 *
 * @param comicvineData - ComicVine metadata object
 * @param addImage - Callback to add each extracted image
 *
 * @example
 * ```typescript
 * const images: ImageOption[] = [];
 * extractComicVineImages(comicvineData, (img) => images.push(img));
 * ```
 */
export function extractComicVineImages(
  comicvineData: ComicVineMetadata,
  addImage: (image: ImageOption) => void
): void {
  // Main ComicVine cover
  if (comicvineData.image?.original_url) {
    addImage({
      url: comicvineData.image.original_url,
      label: 'ComicVine Main Cover',
      type: 'cover',
      category: 'provider',
      provider: 'ComicVine',
      size: 'extraLarge'
    });
  }

  // Issue covers
  const issues = comicvineData.metadata?.issues ?? comicvineData.issues;
  if (Array.isArray(issues)) {
    issues.forEach((issue: ComicVineIssue, index: number) => {
      if (issue.image?.original_url) {
        const issueNum = issue.issue_number ?? issue.issueNumber ?? index + 1;
        const issueName = issue.name ?? issue.title;
        addImage({
          url: issue.image.original_url,
          label: `ComicVine Issue #${issueNum}${issueName ? ` - ${issueName}` : ''}`,
          type: 'cover',
          category: 'provider',
          provider: 'ComicVine'
        });
      }
    });
  }
}
