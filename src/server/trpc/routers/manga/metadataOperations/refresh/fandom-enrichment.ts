/**
 * Fandom Chapter Enrichment
 *
 * PHASE 1 of refreshMetaData operation - enriches chapter metadata
 * from Fandom wiki if specified in import profile.
 *
 * Extracted from: metadataOperations.ts (lines 648-671)
 */

import { metadataMergerService } from '@/server/services/metadataMerger';
import { logger } from '@/utils/logger';

import { isRecord, handleError } from '../utils';

// ============================================================================
// Types
// ============================================================================

export interface FandomEnrichmentResult {
  enriched: boolean;
  skipped: boolean;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if Fandom should be used for enrichment based on import profile
 *
 * @param importProfile - The import profile from provider metadata
 * @returns True if Fandom enrichment should be performed
 */
function shouldEnrichFromFandom(importProfile: unknown): boolean {
  if (!importProfile || !isRecord(importProfile)) {
    return false;
  }

  const chapterSource = importProfile['chapterSource'];
  const volumeSource = importProfile['volumeSource'];
  const primarySource = importProfile['primarySource'];

  return (
    chapterSource === 'fandom' ||
    chapterSource === 'FANDOM' ||
    volumeSource === 'fandom' ||
    volumeSource === 'FANDOM' ||
    primarySource === 'fandom' ||
    primarySource === 'FANDOM'
  );
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Enrich chapter metadata from Fandom wiki
 *
 * PHASE 1 of metadata refresh - checks import profile and enriches
 * chapter metadata from Fandom if it was specified as a source or
 * if fandom appears in the set of unique providers selected by the user.
 *
 * @param mangaId - Database manga ID
 * @param importProfile - Import profile from provider metadata
 * @param uniqueProviders - Set of unique providers selected during merge
 * @returns Result indicating whether enrichment was performed
 */
export async function enrichFromFandom(
  mangaId: number,
  importProfile: unknown,
  uniqueProviders: Set<string>
): Promise<FandomEnrichmentResult> {
  // Check if Fandom is specified in import profile OR was selected for any field
  const fandomInProviders = uniqueProviders.has('fandom') || uniqueProviders.has('FANDOM');
  if (!shouldEnrichFromFandom(importProfile) && !fandomInProviders) {
    logger.info(`[PHASE 1] Skipping Fandom enrichment - not in import profile or selected providers`);
    return { enriched: false, skipped: true };
  }

  try {
    logger.info(`[PHASE 1] Enriching chapter metadata from Fandom (specified in import profile)`);
    await metadataMergerService.enrichChapterMetadataFromFandom(mangaId);
    logger.info(`Enriched chapter metadata from Fandom for manga ID ${mangaId}`);
    return { enriched: true, skipped: false };
  } catch (enrichError: unknown) {
    const errorMessage = handleError(enrichError).message;
    logger.error(
      `Error enriching chapter metadata from Fandom for manga ID ${mangaId}: ${errorMessage}`
    );
    return { enriched: false, skipped: false, error: errorMessage };
  }
}
