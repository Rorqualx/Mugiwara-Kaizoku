// @file-size-justified: URL parser handles complex Wikipedia API responses, volume/chapter extraction, and metadata mapping in cohesive flow
/**
 * Wikipedia URL Parser
 *
 * Handles parsing Wikipedia URLs for manga metadata extraction.
 * Extracts volume/chapter data from Wikipedia pages and chapter lists.
 *
 * @module providers/wikipedia-url-parser
 */

import type { WikipediaParsingHints } from '@/components/addManga/wizard-utils/mutation-types';
import type {
  ProviderMetadata,
  Volume,
  VolumesData
} from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Call the fetchWikipediaMetadata tRPC mutation, returning null on failure.
 * The procedure returns the bare payload and throws a TRPCError on error.
 */
async function fetchWikipediaMetadataSafe(
  titleFromUrl: string,
  parsingHints?: WikipediaParsingHints
): Promise<unknown> {
  const { vanillaTrpcClient } = await import('@/utils/trpc-client/vanilla');
  try {
    return await vanillaTrpcClient.metadata.fetchWikipediaMetadata.mutate({
      title: titleFromUrl,
      // Pass parsing hints if available (for optimized extraction)
      ...(parsingHints ? { parsingHints } : {}),
    });
  } catch (mutationError: unknown) {
    logger.warn('[parseWikipediaUrl] tRPC mutation returned error:', mutationError);
    return null;
  }
}

/**
 * Handles Wikipedia URL parsing and volume data extraction.
 * Uses tRPC endpoint for Wikipedia API access, with fallback to direct HTML parsing.
 *
 * @param urlToParse - Wikipedia URL to parse (e.g., https://en.wikipedia.org/wiki/Fire_Force)
 * @param setVolumesData - State setter for volume data
 * @param setSelectedSourcesMetadata - State setter for provider metadata
 * @param parsingHints - Optional parsing hints from static analysis
 * @returns Promise that resolves when parsing completes
 */
// eslint-disable-next-line complexity -- URL parsing with multiple format handlers and redirect logic
export async function parseWikipediaUrl(
  urlToParse: string,
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void,
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void,
  parsingHints?: WikipediaParsingHints
): Promise<void> {
  logger.debug('[parseWikipediaUrl] ENTERED FUNCTION', {
    url: urlToParse,
    hasParsingHints: !!parsingHints,
  });

  // Determine effective URL (may redirect to list page based on hints)
  let effectiveUrl = urlToParse;

  // If hints indicate a list page URL exists and we're on a main article, redirect
  if (parsingHints?.listPageUrl && parsingHints.pageType === 'main-article') {
    logger.info('[parseWikipediaUrl] Redirecting to list page from hints', {
      originalUrl: urlToParse,
      listPageUrl: parsingHints.listPageUrl,
    });
    effectiveUrl = parsingHints.listPageUrl;
  }

  // Log parsing hints for debugging
  if (parsingHints) {
    logger.info('[parseWikipediaUrl] Using parsing hints from static analysis', {
      pageType: parsingHints.pageType,
      structureType: parsingHints.structureType,
      recommendedParser: parsingHints.recommendedParser,
      hasVolumeData: parsingHints.hasVolumeData,
      hasChapterData: parsingHints.hasChapterData,
      relevantSections: parsingHints.relevantSections,
      tableTypes: parsingHints.tableTypes,
    });
  }

  // Extract title from Wikipedia URL
  // e.g., https://en.wikipedia.org/wiki/Fire_Force -> "Fire Force"
  // e.g., https://en.wikipedia.org/wiki/List_of_Fire_Force_chapters -> "Fire Force"
  const urlMatch = effectiveUrl.match(/\/wiki\/(?:List_of_)?([^#?]+?)(?:_chapters)?$/i);
  logger.debug('[parseWikipediaUrl] URL match result', { matched: !!urlMatch?.[1] });

  if (!urlMatch?.[1]) {
    logger.debug('[parseWikipediaUrl] No match, showing notification');
    notify({ severity: 'ERROR', title: 'Invalid Wikipedia URL', message: 'Could not extract title from Wikipedia URL' });
    return;
  }

  // Convert URL-encoded title to readable format
  const titleFromUrl = decodeURIComponent(urlMatch[1].replace(/_/g, ' '));
  logger.debug('[parseWikipediaUrl] Extracted title', { title: titleFromUrl });

  // Use server-side tRPC endpoint which has proper Wikipedia API access
  // This avoids CORS issues and uses the Wikipedia service with full parsing logic
  try {
    logger.debug('[parseWikipediaUrl] About to call tRPC mutation', {
      title: titleFromUrl,
      hasParsingHints: !!parsingHints,
    });
    const result = await fetchWikipediaMetadataSafe(titleFromUrl, parsingHints);
    logger.debug('[parseWikipediaUrl] tRPC mutation RETURNED', {
      resultType: typeof result,
      resultKeys: result && typeof result === 'object' ? Object.keys(result) : [],
    });

    if (!result) {
      // Fallback: try direct HTML parsing for chapter list URLs
      if (effectiveUrl.includes('List_of_') && effectiveUrl.includes('_chapters')) {
        logger.info('[parseWikipediaUrl] Falling back to direct HTML parsing for chapter list URL');
        await parseWikipediaUrlFallback(effectiveUrl, setVolumesData, setSelectedSourcesMetadata);
        return;
      }

      notify({ severity: 'WARNING', title: 'No Data Found', message: 'Could not find Wikipedia data for this title. Try entering the chapter list URL directly.' });
      return;
    }

    const wikiData = result as Record<string, unknown>;
    logger.info('[parseWikipediaUrl] Got Wikipedia metadata via tRPC:', {
      title: wikiData['title'],
      volumes: wikiData['volumes'],
      chapters: wikiData['chapters'],
      hasVolumeList: !!wikiData['volumeList'],
      hasChapterList: !!wikiData['chapterList']
    });

    // Extract volume data
    let volumeData: unknown[] = [];
    const volumeList = wikiData['volumeList'];
    if (Array.isArray(volumeList) && volumeList.length > 0) {
      volumeData = volumeList;

      // Debug: Check if volumes have descriptions
      const volumesWithDesc = volumeList.filter((v: unknown) => {
        const vol = v as Record<string, unknown>;
        return vol['description'] || vol['summary'];
      });
      const firstVolume = volumeList[0] as Record<string, unknown> | undefined;
      logger.info('[parseWikipediaUrl] Volume descriptions from server:', {
        totalVolumes: volumeList.length,
        volumesWithDescriptions: volumesWithDesc.length,
        firstVolumeKeys: firstVolume ? Object.keys(firstVolume) : [],
        firstVolumeDesc: firstVolume?.['description']?.toString().substring(0, 100),
        firstVolumeSummary: firstVolume?.['summary']?.toString().substring(0, 100)
      });
    }

    // Extract chapter data
    let allChapters: Array<{ number: number | string; title?: string; volumeNumber?: number }> = [];
    const chapterList = wikiData['chapterList'];
    if (Array.isArray(chapterList) && chapterList.length > 0) {
      allChapters = chapterList.map((ch: unknown) => {
        const chObj = ch as Record<string, unknown>;
        const result: { number: number | string; title?: string; volumeNumber?: number } = {
          number: (chObj['number'] ?? chObj['chapterNumber'] ?? 0) as number | string
        };
        const title = chObj['title'];
        if (typeof title === 'string') {
          result.title = title;
        }
        const volNum = chObj['volumeNumber'];
        if (typeof volNum === 'number') {
          result.volumeNumber = volNum;
        }
        return result;
      });
      logger.info('[parseWikipediaUrl] Got chapters from Wikipedia:', {
        count: allChapters.length,
        hasEpilogues: allChapters.some(ch =>
          String(ch.number).toLowerCase().includes('epilogue') ||
          (typeof ch.number === 'number' && ch.number > 302)
        )
      });
    }

    // Continue with volume/chapter processing
    processWikipediaData(volumeData, allChapters, wikiData, setVolumesData, setSelectedSourcesMetadata);

  } catch (error) {

    logger.error('[parseWikipediaUrl] tRPC mutation failed:', error);

    // Fallback: try direct HTML parsing
    logger.info('[parseWikipediaUrl] Falling back to direct HTML parsing');
    await parseWikipediaUrlFallback(effectiveUrl, setVolumesData, setSelectedSourcesMetadata);
  }
}

// ============================================================================
// Fallback Parser
// ============================================================================

/**
 * Fallback Wikipedia URL parser using direct HTML fetching.
 * Used when tRPC endpoint fails or for chapter list URLs.
 *
 * @param urlToParse - Wikipedia URL to parse
 * @param setVolumesData - State setter for volume data
 * @param setSelectedSourcesMetadata - State setter for provider metadata
 * @returns Promise that resolves when parsing completes
 */
export async function parseWikipediaUrlFallback(
  urlToParse: string,
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void,
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void
): Promise<void> {
  logger.info('[parseWikipediaUrlFallback] Direct HTML parsing for:', urlToParse);

  // Dynamically import dependencies
  const axios = (await import('axios')).default;
  const { parseVolumeTablesEnhanced, parsePageAdaptive } = await import(
    '@/server/services/metadata/utils/fandomTableParser'
  );
  const { parseChapterTables } = await import(
    '@/server/services/wikipedia/wikipedia/chapter-parser'
  );

  const response = await axios.get(urlToParse, {
    timeout: 30000
  });

  const html = typeof response.data === 'string' ? response.data : String(response.data);
  let volumeData = parseVolumeTablesEnhanced(html, parsePageAdaptive);

  // Use the Wikipedia chapter parser which handles epilogues correctly
  let allChapters = parseChapterTables(html);
  logger.info('[parseWikipediaUrlFallback] Parsed data:', {
    volumeCount: volumeData.length,
    chapterCount: allChapters.length,
    hasEpilogues: allChapters.some(ch =>
      String(ch.number).toLowerCase().includes('epilogue') ||
      (typeof ch.number === 'number' && ch.number > 302)
    )
  });

  // Check for chapter list link if on main page
  if (!urlToParse.includes('List_of_')) {
    const chapterListLinkMatch = html.match(/href="(\/wiki\/List_of_[^"]+_chapters)"/i);
    if (chapterListLinkMatch?.[1]) {
      const chapterListUrl = `https://en.wikipedia.org${chapterListLinkMatch[1]}`;
      logger.info('[parseWikipediaUrlFallback] Found chapter list link, fetching:', chapterListUrl);

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
        if (chapterListVolumes.length > 0) {
          volumeData = chapterListVolumes;
        }
      } catch (chapterErr) {
        logger.warn('[parseWikipediaUrlFallback] Failed to fetch chapter list page:', chapterErr);
      }
    }
  }

  processWikipediaData(
    volumeData,
    allChapters.map(ch => {
      const result: { number: number | string; title?: string; volumeNumber?: number } = {
        number: ch.number
      };
      if (ch.title) {
        result.title = ch.title;
      }
      if (ch.volumeNumber !== undefined) {
        result.volumeNumber = ch.volumeNumber;
      }
      return result;
    }),
    {},
    setVolumesData,
    setSelectedSourcesMetadata
  );
}

// ============================================================================
// Data Processing
// ============================================================================

/**
 * Process Wikipedia volume and chapter data into the expected format.
 * Transforms raw Wikipedia data, handles orphan chapters, and calculates accurate totals.
 *
 * @param volumeData - Raw volume data from Wikipedia parsing
 * @param allChapters - Array of chapters with number, title, and optional volumeNumber
 * @param wikiData - Additional Wikipedia metadata
 * @param setVolumesData - State setter for volume data
 * @param setSelectedSourcesMetadata - State setter for provider metadata
 */
export function processWikipediaData(
  volumeData: unknown[],
  allChapters: Array<{ number: number | string; title?: string; volumeNumber?: number }>,
  wikiData: Record<string, unknown>,
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void,
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void
): void {
  logger.info('[processWikipediaData] Processing:', {
    volumeCount: volumeData.length,
    chapterCount: allChapters.length
  });

  // If no volumes on main page, check if we found them on chapter list page
  if (volumeData.length === 0) {
    // If we have chapters from chapter list but no volumes, create synthetic volumes
    if (allChapters.length > 0) {
      logger.info('[parseWikipediaUrl] No volumes found but have chapters, creating from chapter data');

      // Group chapters by volume number
      const volumeMap = new Map<number, typeof allChapters>();
      allChapters.forEach(ch => {
        const volNum = ch.volumeNumber ?? 1;
        const existing = volumeMap.get(volNum) ?? [];
        existing.push(ch);
        volumeMap.set(volNum, existing);
      });

      // Create volume objects from grouped chapters
      volumeMap.forEach((chapters, volNum) => {
        volumeData.push({
          number: volNum,
          volumeNumber: volNum,
          title: `Volume ${volNum}`,
          chapters: chapters.map(ch => ({
            chapterNumber: String(ch.number),
            number: ch.number,
            title: ch.title ?? `Chapter ${ch.number}`
          }))
        });
      });

      // Sort by volume number
      volumeData.sort((a, b) => {
        const aNum = (a as Record<string, unknown>)['number'] as number;
        const bNum = (b as Record<string, unknown>)['number'] as number;
        return aNum - bNum;
      });

      logger.info('[parseWikipediaUrl] Created volumes from chapter data:', volumeData.length);
    } else {
      // No volumes found and no chapters to create from
      notify({ severity: 'WARNING', title: 'No Volumes Found', message: 'Could not extract volume data from Wikipedia page. Try using the chapter list URL directly (e.g., List_of_X_chapters)' });
      return;
    }
  }

  // Transform to match expected format
  const transformedVolumes = volumeData.map((vol: unknown, idx: number) => {
    const volObj = vol as Record<string, unknown>;
    const volumeNumber = (volObj['number'] ?? volObj['volumeNumber'] ?? idx + 1) as number;
    let chapters = volObj['chapters'];

    // If we have chapters from the chapter list page, use those instead
    // They include epilogues and have proper chapter numbers
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

    // Capture volume description/summary from Wikipedia
    const description = volObj['description'] ?? volObj['summary'] ?? volObj['plot'];
    const summary = volObj['summary'] ?? volObj['description'] ?? volObj['plot'];

    return {
      volumeNumber,
      number: volumeNumber,
      title: volObj['title'] ?? `Volume ${volumeNumber}`,
      coverImageUrl: volObj['coverImage'] ?? volObj['coverImageUrl'],
      coverImage: volObj['coverImage'] ?? volObj['coverImageUrl'],
      chapterCount: Array.isArray(chapters) ? chapters.length : 0,
      chapters: chapters ?? [],
      // Include volume summaries from Wikipedia
      description: typeof description === 'string' ? description : undefined,
      summary: typeof summary === 'string' ? summary : undefined,
      // Additional metadata
      originalReleaseDate: volObj['originalReleaseDate'] ?? volObj['releaseDate'],
      englishReleaseDate: volObj['englishReleaseDate'],
      isbn: volObj['isbn'],
      chapterRange: volObj['chapterRange']
    };
  });

  // Log volume summaries found
  const volumesWithSummaries = transformedVolumes.filter(v => v.description || v.summary);
  logger.info('[processWikipediaData] Volume transformation complete:', {
    totalVolumes: transformedVolumes.length,
    volumesWithSummaries: volumesWithSummaries.length,
    firstVolumeKeys: transformedVolumes[0] ? Object.keys(transformedVolumes[0]) : [],
    firstVolumeDescription: transformedVolumes[0]?.description?.substring(0, 100),
    firstVolumeSummary: transformedVolumes[0]?.summary?.substring(0, 100)
  });
  if (volumesWithSummaries.length > 0) {
    logger.info('[processWikipediaData] Found volume summaries:', {
      count: volumesWithSummaries.length,
      volumes: volumesWithSummaries.slice(0, 3).map(v => ({
        number: v.volumeNumber,
        hasDescription: !!v.description,
        descriptionLength: v.description?.length ?? 0
      }))
    });
  }

  // Add orphan chapters (like epilogues) that don't have a volume assignment to the last volume
  if (allChapters.length > 0 && transformedVolumes.length > 0) {
    const orphanChapters = allChapters.filter(ch => !ch.volumeNumber);
    if (orphanChapters.length > 0) {
      const lastVolume = transformedVolumes[transformedVolumes.length - 1] as Record<string, unknown>;
      const existingChapters = (lastVolume['chapters'] ?? []) as Array<Record<string, unknown>>;
      const orphanMapped = orphanChapters.map(ch => ({
        chapterNumber: String(ch.number),
        number: ch.number,
        title: ch.title ?? `Chapter ${ch.number}`
      }));
      lastVolume['chapters'] = [...existingChapters, ...orphanMapped];
      lastVolume['chapterCount'] = (lastVolume['chapters'] as unknown[]).length;
      logger.info('[parseWikipediaUrl] Added orphan chapters to last volume:', {
        count: orphanChapters.length,
        chapters: orphanChapters.map(ch => ch.number)
      });
    }
  }

  // Calculate accurate chapter count using max chapter number + epilogues
  // This avoids counting duplicates and properly handles epilogues
  const calculateAccurateChapterCount = (): number => {
    if (allChapters.length > 0) {
      let maxRegularChapter = 0;
      let epilogueCount = 0;

      allChapters.forEach(ch => {
        const numStr = String(ch.number);
        if (numStr.toLowerCase().includes('epilogue')) {
          epilogueCount++;
        } else {
          const parsed = parseInt(numStr, 10);
          if (!isNaN(parsed) && parsed > maxRegularChapter) {
            maxRegularChapter = parsed;
          }
        }
      });

      // max chapter + 1 (for chapter 0) + epilogues
      return maxRegularChapter + 1 + epilogueCount;
    }

    // Fallback: count from volumes
    return transformedVolumes.reduce((sum: number, v: unknown) => {
      const vObj = v as Record<string, unknown>;
      const chapters = vObj['chapters'];
      return sum + (Array.isArray(chapters) ? chapters.length : 0);
    }, 0);
  };

  const totalChapters = calculateAccurateChapterCount();

  setVolumesData(prev => ({
    ...prev,
    volumes: transformedVolumes as unknown as Volume[],
    wikipedia: {
      volumes: transformedVolumes as unknown as Volume[],
      totalVolumes: transformedVolumes.length,
      totalChapters
    },
    totalVolumes: transformedVolumes.length
  }));

  setSelectedSourcesMetadata((prev: Record<string, ProviderMetadata>) => ({
    ...prev,
    wikipedia: {
      ...(prev['wikipedia'] ?? {}),
      volumes: transformedVolumes.length,
      chapters: totalChapters,
      volumeData: transformedVolumes as unknown as Volume[],
      source: 'wikipedia',
      hasCoverImages: transformedVolumes.some((v: unknown) => {
        const vObj = v as Record<string, unknown>;
        return !!vObj['coverImageUrl'];
      }),
      hasChapterList: transformedVolumes.some((v: unknown) => {
        const vObj = v as Record<string, unknown>;
        const chapters = vObj['chapters'];
        return Array.isArray(chapters) && chapters.length > 0;
      }),
      // Include extended metadata from Wikipedia extraction
      status: wikiData['status'] as string | undefined,
      publicationStatus: wikiData['publicationStatus'] as string | undefined,
      mangaType: wikiData['mangaType'] as string | undefined,
      editor: wikiData['editor'] as string[] | undefined,
      licensedBy: wikiData['licensedBy'] as string[] | undefined,
      coverImage: wikiData['coverImage'] as string | undefined,
      synopsis: wikiData['synopsis'] as string | undefined,
    } as unknown as ProviderMetadata
  }));

  notify({ severity: 'SUCCESS', title: 'Wikipedia Data Extracted', message: `Successfully extracted ${transformedVolumes.length} volumes` });
}
