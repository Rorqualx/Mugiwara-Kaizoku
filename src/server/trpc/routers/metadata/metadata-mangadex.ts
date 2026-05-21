/**
 * Metadata MangaDex Router
 *
 * Handles MangaDex-specific volume and chapter fetching operations.
 * Uses the /manga/{id}/aggregate endpoint for volume/chapter data.
 *
 * @module server/trpc/routers/metadata/metadata-mangadex
 */

import { z } from 'zod';

import { mangadexClient } from '@/server/services/mangadex/client';
import type {
  MangaDexAggregateResponse,
  MangaDexAggregateVolume,
  TransformedMangaDexVolume
} from '@/server/services/mangadex/types';
import { publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

/** Result type for fetchMangaDexVolumes mutation */
interface FetchMangaDexVolumesResult {
  provider: 'mangadex';
  volumes: TransformedMangaDexVolume[];
  totalVolumes: number;
  totalChapters: number;
  volumeDetails: TransformedMangaDexVolume[];
}

/** Input for volume fetching */
interface FetchVolumesInput {
  mangadexId?: string | undefined;
  url?: string | undefined;
  language?: string | undefined;
  mangaTitle?: string | undefined;
}

// ============================================================================
// ID Resolution Helpers
// ============================================================================

/** Extract MangaDex UUID from a URL */
function extractMangaDexIdFromUrl(url: string): string | null {
  const match = url.match(/mangadex\.org\/(?:title|manga)\/([a-f0-9-]{36})/i);
  return match?.[1] ?? null;
}

/** Validate if a string is a valid UUID format */
function isValidUUID(id: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
}

/** Resolve manga ID from input (direct ID or extracted from URL) */
function resolveMangaId(input: FetchVolumesInput): string | null {
  if (input.mangadexId) return input.mangadexId;
  if (input.url) return extractMangaDexIdFromUrl(input.url);
  return null;
}

// ============================================================================
// Number Parsing Helpers
// ============================================================================

/** Parse volume number from string, handling "none" for unnumbered volumes */
function parseVolumeNumber(volumeStr: string): number {
  if (volumeStr === 'none' || volumeStr === '') return 0;
  const parsed = parseFloat(volumeStr);
  return isNaN(parsed) ? 0 : parsed;
}

/** Parse chapter number from string, handling "none" for unnumbered chapters */
function parseChapterNumber(chapterStr: string): number {
  if (chapterStr === 'none' || chapterStr === '') return 0;
  const parsed = parseFloat(chapterStr);
  return isNaN(parsed) ? 0 : parsed;
}

// ============================================================================
// Transformation Helpers
// ============================================================================

/** Transform chapters from aggregate volume data */
function transformChapters(
  volumeData: MangaDexAggregateVolume
): TransformedMangaDexVolume['chapters'] {
  const chapterKeys = Object.keys(volumeData.chapters).sort((a, b) => {
    return parseChapterNumber(a) - parseChapterNumber(b);
  });

  return chapterKeys
    .map(chapterKey => {
      const chapterData = volumeData.chapters[chapterKey];
      if (!chapterData) return null;
      // Skip unavailable chapters (removed or restricted on MangaDex)
      if (chapterData.isUnavailable) return null;
      return {
        chapterNumber: parseChapterNumber(chapterKey),
        id: chapterData.id,
        pages: chapterData.count
      };
    })
    .filter((ch): ch is NonNullable<typeof ch> => ch !== null);
}

/** Transform a single volume from aggregate response */
function transformVolume(
  volumeKey: string,
  volumeData: MangaDexAggregateVolume,
  mangaTitle?: string
): TransformedMangaDexVolume {
  const volumeNumber = parseVolumeNumber(volumeKey);
  const volumeTitle = volumeNumber === 0
    ? `${mangaTitle ?? 'Manga'} (No Volume)`
    : `Volume ${volumeNumber}`;
  const chapters = transformChapters(volumeData);

  return { volumeNumber, number: volumeNumber, title: volumeTitle, chapterCount: chapters.length, chapters };
}

/** Transform MangaDex aggregate response to internal volume format */
function transformAggregateResponse(
  response: MangaDexAggregateResponse,
  mangaTitle?: string
): TransformedMangaDexVolume[] {
  // Guard against empty volumes (API may return incomplete responses at runtime)
  if (Object.keys(response.volumes).length === 0) {
    logger.warn('MangaDex aggregate response has no volumes data');
    return [];
  }

  const volumeKeys = Object.keys(response.volumes).sort((a, b) => {
    return parseVolumeNumber(a) - parseVolumeNumber(b);
  });

  return volumeKeys
    .map(volumeKey => {
      const volumeData = response.volumes[volumeKey];
      return volumeData ? transformVolume(volumeKey, volumeData, mangaTitle) : null;
    })
    .filter((vol): vol is TransformedMangaDexVolume => vol !== null);
}

/** Calculate total chapter count across all volumes */
function calculateTotalChapters(volumes: TransformedMangaDexVolume[]): number {
  return volumes.reduce((total, vol) => total + vol.chapterCount, 0);
}

// ============================================================================
// Main Handler
// ============================================================================

/** Handle the volume fetching logic */
async function handleFetchMangaDexVolumes(
  input: FetchVolumesInput
): Promise<AsyncResult<FetchMangaDexVolumesResult, Error>> {
  const resolvedId = resolveMangaId(input);

  if (!resolvedId) {
    return createErrorResult(new Error('MangaDex ID or URL is required'));
  }

  if (!isValidUUID(resolvedId)) {
    return createErrorResult(new Error(`Invalid MangaDex UUID format: ${resolvedId}`));
  }

  logger.info('Fetching MangaDex volumes', { mangadexId: resolvedId, language: input.language ?? 'en' });

  const languages = input.language ? [input.language] : ['en'];
  const aggregateResponse = await mangadexClient.getMangaAggregate(resolvedId, languages);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime API response guard
  if (aggregateResponse.result !== 'ok') {
    return createErrorResult(new Error('MangaDex API returned error status'));
  }

  // Guard against missing volumes in response (can happen with restricted/deleted manga)
  // Runtime API responses may not match TypeScript types exactly
  if (Object.keys(aggregateResponse.volumes as Record<string, unknown>).length === 0) {
    logger.warn('MangaDex aggregate response has empty volumes', { mangadexId: resolvedId });
    return createSuccessResult({
      provider: 'mangadex' as const,
      volumes: [],
      totalVolumes: 0,
      totalChapters: 0,
      volumeDetails: []
    });
  }

  const volumes = transformAggregateResponse(aggregateResponse, input.mangaTitle);
  const totalChapters = calculateTotalChapters(volumes);

  logger.info('MangaDex volumes fetched successfully', {
    mangadexId: resolvedId,
    totalVolumes: volumes.length,
    totalChapters
  });

  return createSuccessResult({
    provider: 'mangadex' as const,
    volumes,
    totalVolumes: volumes.length,
    totalChapters,
    volumeDetails: volumes
  });
}

// ============================================================================
// Router
// ============================================================================

export const metadataMangadexRouter = router({
  /**
   * Fetch volume and chapter data from MangaDex
   *
   * Uses the aggregate endpoint for efficient volume/chapter listing.
   * Returns data in a format compatible with other providers.
   */
  fetchMangaDexVolumes: publicProcedure
    .input(
      z.object({
        mangadexId: z.string().optional(),
        url: z.string().optional(),
        language: z.string().optional(),
        mangaTitle: z.string().optional()
      })
    )
    .mutation(async ({ input }): Promise<AsyncResult<FetchMangaDexVolumesResult, Error>> => {
      try {
        return await handleFetchMangaDexVolumes(input);
      } catch (error: unknown) {
        logger.error('Error fetching MangaDex volumes', {
          error: error instanceof Error ? error.message : String(error)
        });
        return createErrorResult(
          error instanceof Error ? error : new Error(`Failed to fetch MangaDex volumes: ${String(error)}`)
        );
      }
    })
});
