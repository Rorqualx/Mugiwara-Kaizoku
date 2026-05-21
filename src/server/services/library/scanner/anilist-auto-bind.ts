/**
 * AniList Auto-Binding
 *
 * Automatically searches AniList for a newly created manga and binds it
 * if a match is found. Called fire-and-forget after manga creation.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { Prisma } from '@prisma/client';

/** Build the update payload for binding a manga to an AniList result. */
function buildBindData(
  result: { id: unknown; title: string; description?: string | null; genres?: string[]; status?: string | null },
  coverUrl: string
): Prisma.MangaUpdateInput {
  const anilistId = String(result.id);
  return {
    source: 'anilist',
    sourceId: anilistId,
    searchProvider: 'anilist',
    summary: result.description ?? null,
    providerMetadata: {
      anilist: {
        providerId: anilistId,
        title: result.title,
        coverUrl,
        genres: result.genres ?? [],
        status: result.status ?? null,
        boundAt: new Date().toISOString()
      }
    } as unknown as Prisma.InputJsonValue
  };
}

/**
 * Search AniList for a manga title and bind if found.
 * Updates source, sourceId, summary, and providerMetadata.
 * Runs silently — errors are logged but never thrown.
 */
export async function autoBindAniList(mangaId: number, title: string): Promise<void> {
  try {
    const { unifiedProviderRegistry } = await import('@/server/services/search/UnifiedProviderRegistry');

    const results = await unifiedProviderRegistry.searchWithProvider('anilist', title, { limit: 3 });
    const best = results[0];
    if (!best) {
      logger.debug(`[AniList AutoBind] No match for "${title}"`);
      return;
    }

    const raw = best as unknown as Record<string, unknown>;
    const coverUrl = typeof raw['coverUrl'] === 'string' ? raw['coverUrl']
      : typeof raw['cover_url'] === 'string' ? raw['cover_url'] : '';

    const data = buildBindData(best, coverUrl);
    await prisma.manga.update({ where: { id: mangaId }, data });

    logger.info(`[AniList AutoBind] Bound "${title}" → "${best.title}" (anilist:${best.id})`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`[AniList AutoBind] Failed for "${title}": ${msg}`);
  }
}
