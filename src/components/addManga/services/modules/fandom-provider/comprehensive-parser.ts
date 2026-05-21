/**
 * Comprehensive parsing with parseFandomUrlMutation
 *
 * Uses a two-phase approach for fast initial loading:
 * 1. Fast fetch (no chapter covers) - returns immediately with structure data
 * 2. Background fetch (with chapter covers) - updates UI when covers arrive
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { isSuccess, type AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { buildMetadataFromParsedData } from './metadata-from-parsed';

import type { FandomMutations } from './types';

/**
 * Callback for when chapter covers are loaded in background
 */
export type OnChapterCoversLoaded = (metadata: ProviderMetadata) => void;

/**
 * Parse the mutation response and build metadata
 */
function parseResponseToMetadata(
  response: AsyncResult<unknown, unknown>,
  result: Record<string, unknown>,
  url: string
): ProviderMetadata | undefined {
  if (!isSuccess(response)) {
    return undefined;
  }

  const data = response.data as Record<string, unknown>;
  return buildMetadataFromParsedData(data, result, url);
}

/**
 * Try comprehensive parsing using parseFandomUrlMutation
 *
 * This function uses a two-phase approach:
 * 1. First call with fetchChapterCovers=false for fast initial data
 * 2. Background call with fetchChapterCovers=true, calling onCoversLoaded when done
 *
 * @param url - Fandom wiki URL to parse
 * @param mutations - tRPC mutations object
 * @param result - Search result data
 * @param onCoversLoaded - Optional callback when chapter covers finish loading
 */
export async function tryComprehensiveParsing(
  url: string,
  mutations: FandomMutations,
  result: Record<string, unknown>,
  onCoversLoaded?: OnChapterCoversLoaded
): Promise<ProviderMetadata | undefined> {
  logger.info('[Fandom] Using comprehensive parsing (two-phase) for:', url);

  if (!mutations.parseFandomUrlMutation) {
    logger.warn('[Fandom] parseFandomUrlMutation not available');
    return undefined;
  }

  // Phase 1: Fast fetch WITHOUT chapter covers
  logger.info('[Fandom] Phase 1: Fast fetch (no covers)');
  const fastResponse = await mutations.parseFandomUrlMutation.mutateAsync({
    url,
    forceRefresh: false,
    fetchChapterCovers: false,
    maxChaptersToFetch: 0
  }) as AsyncResult<unknown, unknown>;

  const fastMetadata = parseResponseToMetadata(fastResponse, result, url);

  if (!fastMetadata) {
    logger.info('[Fandom] Fast fetch failed, no metadata returned');
    return undefined;
  }

  logger.info('[Fandom] Phase 1 complete - got structure data:', {
    volumes: fastMetadata.volumes,
    hasVolumeData: Array.isArray(fastMetadata.volumeData) && fastMetadata.volumeData.length > 0
  });

  // Phase 2: Background fetch WITH chapter covers (fire and forget)
  // This runs in parallel and calls the callback when done
  if (onCoversLoaded) {
    logger.info('[Fandom] Phase 2: Starting background cover fetch', { url });

    // Capture mutation reference for async closure (safe - already validated above)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const parseMutation = mutations.parseFandomUrlMutation!;

    // Don't await - let it run in background
    void (async (): Promise<void> => {
      try {
        const coverResponse = await parseMutation.mutateAsync({
          url,
          forceRefresh: false,
          fetchChapterCovers: true,
          maxChaptersToFetch: 0
        }) as AsyncResult<unknown, unknown>;

        const coverMetadata = parseResponseToMetadata(coverResponse, result, url);

        if (coverMetadata) {
          // Debug: Log what chapter covers we got
          logger.info('[Fandom] Phase 2 complete - calling onCoversLoaded');
          const volumeData = coverMetadata.volumeData;
          let chapterCoversCount = 0;
          if (Array.isArray(volumeData)) {
            volumeData.forEach((vol: unknown) => {
              const volRecord = vol as Record<string, unknown>;
              const chapters = volRecord['chapters'];
              if (Array.isArray(chapters)) {
                chapters.forEach((ch: unknown) => {
                  const chRecord = ch as Record<string, unknown>;
                  if (chRecord['coverImageUrl']) {
                    chapterCoversCount++;
                    logger.debug('[Fandom] Phase 2 found chapter cover:', {
                      chapter: chRecord['chapterNumber'] ?? chRecord['title'],
                      coverUrl: String(chRecord['coverImageUrl']).substring(0, 80)
                    });
                  }
                });
              }
            });
          }
          logger.info('[Fandom] Phase 2 complete - chapter covers loaded', {
            chapterCoversCount,
            volumeDataLength: Array.isArray(volumeData) ? volumeData.length : 0
          });
          onCoversLoaded(coverMetadata);
        } else {
          logger.warn('[Fandom] Phase 2 failed - no cover metadata');
        }
      } catch (error) {
        logger.error('[Fandom] Phase 2 error fetching covers:', error);
      }
    })();
  }

  // Return fast metadata immediately
  return fastMetadata;
}
