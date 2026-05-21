/**
 * Response Formatter Module
 *
 * Formats volume and chapter data for API responses, merging fetched chapter details.
 */

import { isRecord, safeGet, safeGetString, safeGetNumber } from '../metadata-utils';

export interface ChapterDetail {
  chapterNumber: string;
  title: string;
  coverImageUrl?: string;
  description?: string;
  synopsis?: string;
  releaseDate?: string;
  pageCount?: number;
  url?: string;
}

export interface VolumeDetail {
  volumeNumber: number;
  title: string;
  chapterCount: number;
  chapters: ChapterDetail[];
  coverImageUrl?: string;
}

/**
 * Format chapter object with merged details from fetched data
 * @param ch - Raw chapter object
 * @param chapterDetailsMap - Map of chapter URL to fetched details
 * @returns Formatted chapter object
 */
function formatChapter(ch: unknown, chapterDetailsMap: Map<string, unknown>): ChapterDetail {
  if (!isRecord(ch)) {
    return { chapterNumber: '0', title: 'Unknown' };
  }

  // Merge fetched details if available
  const chUrl = safeGet(ch, 'url');
  const fetchedDetails = typeof chUrl === 'string' && chUrl ? chapterDetailsMap.get(chUrl) : null;

  // Preserve the original parsed title if it's more descriptive than the fetched one
  let finalTitle = safeGet(ch, 'title');
  const fetchedTitle = safeGetString(fetchedDetails, 'title');
  if (fetchedTitle) {
    // Only use fetched title if it's different from generic "Chapter X" pattern
    const isGenericTitle = /^Chapter\s+\d+$/i.test(fetchedTitle);
    if (!isGenericTitle || !safeGet(ch, 'title')) {
      finalTitle = fetchedTitle;
    }
  }

  // Build chapter object with required fields
  const chapterNumber = String(safeGet(ch, 'chapterNumber') ?? safeGet(ch, 'number') ?? 0);
  const title = String(finalTitle ?? 'Unknown');

  // Extract optional fields
  const coverImg =
    safeGetString(fetchedDetails, 'coverImageUrl') ??
    (safeGet(ch, 'coverImage') ?? safeGet(ch, 'coverImageUrl'));
  const desc = safeGetString(fetchedDetails, 'description') ?? safeGet(ch, 'description');
  const synopsis = safeGetString(fetchedDetails, 'synopsis');
  const releaseDate = safeGetString(fetchedDetails, 'releaseDate');
  const pageCount = safeGetNumber(fetchedDetails, 'pageCount');

  // Build ChapterDetail with proper typing
  const chapterDetail: ChapterDetail = {
    chapterNumber,
    title,
    ...(typeof coverImg === 'string' ? { coverImageUrl: coverImg } : {}),
    ...(typeof desc === 'string' ? { description: desc } : {}),
    ...(typeof synopsis === 'string' ? { synopsis } : {}),
    ...(typeof releaseDate === 'string' ? { releaseDate } : {}),
    ...(typeof pageCount === 'number' ? { pageCount } : {}),
    ...(typeof chUrl === 'string' ? { url: chUrl } : {}),
  };

  return chapterDetail;
}

/**
 * Format volumes with enriched chapter details
 * @param volumes - Array of volume objects
 * @param chapterDetailsMap - Map of chapter URL to fetched details
 * @returns Array of formatted volume details
 */
export function formatVolumeDetails(
  volumes: unknown[],
  chapterDetailsMap: Map<string, unknown>
): VolumeDetail[] {
  return volumes.map((vol: unknown): VolumeDetail => {
    if (!isRecord(vol)) {
      return { volumeNumber: 0, title: 'Unknown', chapterCount: 0, chapters: [] };
    }

    const volNum = safeGet(vol, 'volumeNumber') ?? safeGet(vol, 'number');
    const chapters = safeGet(vol, 'chapters');
    const chaptersArray = Array.isArray(chapters) ? chapters : [];

    // Build volume object with required fields
    const volumeNumber = typeof volNum === 'number' ? volNum : Number(volNum) || 0;
    const title = String(safeGet(vol, 'title') ?? `Volume ${volNum}`);
    const chapterCount = chaptersArray.length;
    const formattedChapters = chaptersArray.map((ch: unknown) =>
      formatChapter(ch, chapterDetailsMap)
    );

    // Extract optional fields
    const coverImg = safeGet(vol, 'coverImage') ?? safeGet(vol, 'coverImageUrl');

    // Build VolumeDetail with proper typing
    const volumeDetail: VolumeDetail = {
      volumeNumber,
      title,
      chapterCount,
      chapters: formattedChapters,
      ...(typeof coverImg === 'string' ? { coverImageUrl: coverImg } : {}),
    };

    return volumeDetail;
  });
}
