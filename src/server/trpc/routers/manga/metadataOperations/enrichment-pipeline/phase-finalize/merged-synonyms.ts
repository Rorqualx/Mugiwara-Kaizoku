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

import { dedupeSynonyms, sameSynonymList } from '@/lib/metadata/synonym-key';
import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { UnifiedProviderResults } from '../types';

/** Append every string in `value` (a string or array of unknowns) to `list`. */
function addStrings(list: unknown[], value: unknown): void {
  if (Array.isArray(value)) list.push(...(value as unknown[]));
  else list.push(value);
}

/**
 * Union the seed synonyms with every provider's alt-title sources, keyed on
 * `synonymKey` so a spelling that differs only in case, width or separators
 * is one entry. The seed comes first, so a stored spelling is kept.
 */
export function collectProviderSynonyms(
  seed: readonly string[],
  providerResults: UnifiedProviderResults,
): string[] {
  const collected: unknown[] = [...seed];

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

  return dedupeSynonyms(collected);
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
    // Compare content, not length: a list that only loses duplicates, or that
    // loses one and gains one, has changed and must be written.
    if (sameSynonymList(merged, seed)) return;

    await prisma.metadata.update({
      where: { id: manga.metadataId },
      data: { synonyms: merged },
    });
    logger.info(`[enrichmentPipeline] Merged synonyms for manga ${mangaId} (${seed.length} → ${merged.length})`);
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to persist merged synonyms for manga ${mangaId} (non-critical)`, err);
  }
}
