/**
 * Add Manga Chapter Creation Helpers
 *
 * Helper functions for creating chapters during manga import.
 * Handles provider selection parsing and chapter orchestration.
 *
 * Extracted from crudOperations.ts to reduce complexity.
 */

import { orchestrateChapterCreation, type ChapterEnrichment } from '@/server/services/manga/chapterOrchestrator';
import { logger } from '@/utils/logger';

import {
  createChaptersFromVolumes,
  createFandomChapters,
  createGenericChapters
} from '../chapterCreationHelpers';

// Use unknown for context to avoid complex type union issues
type MangaContext = unknown;

/**
 * Metadata input for chapter creation
 */
interface MetadataInput {
  chapters?: number | null;
  volumes?: number | null;
}

/**
 * Chapter creation data structure
 */
export interface ChapterCreationData {
  rawProviderData?: unknown;
  providerMetadata?: unknown;
  metadata?: { chapters?: number; volumes?: number };
}

/**
 * Parse selectedSourceId to understand mixed provider configuration
 *
 * @param selectedSourceId - The selected source ID string (may be JSON or single provider)
 * @returns Parsed provider configuration object
 */
export function parseSelectedProviders(selectedSourceId: string | null | undefined): Record<string, unknown> {
  if (!selectedSourceId) {
    return {};
  }

  try {
    return JSON.parse(selectedSourceId) as Record<string, unknown>;
  } catch {
    // If not JSON, it's a single provider
    return { default: selectedSourceId };
  }
}

/**
 * Build the chapter creation data object with proper typing
 *
 * @param input - Input containing raw provider data, provider metadata, and metadata
 * @returns Properly typed chapter creation data
 */
export function buildChapterCreationData(input: {
  rawProviderData?: unknown;
  providerMetadata?: unknown;
  metadata?: MetadataInput;
}): ChapterCreationData {
  type ChapterMetadata = { chapters?: number; volumes?: number };
  const metadataObj: ChapterMetadata = {};

  if (input.metadata) {
    if (input.metadata.chapters !== null && input.metadata.chapters !== undefined) {
      metadataObj.chapters = input.metadata.chapters;
    }
    if (input.metadata.volumes !== null && input.metadata.volumes !== undefined) {
      metadataObj.volumes = input.metadata.volumes;
    }
  }

  const chapterCreationData: ChapterCreationData = {
    ...(input.rawProviderData !== undefined ? { rawProviderData: input.rawProviderData } : {}),
    ...(input.providerMetadata !== undefined ? { providerMetadata: input.providerMetadata } : {}),
    ...(Object.keys(metadataObj).length > 0 ? { metadata: metadataObj } : {})
  };

  return chapterCreationData;
}

/**
 * Orchestrate chapter creation using the chapter orchestrator service
 *
 * @param ctx - The tRPC context
 * @param mangaId - The manga ID to create chapters for
 * @param chapterCreationData - The chapter creation data
 */
export async function orchestrateChapters(
  ctx: MangaContext,
  mangaId: number,
  chapterCreationData: ChapterCreationData
): Promise<void> {
  try {
    await orchestrateChapterCreation(ctx, mangaId, chapterCreationData, {
      createChaptersFromVolumes: (context: unknown, id: number, volumes: unknown[], enrichment?: Record<number, ChapterEnrichment>) =>
        createChaptersFromVolumes(context, id, volumes, enrichment),
      createFandomChapters,
      createGenericChapters
    });
  } catch (error: unknown) {
    logger.error(`Error creating chapters: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
