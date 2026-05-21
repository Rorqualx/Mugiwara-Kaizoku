import type { ProviderMetadata, Volume, Chapter } from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';

import {
  collectAlternativeTitles,
  formatDate,
  getCoverImage,
  getDescription,
  normalizeToStringArray
} from './helpers';

/**
 * HTML fallback parsing for Wikipedia
 * Matches primary path (url-handlers.ts:parseWikipediaUrlFallback) behavior
 *
 * Used when tRPC mutation fails to extract volume/chapter data directly from HTML
 */
export async function fetchWikipediaWithHtmlFallback(
  url: string,
  searchResult: Record<string, unknown>
): Promise<ProviderMetadata | null> {
  try {
    // Dynamically import dependencies (same as primary path)
    const axios = (await import('axios')).default;
    const { parseVolumeTablesEnhanced, parsePageAdaptive } = await import(
      '@/server/services/metadata/utils/fandomTableParser'
    );
    const { parseChapterTables } = await import(
      '@/server/services/wikipedia/wikipedia/chapter-parser'
    );

    logger.info('[Wikipedia Fallback] Fetching HTML from:', url);
    const response = await axios.get(url, { timeout: 30000 });
    const html = typeof response.data === 'string' ? response.data : String(response.data);

    let volumeData = parseVolumeTablesEnhanced(html, parsePageAdaptive);
    let allChapters = parseChapterTables(html);

    logger.info('[Wikipedia Fallback] Parsed initial data:', {
      volumeCount: volumeData.length,
      chapterCount: allChapters.length
    });

    // Check for chapter list link if on main page (match primary path logic)
    if (!url.includes('List_of_')) {
      const chapterListLinkMatch = html.match(/href="(\/wiki\/List_of_[^"]+_chapters)"/i);
      if (chapterListLinkMatch?.[1]) {
        const chapterListUrl = `https://en.wikipedia.org${chapterListLinkMatch[1]}`;
        logger.info('[Wikipedia Fallback] Found chapter list link, fetching:', chapterListUrl);

        try {
          const chapterResponse = await axios.get(chapterListUrl, { timeout: 30000 });
          const chapterHtml = typeof chapterResponse.data === 'string'
            ? chapterResponse.data
            : String(chapterResponse.data);

          allChapters = parseChapterTables(chapterHtml);

          // Try to get volumes from chapter list page if none found on main page
          const chapterListVolumes = volumeData.length === 0
            ? parseVolumeTablesEnhanced(chapterHtml, parsePageAdaptive)
            : [];
          // Use ternary assignment to avoid adding nesting depth
          volumeData = chapterListVolumes.length > 0 ? chapterListVolumes : volumeData;
        } catch (chapterErr) {
          logger.warn('[Wikipedia Fallback] Failed to fetch chapter list page:', chapterErr);
        }
      }
    }

    if (volumeData.length === 0 && allChapters.length === 0) {
      logger.info('[Wikipedia Fallback] No data extracted from HTML');
      return null;
    }

    // Transform to match ProviderMetadata format (match primary path processing)
    const transformedVolumes: Volume[] = volumeData.map((vol: unknown, idx: number) => {
      const volObj = vol as Record<string, unknown>;
      const volumeNumber = (volObj['number'] ?? volObj['volumeNumber'] ?? idx + 1) as number;
      let chapters: unknown[] = (volObj['chapters'] ?? []) as unknown[];

      // Use chapters from chapter list if available
      if (allChapters.length > 0) {
        const volumeChapters = allChapters.filter(ch => ch.volumeNumber === volumeNumber);
        if (volumeChapters.length > 0) {
          chapters = volumeChapters.map(ch => ({
            chapterNumber: String(ch.number),
            number: ch.number,
            title: ch.title ?? `Chapter ${ch.number}`
          }));
        }
      }

      const title = (volObj['title'] ?? `Volume ${volumeNumber}`) as string;
      const coverUrl = (volObj['coverImage'] ?? volObj['coverImageUrl']) as string | undefined;
      const desc = (volObj['description'] ?? volObj['summary']) as string | undefined;

      // Build volume object, only including optional properties if they have values
      // (required for exactOptionalPropertyTypes)
      const volume: Volume = {
        volumeNumber,
        number: volumeNumber,
        title,
        chapterCount: chapters.length,
        chapters: chapters as Chapter[]
      };

      // Conditionally add optional properties
      if (coverUrl) {
        volume.coverImageUrl = coverUrl;
        volume.coverImage = coverUrl;
      }
      if (desc) {
        volume.description = desc;
        volume.volumeSummary = desc; // Volume uses volumeSummary, not summary
      }

      return volume;
    });

    // Calculate chapter count
    const totalChapters = allChapters.length > 0
      ? allChapters.length
      : transformedVolumes.reduce((sum, v) => sum + (v.chapterCount ?? 0), 0);

    logger.info('[Wikipedia Fallback] Extracted data:', {
      volumes: transformedVolumes.length,
      chapters: totalChapters
    });

    return {
      id: (searchResult["id"] ?? url) as string,
      sourceId: (searchResult["sourceId"] ?? url) as string,
      title: (searchResult["title"] ?? '') as string,
      description: getDescription(searchResult),
      url,
      coverImage: getCoverImage(searchResult),
      alternativeTitles: collectAlternativeTitles(searchResult),
      genres: (searchResult["genres"] ?? []) as string[],
      authors: normalizeToStringArray(searchResult["authors"] ?? searchResult["author"]),
      artists: normalizeToStringArray(searchResult["artists"] ?? searchResult["artist"]),
      publisher: (searchResult["publisher"] ?? '') as string,
      startDate: formatDate(searchResult["startDate"]),
      endDate: formatDate(searchResult["endDate"]),
      volumes: transformedVolumes.length,
      chapters: totalChapters,
      volumeData: transformedVolumes,
      chapterData: allChapters as Chapter[],
      rawData: {
        wikipediaUrl: url,
        volumeList: transformedVolumes,
        chapterList: allChapters,
        source: 'html_fallback'
      }
    };
  } catch (error) {
    logger.error('[Wikipedia Fallback] Failed:', error);
    return null;
  }
}
