/**
 * ComicVine API Fetching Helpers
 *
 * Functions for fetching and formatting ComicVine data via API.
 */

import { stripHtml } from '@/lib/html-sanitizer';
import { parseChaptersFromDescription } from '@/utils/comicvine-chapter-parser';
import { logger } from '@/utils/logger';

export interface ComicVineIssue {
  id: number;
  issue_number?: string;
  name?: string;
  description?: string;
  site_detail_url?: string;
  image?: {
    original_url?: string;
    super_url?: string;
    medium_url?: string;
  };
}

/**
 * One chapter parsed from a ComicVine issue description.
 * Number is a string so special chapters (e.g., "0.1") and bonus
 * chapters can be represented uniformly.
 */
export interface ParsedChapterFromDescription {
  number: string;
  title: string;
}

export interface FormattedVolume {
  volumeNumber: number;
  volumeTitle: string;
  volumeSummary: string;
  coverImage: string;
  issueId: number;
  siteDetailUrl: string;
  /**
   * Iter 17 (production port): chapters parsed from the issue description's
   * embedded `<h2>Chapter Titles</h2><ul><li>...</li></ul>` markup. Empty
   * when ComicVine has no per-chapter info for this issue (we fall back to
   * the single-placeholder chapter in `generateChaptersFromApiData`).
   */
  parsedChapters: ParsedChapterFromDescription[];
}

export interface VolumeApiData {
  volumes: FormattedVolume[];
  seriesTitle: string;
  seriesSummary: string;
  seriesCover: string;
}

/**
 * Format a ComicVine issue into volume data.
 *
 * Iter 17: parses chapter titles from the raw description HTML BEFORE
 * stripping it, so the embedded `<h2>Chapter Titles</h2><ul><li>...</li></ul>`
 * markup that ComicVine ships in many series' API responses is captured.
 * The stripped text is still used for `volumeSummary` (the user-facing blurb).
 */
export function formatIssueAsVolume(issue: ComicVineIssue): FormattedVolume {
  const issueNumber = issue.issue_number ? parseFloat(issue.issue_number) : 0;
  const coverImage = issue.image?.original_url ?? issue.image?.super_url ?? issue.image?.medium_url ?? '';
  const rawDescription = issue.description ?? '';
  const cleanDescription = stripHtml(rawDescription);
  const siteDetailUrl = issue.site_detail_url ?? `https://comicvine.gamespot.com/issue/4000-${issue.id}/`;

  // Parse chapter titles from the original HTML (before strip).
  // Returns [] if the description has no chapter markup.
  const parsedChapters: ParsedChapterFromDescription[] = parseChaptersFromDescription(rawDescription).map(
    (ch) => ({ number: String(ch.chapterNumber), title: ch.title }),
  );

  return {
    volumeNumber: issueNumber,
    volumeTitle: issue.name ?? `Volume ${issueNumber}`,
    volumeSummary: cleanDescription,
    coverImage,
    issueId: issue.id,
    siteDetailUrl,
    parsedChapters,
  };
}

/**
 * Fetch volume data via ComicVine API (faster than scraping)
 */
export async function fetchVolumeDataViaApi(seriesVolumeId: number): Promise<VolumeApiData | null> {
  try {
    const { comicvineService } = await import('../../../../services/comicvine/service');

    const seriesInfo = await comicvineService.getBasicVolumeInfo(seriesVolumeId);
    if (!seriesInfo) {
      logger.warn(`[ComicVine API] No series info found for ID ${seriesVolumeId}`);
      return null;
    }

    const issues = await comicvineService.getAllVolumeIssues(seriesVolumeId);
    if (issues.length === 0) {
      logger.warn(`[ComicVine API] No issues found for series ${seriesVolumeId}`);
      return null;
    }

    logger.info(`[ComicVine API] Found ${issues.length} issues for series ${seriesVolumeId}`);

    const volumes = issues
      .map(issue => formatIssueAsVolume(issue as ComicVineIssue))
      .sort((a, b) => a.volumeNumber - b.volumeNumber);

    const cleanSeriesDescription = stripHtml(seriesInfo.description ?? seriesInfo.deck ?? '');

    return {
      volumes,
      seriesTitle: seriesInfo.name ?? '',
      seriesSummary: cleanSeriesDescription,
      seriesCover: seriesInfo.image?.original_url ?? seriesInfo.image?.super_url ?? ''
    };
  } catch (error: unknown) {
    logger.warn(`[ComicVine API] Fetch failed for series ${seriesVolumeId}:`, {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Generate chapters from API volume data (instant, no scraping needed).
 *
 * Iter 17: when the issue's description embeds a `<h2>Chapter Titles</h2>`
 * list (now extracted into `vol.parsedChapters` by `formatIssueAsVolume`),
 * we use those individual chapter titles instead of the single
 * one-chapter-per-volume placeholder. Verified empirically: 100% of One Piece,
 * Naruto, Dragon Ball, Black Clover, JoJo Phantom Blood issues have this
 * markup, so the wizard now gets full chapter lists with no scraping.
 *
 * Falls back to the single-placeholder chapter when no markup is present
 * (Spy x Family, Sword Art Online, Blade of the Immortal, etc.).
 */
export function generateChaptersFromApiData(volumes: FormattedVolume[]): Array<{
  volumeNumber: number;
  volumeTitle: string;
  volumeSummary: string;
  coverImage: string;
  chapters: Array<{ number: string; title: string }>;
  totalChapters: number;
}> {
  return volumes.map((vol) => {
    const title = vol.volumeTitle || `Chapter ${vol.volumeNumber}`;
    const chapters = vol.parsedChapters.length > 0
      ? vol.parsedChapters.map((ch) => ({ number: ch.number, title: ch.title }))
      : [{ number: String(vol.volumeNumber), title }];
    return {
      volumeNumber: vol.volumeNumber,
      volumeTitle: title,
      volumeSummary: vol.volumeSummary,
      coverImage: vol.coverImage,
      chapters,
      totalChapters: chapters.length,
    };
  });
}
