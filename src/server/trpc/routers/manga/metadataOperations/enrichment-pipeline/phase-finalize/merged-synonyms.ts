/**
 * Union alt-titles from every provider that fetched them and persist into
 * Metadata.synonyms (deduped). Sources:
 *   - AniList: title.romaji / english / native + synonyms (via unified.manga.altTitles
 *     once `expandLocalizedTitles` is in the ts-mangadex-adapter)
 *   - MangaUpdates: associated titles via mangaupdatesResult.alternativeTitles
 *   - Kitsu: locale titles via kitsuResult.alternativeTitles + canonicalTitle
 *   - MAL: title via malResult.title (single, but adds the official English/JP form)
 *
 * The bind-loop harness found 14+ cases where the wiki/CV/MD slug for a manga
 * matched a romaji/english variant that AniList exposed but our Metadata.synonyms
 * didn't store (e.g. Erased → "Boku dake ga Inai Machi"). Unioning here gives
 * downstream discovery much better search material.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { UnifiedProviderResults } from '../types';

/** Add every non-empty string from `value` (a string or array of unknowns) to `set`. */
function addStrings(set: Set<string>, value: unknown): void {
  const items = Array.isArray(value) ? value : [value];
  for (const item of items) {
    if (typeof item === 'string' && item.length > 0) set.add(item);
  }
}

/** Union the seed synonyms with every provider's alt-title sources. */
function collectProviderSynonyms(
  seed: string[],
  providerResults: UnifiedProviderResults,
): string[] {
  const collected = new Set<string>(seed);

  const enrichedData = providerResults.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
  const unifiedManga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
  addStrings(collected, unifiedManga?.['altTitles']);

  addStrings(collected, providerResults.mangaupdatesResult?.alternativeTitles);

  const kitsu = providerResults.kitsuResult;
  if (kitsu) {
    addStrings(collected, kitsu.canonicalTitle);
    addStrings(collected, kitsu.alternativeTitles);
  }

  addStrings(collected, providerResults.malResult?.title);

  return [...collected];
}

export async function persistMergedSynonyms(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { metadataId: true, Metadata: { select: { synonyms: true } } },
    });
    if (!manga?.metadataId) return;

    const seed = manga.Metadata?.synonyms ?? [];
    const merged = collectProviderSynonyms(seed, providerResults);
    if (merged.length === seed.length) return;

    await prisma.metadata.update({
      where: { id: manga.metadataId },
      data: { synonyms: merged },
    });
    logger.info(`[enrichmentPipeline] Merged synonyms for manga ${mangaId} (${seed.length} → ${merged.length})`);
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to persist merged synonyms for manga ${mangaId} (non-critical)`, err);
  }
}
