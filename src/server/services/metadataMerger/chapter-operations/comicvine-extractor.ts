/**
 * ComicVine Chapter Extractor
 *
 * Extracts chapter data from ComicVine provider metadata.
 * Handles both volumeData (wizard import) and issues (legacy) formats.
 */

import type { ParsedChapter } from '@/utils/comicvine-chapter-parser';
import { logger } from '@/utils/logger';

import { isRecord, getUnknownProperty } from '../utils';

import type { ChapterExtractionResult, ExtractedChapter } from './types';

/**
 * Extract chapters from ComicVine provider data
 *
 * @param providerData - ComicVine provider metadata
 * @returns Chapter extraction result with chapters array and shouldRecreate flag
 */
export async function extractComicVineChapters(
  providerData: unknown
): Promise<ChapterExtractionResult> {
  if (!isRecord(providerData)) {
    logger.info('ComicVine provider data is not a record');
    return { chapters: [], shouldRecreate: false };
  }

  // First, check for volumeData with pre-parsed chapters (from wizard import)
  const volumeData = getUnknownProperty(providerData, 'volumeData');

  if (Array.isArray(volumeData) && volumeData.length > 0) {
    return extractFromVolumeData(volumeData);
  }

  // Fall back to issues format (legacy import or API fetch)
  return extractFromIssues(providerData);
}

/**
 * Extract chapters from volumeData (wizard import format)
 */
function extractFromVolumeData(volumeData: unknown[]): ChapterExtractionResult {
  const chapterData: ExtractedChapter[] = [];

  logger.info(`Found ComicVine volumeData with ${volumeData.length} volumes (wizard import format)`);

  for (const volume of volumeData) {
    if (!isRecord(volume)) continue;

    const volumeChapters = getUnknownProperty(volume, 'chapters');
    const volumeNumber = Number(getUnknownProperty(volume, 'volumeNumber')) || 1;
    const volumeCover = getUnknownProperty(volume, 'coverImageUrl');

    if (!Array.isArray(volumeChapters)) continue;

    logger.info(`Volume ${volumeNumber} has ${volumeChapters.length} pre-parsed chapters`);

    for (const chapter of volumeChapters) {
      if (!isRecord(chapter)) continue;

      const chapterReleaseDate = getUnknownProperty(chapter, 'releaseDate');

      chapterData.push({
        title: String(getUnknownProperty(chapter, 'title') ?? getUnknownProperty(chapter, 'name') ?? ''),
        volumeNumber: volumeNumber,
        coverImage: (typeof getUnknownProperty(chapter, 'coverImageUrl') === 'string'
          ? getUnknownProperty(chapter, 'coverImageUrl')
          : volumeCover) as string | null,
        description: (typeof getUnknownProperty(chapter, 'description') === 'string'
          ? getUnknownProperty(chapter, 'description')
          : null) as string | null,
        releaseDate: chapterReleaseDate ? new Date(String(chapterReleaseDate)) : null,
        downloadUrl: (typeof getUnknownProperty(chapter, 'url') === 'string'
          ? getUnknownProperty(chapter, 'url')
          : null) as string | null
      });
    }
  }

  if (chapterData.length > 0) {
    logger.info(`Extracted ${chapterData.length} chapters from ComicVine volumeData`);
    return { chapters: chapterData, shouldRecreate: true };
  }

  return { chapters: [], shouldRecreate: false };
}

/**
 * Extract cover image from issue
 */
function extractCoverImage(issue: Record<string, unknown>): string | undefined {
  const imageObj = issue['image'];
  if (!isRecord(imageObj)) return undefined;
  return (getUnknownProperty(imageObj, 'medium_url') ?? getUnknownProperty(imageObj, 'small_url')) as string | undefined;
}

/**
 * Create chapter from parsed description
 */
function createParsedChapter(
  parsedChapter: ParsedChapter,
  issue: Record<string, unknown>,
  volumeNumber: number,
  issueNumber: number
): ExtractedChapter {
  return {
    title: parsedChapter.title,
    chapterNumber: parsedChapter.chapterNumber,
    volumeNumber,
    issueNumber,
    coverImage: extractCoverImage(issue),
    description: `From ${issue['name'] ?? issue['title'] ?? `Issue #${issueNumber}`}`,
    releaseDate: (issue['cover_date'] ?? issue['store_date']) as Date | string | null | undefined,
    downloadUrl: (issue['site_detail_url'] ?? issue['api_detail_url']) as string | null | undefined
  };
}

/**
 * Create fallback chapter when parsing fails
 */
function createFallbackChapter(
  issue: Record<string, unknown>,
  volumeNumber: number,
  issueNumber: number,
  chapterIndex: number
): ExtractedChapter {
  const issueName = issue['name'] ?? issue['title'] ?? `Issue #${issueNumber}`;
  return {
    title: `${issueName} - Chapter ${chapterIndex}`,
    volumeNumber,
    issueNumber,
    coverImage: extractCoverImage(issue),
    description: issue['deck'] as string | null | undefined,
    releaseDate: (issue['cover_date'] ?? issue['store_date']) as Date | string | null | undefined,
    downloadUrl: (issue['site_detail_url'] ?? issue['api_detail_url']) as string | null | undefined
  };
}

/**
 * Extract chapters from issues format (legacy)
 */
async function extractFromIssues(providerData: Record<string, unknown>): Promise<ChapterExtractionResult> {
  const chapterData: ExtractedChapter[] = [];
  const issues = findIssuesArray(providerData);

  if (!issues) {
    logger.info('No ComicVine issues found');
    return { chapters: [], shouldRecreate: false };
  }

  logger.info(`Found ComicVine issue data with ${issues.length} issues`);
  const { parseChaptersFromDescription } = await import('@/utils/comicvine-chapter-parser');

  for (let i = 0; i < issues.length; i++) {
    const issue = issues[i];
    if (!issue) continue; // Skip undefined entries (noUncheckedIndexedAccess)

    const issueNumber = (issue['issue_number'] ?? issue['issueNumber'] ?? i + 1) as number;
    const volumeNumber = i + 1;
    const descriptionValue = issue['description'];
    const parsedChapters = parseChaptersFromDescription(
      typeof descriptionValue === 'string' ? descriptionValue : null
    );

    if (parsedChapters.length > 0) {
      logger.info(`Issue #${issueNumber} contains ${parsedChapters.length} chapters from description`);
      for (const parsedChapter of parsedChapters) {
        chapterData.push(createParsedChapter(parsedChapter, issue, volumeNumber, issueNumber));
      }
    } else {
      const estimatedChaptersPerIssue = 6;
      logger.info(`No chapters parsed from Issue #${issueNumber}, creating ${estimatedChaptersPerIssue} estimated chapters`);
      for (let j = 1; j <= estimatedChaptersPerIssue; j++) {
        chapterData.push(createFallbackChapter(issue, volumeNumber, issueNumber, j));
      }
    }
  }

  logger.info(`Parsed ${chapterData.length} chapters from ${issues.length} ComicVine issues`);
  return chapterData.length > 0 ? { chapters: chapterData, shouldRecreate: true } : { chapters: [], shouldRecreate: false };
}

/**
 * Find issues array in nested metadata structure
 */
function findIssuesArray(providerData: Record<string, unknown>): Record<string, unknown>[] | null {
  // Check direct issues property
  const issuesDirect = getUnknownProperty(providerData, 'issues');
  if (Array.isArray(issuesDirect)) {
    return issuesDirect as Record<string, unknown>[];
  }

  // Check nested metadata.issues
  const metadata1 = getUnknownProperty(providerData, 'metadata');
  if (isRecord(metadata1)) {
    const issuesMeta1 = getUnknownProperty(metadata1, 'issues');
    if (Array.isArray(issuesMeta1)) {
      return issuesMeta1 as Record<string, unknown>[];
    }

    // Check deeply nested metadata.metadata.issues
    const metadata2 = getUnknownProperty(metadata1, 'metadata');
    if (isRecord(metadata2)) {
      const issuesMeta2 = getUnknownProperty(metadata2, 'issues');
      if (Array.isArray(issuesMeta2)) {
        return issuesMeta2 as Record<string, unknown>[];
      }
    }
  }

  return null;
}
