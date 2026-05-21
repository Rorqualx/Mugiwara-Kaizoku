/**
 * Chapter Rebuilder
 *
 * Rebuilds chapters from provider data during metadata refresh.
 * PHASE 4 of refreshMetaData operation.
 * Extracted from: metadataOperations.ts (lines 1242-1402)
 */

import { createChaptersFromVolumes } from '@/server/trpc/routers/manga/chapterCreationHelpers';
import { logger } from '@/utils/logger';

import { safeGet, isRecord, safeGetString, type PrismaContext } from '../utils';

// ============================================================================
// Types
// ============================================================================

/** Chapter enrichment data from Fandom */
export type ChapterEnrichmentMap = Record<number, {
  summary?: string;
  coverImage?: string;
  pages?: number;
  releaseDate?: string;
  url?: string;
  alternativeTitles?: string[];
}>;

// ============================================================================
// Helper Functions
// ============================================================================

/** Extract volume data from ComicVine provider */
function extractComicVineVolumes(
  providerMetadata: Record<string, unknown>,
  rawData: unknown
): { volumes: unknown[]; source: string } {
  const comicvineData = safeGet(providerMetadata, 'comicvine') ?? safeGet(providerMetadata, 'COMICVINE');
  const volumeData = isRecord(comicvineData)
    ? (safeGet(comicvineData, 'volumeData') ?? safeGet(rawData, 'volumes'))
    : safeGet(rawData, 'volumes');

  if (volumeData && Array.isArray(volumeData) && volumeData.length > 0) {
    logger.info(`[rebuildChapters] Using ComicVine (${volumeData.length} volumes)`);
    return { volumes: volumeData, source: 'ComicVine volumes' };
  }

  logger.warn(`[rebuildChapters] ComicVine selected but no volumeData, using fallback`);
  const rawVolumes = safeGet(rawData, 'volumes');
  return { volumes: Array.isArray(rawVolumes) ? rawVolumes : [], source: 'rawProviderData (fallback)' };
}

/** Extract volume data from Fandom provider */
function extractFandomVolumes(
  providerMetadata: Record<string, unknown>,
  rawData: unknown
): { volumes: unknown[]; source: string } {
  const fandomData = safeGet(providerMetadata, 'fandom') ?? safeGet(providerMetadata, 'FANDOM');
  const volumeData = isRecord(fandomData)
    ? (safeGet(fandomData, 'volumeData') ?? safeGet(fandomData, 'volumes'))
    : undefined;

  if (volumeData && Array.isArray(volumeData) && volumeData.length > 0) {
    logger.info(`[rebuildChapters] Using Fandom (${volumeData.length} volumes)`);
    return { volumes: volumeData, source: 'Fandom volumes' };
  }

  logger.warn(`[rebuildChapters] Fandom selected but no volumeData, using fallback`);
  const rawVolumes = safeGet(rawData, 'volumes');
  return { volumes: Array.isArray(rawVolumes) ? rawVolumes : [], source: 'rawProviderData (fallback)' };
}

/** Extract chapter enrichment from Fandom data */
function extractChapterEnrichment(
  providerMetadata: Record<string, unknown>
): ChapterEnrichmentMap | undefined {
  const fandomData = (safeGet(providerMetadata, 'fandom') ??
    safeGet(providerMetadata, 'FANDOM')) as Record<string, unknown> | undefined;
  if (!fandomData) return undefined;

  const enrichmentRaw = fandomData['chapterEnrichment'];
  if (enrichmentRaw && typeof enrichmentRaw === 'object') {
    logger.info(`[rebuildChapters] Using Fandom enrichment (${Object.keys(enrichmentRaw).length} chapters)`);
    return enrichmentRaw as ChapterEnrichmentMap;
  }

  logger.warn(`[rebuildChapters] Fandom data exists but no chapterEnrichment found`);
  return undefined;
}

// ============================================================================
// Auto-Detection
// ============================================================================

/**
 * Auto-detect which provider actually has volume data available.
 * Checks comicvine first, then fandom, to avoid relying on a hardcoded default.
 */
function detectAvailableVolumeSource(
  providerMetadata: Record<string, unknown>,
  rawProviderData: unknown
): string {
  // Check comicvine
  const cv = safeGet(providerMetadata, 'comicvine') ?? safeGet(providerMetadata, 'COMICVINE');
  if (isRecord(cv)) {
    const cvVolumes = safeGet(cv, 'volumeData');
    if (Array.isArray(cvVolumes) && cvVolumes.length > 0) return 'comicvine';
  }

  // Check fandom
  const fandom = safeGet(providerMetadata, 'fandom') ?? safeGet(providerMetadata, 'FANDOM');
  if (isRecord(fandom)) {
    const fandomVolumes = safeGet(fandom, 'volumeData') ?? safeGet(fandom, 'volumes');
    if (Array.isArray(fandomVolumes) && fandomVolumes.length > 0) return 'fandom';
  }

  // Check raw data
  const rawVolumes = safeGet(rawProviderData, 'volumes');
  if (Array.isArray(rawVolumes) && rawVolumes.length > 0) return 'raw';

  return 'comicvine'; // ultimate fallback
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Rebuild chapters from provider data
 *
 * Determines volume source from import profile, extracts volume data,
 * applies optional Fandom enrichment, and recreates all chapters.
 *
 * IMPORTANT: Validates that replacement data exists BEFORE deleting existing chapters.
 */
export async function rebuildChaptersFromProviders(
  ctx: PrismaContext,
  mangaId: number,
  providerMetadata: Record<string, unknown>,
  rawProviderData: unknown
): Promise<void> {
  let sourceUsed = 'unknown';

  try {
    logger.info(`[rebuildChapters] Rebuilding chapters for manga ${mangaId}`);

    // Determine volume source from import profile, with auto-detection fallback
    const importProfile = safeGet(providerMetadata, 'importProfile');
    let volumeSource: string;

    if (isRecord(importProfile)) {
      const profileSource = safeGetString(importProfile, 'volumeSource', '');
      // If the import profile has a volume source, use it; otherwise auto-detect
      volumeSource = profileSource || detectAvailableVolumeSource(providerMetadata, rawProviderData);
    } else {
      volumeSource = detectAvailableVolumeSource(providerMetadata, rawProviderData);
    }

    // Get volume data from appropriate provider
    let volumesWithChapters: unknown[];
    const normalizedSource = volumeSource.toLowerCase();

    if (normalizedSource === 'comicvine') {
      const result = extractComicVineVolumes(providerMetadata, rawProviderData);
      volumesWithChapters = result.volumes;
      sourceUsed = result.source;
    } else if (normalizedSource === 'fandom') {
      const result = extractFandomVolumes(providerMetadata, rawProviderData);
      volumesWithChapters = result.volumes;
      sourceUsed = result.source;
    } else if (normalizedSource === 'raw') {
      const rawVolumes = safeGet(rawProviderData, 'volumes');
      volumesWithChapters = Array.isArray(rawVolumes) ? rawVolumes : [];
      sourceUsed = 'rawProviderData (auto-detected)';
    } else {
      logger.info(`[rebuildChapters] Unknown volume source: ${volumeSource}, using rawProviderData`);
      const rawVolumes = safeGet(rawProviderData, 'volumes');
      volumesWithChapters = Array.isArray(rawVolumes) ? rawVolumes : [];
      sourceUsed = 'rawProviderData (default)';
    }

    // Get chapter enrichment from Fandom
    const chapterEnrichmentMap = extractChapterEnrichment(providerMetadata);

    // CRITICAL: Check if we have replacement data BEFORE deleting existing chapters.
    // Without this guard, chapters would be permanently lost if no volume data exists.
    if (!volumesWithChapters.length) {
      logger.info(`[rebuildChapters] No volume data for ${sourceUsed}, skipping (existing chapters preserved)`);
      return;
    }

    logger.info(`[rebuildChapters] Found ${volumesWithChapters.length} volumes from ${sourceUsed}`);

    // Delete existing chapters only after confirming replacement data exists
    const deleted = await ctx.prisma.chapter.deleteMany({ where: { mangaId } });
    logger.info(`[rebuildChapters] Deleted ${deleted.count} existing chapters`);

    // Create chapters from volumes
    await createChaptersFromVolumes(ctx, mangaId, volumesWithChapters, chapterEnrichmentMap);

    const enrichmentNote = chapterEnrichmentMap ? ' with Fandom enrichment' : '';
    logger.info(`[rebuildChapters] Successfully recreated chapters from ${sourceUsed}${enrichmentNote}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error(`[rebuildChapters] Error: ${message}`, { errorStack: stack, chapterSource: sourceUsed });
    throw error;
  }
}
