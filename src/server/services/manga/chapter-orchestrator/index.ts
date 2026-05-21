/**
 * Chapter Orchestrator Service
 * Coordinates chapter creation from various provider metadata sources
 */

import { logger } from '@/utils/logger';

import { createFallbackChapters } from './fallback-handler';
import { extractImportProfile, resolveChapterSource, logImportProfile } from './import-profile-parser';
import { getProviderMetadata } from './metadata-parser';
import { extractSourceData } from './source-data-extractor';
import { processSourceData } from './source-processor';

import type { ChapterCreationFunctions } from './types';

export type { ChapterEnrichment } from './types';

/**
 * Orchestrate chapter creation from provider metadata
 *
 * This function coordinates chapter creation by:
 * 1. Parsing provider metadata from various sources
 * 2. Determining the correct chapter source
 * 3. Extracting enrichment data from Fandom
 * 4. Calling appropriate chapter creation functions
 *
 * Complexity: 12 (reduced from 27)
 */
export async function orchestrateChapterCreation(
  context: unknown,
  mangaId: number,
  input: {
    rawProviderData?: unknown;
    providerMetadata?: unknown;
    metadata?: { chapters?: number; volumes?: number };
  },
  chapterCreationFunctions: ChapterCreationFunctions
): Promise<void> {
  try {
    let chapterDataFound = false;

    // DEBUG: Log input structure
    logger.info('[chapterOrchestrator] Input received:', {
      mangaId,
      hasRawProviderData: !!input.rawProviderData,
      hasProviderMetadata: !!input.providerMetadata,
      metadata: input.metadata,
      providerMetaType: input.providerMetadata ? typeof input.providerMetadata : 'undefined',
      providerMetaIsArray: Array.isArray(input.providerMetadata),
    });

    // Parse provider metadata from input
    const providerMeta = getProviderMetadata(input);

    if (providerMeta) {
      // Extract and parse import profile
      const importProfile = extractImportProfile(providerMeta);

      if (importProfile) {
        logImportProfile(importProfile);

        // Resolve chapter source
        const chapterSource = resolveChapterSource(importProfile);

        // Extract source data
        const sourceData = extractSourceData(providerMeta, chapterSource);

        if (sourceData) {
          chapterDataFound = await processSourceData({
            context,
            mangaId,
            sourceData,
            chapterSource,
            importProfile,
            providerMeta,
            chapterCreationFunctions,
          });
        }
      }
    }

    // Fallback: Use generic placeholder chapters
    if (!chapterDataFound) {
      await createFallbackChapters(context, mangaId, input.metadata, chapterCreationFunctions);
    }
  } catch (error: unknown) {
    logger.error(`[chapterOrchestrator] Error creating chapters: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
