/**
 * Phase: AI Agent Data Application
 *
 * Applies ChapterEnrichmentMaps produced by the AI agent to the database.
 * Reuses existing volume helper functions for consistency with the adaptive parser path.
 *
 * Updates existing chapters with titles, covers, descriptions, and volume assignments.
 * Creates missing volumes and assigns chapters to volume ranges.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { assignVolumesFromRanges } from './fandom-volume-helpers/assignment-core';
import { updateVolumeDescriptions } from './fandom-volume-helpers/descriptions';
import { isUnreliableVolumeMap } from './fandom-volume-helpers/range-builders';
import { updateVolumeRanges } from './fandom-volume-helpers/range-updates';
import { createMissingVolumes } from './fandom-volume-helpers/volume-creation';

import type { ChapterEnrichmentMaps, EnrichmentProgress } from './types';

const log = logger.child('AgentDbApplication');

/**
 * Apply AI agent enrichment maps to the database.
 *
 * This mirrors the Fandom/Wikipedia application logic:
 * 1. Update existing chapters with enriched data (titles, covers, descriptions)
 * 2. Create missing volume records
 * 3. Update volume descriptions
 * 4. Update volume ranges and assign chapters to volumes
 */
export async function applyAgentEnrichmentMaps(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
  onProgress?: EnrichmentProgress,
): Promise<void> {
  const titleCount = Object.keys(maps.chapterTitleMap).length;
  const volCount = Object.keys(maps.chapterVolumeMap).length;
  await onProgress?.('applying', `Writing ${titleCount} titles and ${volCount} volume assignments to database...`);

  // Validate agent volume data before applying — reject scrambled/overlapping maps
  const hasVolumeData = Object.keys(maps.chapterVolumeMap).length > 0;
  const hasBadAgentVolumes = hasVolumeData && isUnreliableVolumeMap(maps.chapterVolumeMap);

  if (hasBadAgentVolumes) {
    log.warn('AI agent volume data is unreliable (scrambled/overlapping) — skipping per-chapter volume assignments', { mangaId });
  }

  // 1. Update existing chapters with enriched data (skip volume assignments if unreliable)
  const chapterUpdates = await updateExistingChaptersFromAgent(mangaId, maps, hasBadAgentVolumes);

  // 2. Handle volume data (create missing, update ranges/descriptions, assign)
  const hasVolumeDescriptions = Object.keys(maps.volumeDescriptionMap).length > 0;

  if (hasVolumeData && !hasBadAgentVolumes) {
    await createMissingVolumes(mangaId, maps.chapterVolumeMap);
    await backfillVolumeCoverFromProviders(mangaId);
    await updateVolumeRanges(mangaId, maps.chapterVolumeMap);
    await assignVolumesFromRanges(mangaId);
  }

  if (hasVolumeDescriptions) {
    await updateVolumeDescriptionsFromAgent(mangaId, maps.volumeDescriptionMap);
  }

  log.info('AI agent enrichment applied to database', {
    mangaId,
    chaptersUpdated: chapterUpdates,
    volumeDataApplied: hasVolumeData,
    volumeDescriptionsApplied: hasVolumeDescriptions,
  });
}

/**
 * Update existing chapters with agent-produced enrichment data.
 * Only updates chapters that already exist in the DB (never creates new ones).
 */
async function updateExistingChaptersFromAgent(
  mangaId: number,
  maps: ChapterEnrichmentMaps,
  skipVolumeAssignment = false,
): Promise<number> {
  const existingChapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { chapterNumber: true },
  });
  const existingNumbers = new Set(existingChapters.map(c => c.chapterNumber));

  // Collect all chapter numbers referenced across all maps
  const allChapterNums = new Set([
    ...Object.keys(maps.chapterTitleMap).map(Number),
    ...Object.keys(maps.chapterVolumeMap).map(Number),
    ...Object.keys(maps.chapterCoverMap).map(Number),
    ...Object.keys(maps.chapterDescriptionMap).map(Number),
    ...Object.keys(maps.chapterPagesMap).map(Number),
    ...Object.keys(maps.chapterReleaseDateMap).map(Number),
  ]);

  let updatedCount = 0;
  for (const chapterNum of allChapterNums) {
    if (!existingNumbers.has(chapterNum)) continue;

    const updateData = buildAgentChapterUpdate(chapterNum, maps, skipVolumeAssignment);
    if (Object.keys(updateData).length === 0) continue;

    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for chapter enrichment
    const result = await prisma.chapter.updateMany({
      where: { mangaId, chapterNumber: chapterNum },
      data: updateData,
    });
    if (result.count > 0) updatedCount++;
  }

  if (updatedCount > 0) {
    log.info(`AI agent updated ${updatedCount} existing chapters`, { mangaId });
  }

  return updatedCount;
}

/**
 * Build Prisma update payload for a single chapter from agent maps.
 * Includes all map types (titles, covers, descriptions, pages, dates, volumes).
 */
function buildAgentChapterUpdate(
  chapterNum: number,
  maps: ChapterEnrichmentMaps,
  skipVolumeAssignment = false,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  const title = maps.chapterTitleMap[chapterNum];
  if (title) data['title'] = title;

  const volume = maps.chapterVolumeMap[chapterNum];
  if (volume !== undefined && !skipVolumeAssignment) data['volume'] = volume;

  // Apply covers and descriptions from deterministic merge (real source URLs).
  // The AI model chunks only output titles+volumes, so these maps will only have
  // data from the deterministic merge or source data — not AI hallucinations.
  const cover = maps.chapterCoverMap[chapterNum];
  if (cover) data['coverImage'] = cover;

  const description = maps.chapterDescriptionMap[chapterNum];
  if (description) data['description'] = description;

  const pages = maps.chapterPagesMap[chapterNum];
  if (pages) data['pages'] = pages;

  const releaseDate = maps.chapterReleaseDateMap[chapterNum];
  if (releaseDate) data['releaseDate'] = new Date(releaseDate);

  return data;
}

/**
 * Backfill cover images for volumes without covers from provider metadata.
 * Phase 2 persists ComicVine volumes with covers, but if the AI agent creates
 * extra volumes afterward, those miss the covers. This fills the gap.
 */
async function backfillVolumeCoverFromProviders(mangaId: number): Promise<void> {
  const volumesWithoutCovers = await prisma.volume.findMany({
    where: { mangaId, OR: [{ coverImage: null }, { coverImage: '' }] },
    select: { id: true, number: true },
  });

  if (volumesWithoutCovers.length === 0) return;

  // Read provider metadata for cover URLs
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  if (!manga?.providerMetadata) return;

  const meta = manga.providerMetadata as Record<string, unknown>;
  const coverMap = extractProviderVolumeCoverMap(meta);
  if (coverMap.size === 0) return;

  let filled = 0;
  for (const vol of volumesWithoutCovers) {
    const coverUrl = coverMap.get(vol.number);
    if (!coverUrl) continue;

    // eslint-disable-next-line no-await-in-loop -- Sequential DB updates for volume covers
    await prisma.volume.update({
      where: { id: vol.id },
      data: { coverImage: coverUrl },
    });
    filled++;
  }

  if (filled > 0) {
    log.info(`Backfilled ${filled} volume covers from provider metadata`, { mangaId });
  }
}

/** Extract volume number → cover URL map from provider metadata */
function extractProviderVolumeCoverMap(meta: Record<string, unknown>): Map<number, string> {
  const coverMap = new Map<number, string>();

  // Check ComicVine volumeData
  const comicvine = meta['comicvine'] as Record<string, unknown> | undefined;
  const volumeData = comicvine?.['volumeData'];
  if (Array.isArray(volumeData)) {
    for (const vol of volumeData) {
      if (!vol || typeof vol !== 'object') continue;
      const v = vol as Record<string, unknown>;
      const num = typeof v['number'] === 'number' ? v['number']
        : typeof v['volumeNumber'] === 'number' ? v['volumeNumber'] : null;
      const cover = typeof v['coverImage'] === 'string' ? v['coverImage']
        : typeof v['coverImageUrl'] === 'string' ? v['coverImageUrl'] : null;
      if (num !== null && cover) coverMap.set(num, cover);
    }
  }

  return coverMap;
}

/**
 * Update volume descriptions from agent data.
 * Wrapper around the existing helper to add agent-specific logging.
 */
async function updateVolumeDescriptionsFromAgent(
  mangaId: number,
  volumeDescriptionMap: Record<number, string>,
): Promise<void> {
  await updateVolumeDescriptions(mangaId, volumeDescriptionMap);
}
