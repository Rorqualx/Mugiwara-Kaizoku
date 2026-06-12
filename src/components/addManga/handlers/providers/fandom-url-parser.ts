/**
 * Fandom URL Parser
 *
 * Handles parsing Fandom wiki URLs for manga metadata extraction.
 * Extracts volume/chapter data, cover images, and galleries.
 *
 * @module providers/fandom-url-parser
 */

import type { MutationResults, SerializedParsingHints } from '@/components/addManga/wizard-utils';
import type {
  MediaGallery,
  ProviderMetadata,
  Volume,
  VolumesData
} from '@/types/universalImportWizard.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Options for Fandom URL parsing
 */
export interface ParseFandomUrlOptions {
  urlToParse: string;
  mutations: MutationResults;
  setVolumesData: (data: VolumesData | ((prev: VolumesData) => VolumesData)) => void;
  setSelectedSourcesMetadata: (updater: (prev: Record<string, ProviderMetadata>) => Record<string, ProviderMetadata>) => void;
  volumesData: VolumesData;
  setMediaGallery?: (gallery: MediaGallery) => void;
  /** Parsing hints from static analysis (optional) */
  parsingHints?: SerializedParsingHints;
  /** Recommended parser from static analysis (optional) */
  recommendedParser?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Transforms Fandom volume details to include proper structure
 * @param volumeDetails - Raw volume details from API
 * @returns Transformed volume data with complete structure
 */
export function transformFandomVolumes(volumeDetails: unknown[]): unknown[] {
  return volumeDetails.map((vol: unknown, _volIndex: number) => {
    const volObj = vol as Record<string, unknown>;

    // Generate volume summary from chapter synopses
    let volumeSummary = volObj["description"];
    const chapters = volObj["chapters"];

    if (!volumeSummary && Array.isArray(chapters) && chapters.length > 0) {
      // Combine the first few chapter synopses to create a volume summary
      const chapterSummaries = chapters
        .filter((ch: unknown) => {
          const chObj = ch as Record<string, unknown>;
          return chObj["synopsis"] ?? chObj["description"];
        })
        .slice(0, 3) // Take first 3 chapters with summaries
        .map((ch: unknown) => {
          const chObj = ch as Record<string, unknown>;
          return chObj["synopsis"] ?? chObj["description"];
        });

      if (chapterSummaries.length > 0) {
        // Create a volume summary from chapter summaries
        const combinedSummary = chapterSummaries.join(' ... ');
        // Limit to reasonable length (500 chars)
        volumeSummary = combinedSummary.length > 500
          ? combinedSummary.substring(0, 497) + '...'
          : combinedSummary;
      }
    }

    const firstChapter = Array.isArray(chapters) && chapters.length > 0
      ? chapters[0] as Record<string, unknown>
      : null;
    const lastChapter = Array.isArray(chapters) && chapters.length > 0
      ? chapters[chapters.length - 1] as Record<string, unknown>
      : null;

    return {
      volumeNumber: volObj["volumeNumber"],
      number: volObj["volumeNumber"], // Add number field for compatibility
      title: volObj["title"] ?? `Volume ${volObj["volumeNumber"]}`,
      coverImageUrl: volObj["coverImageUrl"],
      coverImage: volObj["coverImageUrl"], // Add alias for compatibility
      chapterCount: volObj["chapterCount"] ?? (Array.isArray(chapters) ? chapters.length : 0),
      chapters: chapters ?? [],
      startChapter: firstChapter?.["chapterNumber"],
      endChapter: lastChapter?.["chapterNumber"],
      pageCount: volObj["pageCount"],
      releaseDate: volObj["releaseDate"],
      isbn: volObj["isbn"],
      description: volumeSummary,
      summary: volumeSummary // Also add as 'summary' field for UI compatibility
    };
  });
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Handles Fandom URL parsing and volume data extraction.
 * Fetches both volume/chapter structure and metadata (authors, idMal, etc.) in parallel.
 *
 * @param options - Parser options containing URL and state setters
 * @param options.urlToParse - Fandom wiki URL to parse
 * @param options.mutations - tRPC mutation handlers for API calls
 * @param options.setVolumesData - State setter for volume data
 * @param options.setSelectedSourcesMetadata - State setter for provider metadata
 * @param options.volumesData - Current volumes data state
 * @param options.setMediaGallery - Optional state setter for media gallery images
 * @returns Promise that resolves when parsing completes
 */
// eslint-disable-next-line complexity -- URL parsing orchestrates multiple async operations with error handling
export async function parseFandomUrl(options: ParseFandomUrlOptions): Promise<void> {
  const {
    urlToParse,
    mutations,
    setVolumesData,
    setSelectedSourcesMetadata,
    volumesData,
    setMediaGallery,
    parsingHints,
    recommendedParser,
  } = options;

  logger.info('[parseFandomUrl] Starting Fandom parse for:', urlToParse);

  // Log parsing hints if available (from static analysis)
  if (parsingHints ?? recommendedParser) {
    logger.info('[parseFandomUrl] Using parsing hints from static analysis', {
      recommendedParser,
      structureType: parsingHints?.chapterConvention,
      hasVolumeSelectors: parsingHints?.volumeSelectors.length ?? 0,
      hasChapterSelectors: parsingHints?.chapterSelectors.length ?? 0,
    });
  }

  // Call both mutations in parallel - one for volume/chapter structure, one for metadata (authors, idMal, etc.)
  const [parseResult, fetchResult] = await Promise.allSettled([
    mutations.parseFandomUrlMutation.mutateAsync({
      url: urlToParse,
      fetchChapterCovers: true,    // Enable bulk fetching - fetch ALL chapters at once
      maxChaptersToFetch: 0,        // 0 means fetch ALL chapters (no limit)
      // Pass parsing hints if available (from static analysis)
      ...(parsingHints ? { parsingHints } : {}),
      ...(recommendedParser ? { recommendedParser } : {}),
    }),
    mutations.fetchFandomMutation.mutateAsync({
      url: urlToParse
    })
  ]);

  // Extract volume/chapter data from parse result
  // (tRPC returns the bare payload; wrap it under `data` to keep downstream access uniform)
  type ParsedFandomData = { volumeDetails?: unknown[]; chapters?: number; totalChapters?: number; gallery?: string[] };
  const result: { data?: ParsedFandomData } | undefined = parseResult.status === 'fulfilled'
    ? { data: parseResult.value as unknown as ParsedFandomData }
    : undefined;

  // Extract metadata (authors, idMal, description, genres) from fetch result
  type FetchData = {
    authors?: string[];
    myAnimeListId?: number;
    description?: string;
    genres?: string[];
    startDate?: string;
    endDate?: string;
    status?: string;
  };
  const fetchData = fetchResult.status === 'fulfilled'
    ? (fetchResult.value as unknown as FetchData)
    : undefined;

  logger.info('[parseFandomUrl] Both mutations completed:', {
    parseSuccess: parseResult.status === 'fulfilled',
    fetchSuccess: fetchResult.status === 'fulfilled',
    fetchAuthors: fetchData?.authors,
    fetchIdMal: fetchData?.myAnimeListId,
    fetchHasDescription: !!fetchData?.description,
  });

  logger.info('[parseFandomUrl] Fandom result:', {
    hasData: !!result?.data,
    volumeCount: result?.data?.volumeDetails?.length,
    totalChapters: result?.data?.chapters,
    firstVolume: result?.data?.volumeDetails?.[0],
    hasCoverImages: !!(result?.data?.volumeDetails?.[0] as Record<string, unknown> | undefined)?.[("coverImageUrl")]
  });

  if (!result?.data?.volumeDetails) return;

  // Transform volumeDetails to include proper structure
  const transformedVolumes = transformFandomVolumes(result.data.volumeDetails);

  // DEBUG: Verify chapter covers in transformed data
  let chapterCoversInTransformed = 0;
  transformedVolumes.forEach((vol: unknown) => {
    const volObj = vol as Record<string, unknown>;
    const chapters = volObj['chapters'];
    if (Array.isArray(chapters)) {
      chapters.forEach((ch: unknown) => {
        const chObj = ch as Record<string, unknown>;
        if (chObj['coverImageUrl']) {
          chapterCoversInTransformed++;
        }
      });
    }
  });
  logger.info('[parseFandomUrl] Chapter covers BEFORE storing in state:', {
    totalChapterCovers: chapterCoversInTransformed,
    sampleCover: (() => {
      const vol = transformedVolumes[0] as Record<string, unknown> | undefined;
      const chapters = vol?.['chapters'];
      if (Array.isArray(chapters) && chapters.length > 0) {
        const firstChapter = chapters[0] as Record<string, unknown>;
        return firstChapter['coverImageUrl'];
      }
      return undefined;
    })()
  });

  // Store volumes in both places for compatibility
  setVolumesData(prev => ({
    ...prev,
    volumes: transformedVolumes as unknown as Volume[],
    ...(result.data && {
      fandom: {
        volumes: transformedVolumes as unknown as Volume[],
        totalVolumes: transformedVolumes.length,
        totalChapters: result.data["chapters"] ?? result.data.totalChapters ?? 0
      }
    }),
    totalVolumes: transformedVolumes.length,
    totalChapters: result.data?.["chapters"] ?? result.data?.totalChapters ?? 0
  }));

  // Also update selectedSourcesMetadata with Fandom data (including gallery)
  const fandomGallery = result.data.gallery ?? [];
  logger.debug('[parseFandomUrl] Updating selectedSourcesMetadata with gallery', {
    galleryLength: fandomGallery.length,
    galleryPreview: fandomGallery.slice(0, 3)
  });

  setSelectedSourcesMetadata((prev: Record<string, ProviderMetadata>) => {
    // Build metadata object incrementally to respect exactOptionalPropertyTypes
    const fandomMetadata: Record<string, unknown> = {
      ...(prev["fandom"] ?? {}),
      volumes: transformedVolumes.length,
      chapters: result.data?.["chapters"] ?? result.data?.totalChapters ?? 0,
      volumeData: transformedVolumes as unknown as Volume[],
      gallery: fandomGallery,  // Store gallery in metadata so it persists to step 3
      source: 'fandom',
      url: urlToParse,
      wikiUrl: urlToParse,
      hasCoverImages: transformedVolumes.some((v: unknown) => {
        const vObj = v as Record<string, unknown>;
        return !!vObj["coverImageUrl"];
      }),
      hasChapterList: transformedVolumes.some((v: unknown) => {
        const vObj = v as Record<string, unknown>;
        const chapters = vObj["chapters"];
        return Array.isArray(chapters) && chapters.length > 0;
      })
    };

    // Add metadata from fetchFandomMutation (authors, idMal, description, genres, dates)
    if (fetchData) {
      if (fetchData.authors && fetchData.authors.length > 0) {
        fandomMetadata['authors'] = fetchData.authors;
      }
      if (fetchData.myAnimeListId !== undefined) {
        fandomMetadata['idMal'] = fetchData.myAnimeListId;
      }
      if (fetchData.description) {
        fandomMetadata['description'] = fetchData.description;
      }
      if (fetchData.genres && fetchData.genres.length > 0) {
        fandomMetadata['genres'] = fetchData.genres;
      }
      if (fetchData.startDate) {
        fandomMetadata['startDate'] = fetchData.startDate;
      }
      if (fetchData.endDate) {
        fandomMetadata['endDate'] = fetchData.endDate;
      }
      if (fetchData.status) {
        fandomMetadata['status'] = fetchData.status;
      }
    }

    logger.info('[parseFandomUrl] Final fandom metadata:', {
      authors: fandomMetadata['authors'],
      idMal: fandomMetadata['idMal'],
      hasDescription: !!fandomMetadata['description'],
      genres: fandomMetadata['genres'],
    });

    return {
      ...prev,
      fandom: fandomMetadata as unknown as ProviderMetadata
    };
  });

  // All chapter details were fetched in bulk - no need for progressive fetching
  const allChapters = transformedVolumes.flatMap((vol: unknown) => {
    const volObj = vol as Record<string, unknown>;
    const chapters = volObj["chapters"];
    return Array.isArray(chapters) ? chapters as unknown[] : [];
  });
  logger.info(`[Bulk Fetch Complete] Loaded ${allChapters.length} chapters with details`);

  logger.info('[parseFandomUrl] Set volumesData and metadata:', {
    volumeCount: transformedVolumes.length,
    totalChapters: result.data["chapters"],
    firstVolumeStructure: transformedVolumes[0],
    volumesDataAfterSet: {
      hasVolumes: !!volumesData.volumes,
      volumesLength: volumesData.volumes.length,
      hasFandom: !!volumesData.fandom,
      fandomVolumesLength: volumesData.fandom?.volumes.length
    }
  });

  // Extract gallery images from result and update media gallery
  if (setMediaGallery && result.data.gallery && result.data.gallery.length > 0) {
    logger.info('[parseFandomUrl] Extracting gallery images:', {
      galleryCount: result.data.gallery.length,
      firstImages: result.data.gallery.slice(0, 3)
    });

    // Also extract volume covers to include in media gallery
    const volumeCovers = transformedVolumes
      .map((vol: unknown) => {
        const volObj = vol as Record<string, unknown>;
        return volObj["coverImageUrl"] as string;
      })
      .filter((url): url is string => typeof url === 'string' && url.length > 0);

    setMediaGallery({
      covers: [],
      banners: [],
      gallery: result.data.gallery,
      volumeCovers,
      chapterCovers: []
    });
  } else if (setMediaGallery) {
    // Even if no gallery, extract volume covers
    const volumeCovers = transformedVolumes
      .map((vol: unknown) => {
        const volObj = vol as Record<string, unknown>;
        return volObj["coverImageUrl"] as string;
      })
      .filter((url): url is string => typeof url === 'string' && url.length > 0);

    if (volumeCovers.length > 0) {
      logger.info('[parseFandomUrl] No gallery but extracting volume covers:', {
        volumeCoversCount: volumeCovers.length
      });
      setMediaGallery({
        covers: [],
        banners: [],
        gallery: [],
        volumeCovers,
        chapterCovers: []
      });
    }
  }

  notify({ severity: 'SUCCESS', title: 'Volume Data Extracted', message: `Successfully extracted ${transformedVolumes.length} volumes with ${result.data["chapters"] ?? 0} chapters` });
}
