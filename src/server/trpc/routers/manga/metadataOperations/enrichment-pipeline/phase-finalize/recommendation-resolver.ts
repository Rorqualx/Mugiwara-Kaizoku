/**
 * Phase 5 Sprint #1.3: persist AniList recommendations into
 * `MangaRecommendation`.
 *
 * Mirrors `manga-relation-resolver.ts`'s shape exactly — same forward +
 * inverse pattern, same idempotent upsert semantics. Differences:
 *  - Key is `(fromMangaId, externalSource, externalToId)` — relationType
 *    isn't part of the key because recommendations don't have one.
 *  - `rating` (upvote count) is preserved and updated on every run.
 *  - Resolver runs cheaper than relations — typical AL extract is ≤ 20 edges.
 *
 * Inputs come from enrichment-result-builder via
 * `enrichedData.manga.anilistRecommendations`.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

const log = logger.child('phase-finalize:recommendation-resolver');

interface AniListRecommendationEdge {
  anilistId: number;
  title: string;
  format: string | null;
  coverUrl: string | null;
  medium: 'MANGA' | 'ANIME' | 'NOVEL' | 'OTHER' | null;
  rating: number | null;
}

interface UpsertCounts { created: number; updated: number; skipped: number }

async function findTargetMangaId(externalToId: string, externalSource = 'anilist'): Promise<number | null> {
  // Same JSON-path query the relation resolver uses. Sprint #2 widens the
  // source parameter so MAL recommendations can resolve via
  // providerMetadata.mal.providerId on the same path.
  if (externalSource === 'mal') {
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM "Manga"
      WHERE "providerMetadata"->'mal'->>'providerId' = ${externalToId}
      LIMIT 1
    `;
    return rows[0]?.id ?? null;
  }
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "Manga"
    WHERE "providerMetadata"->'anilist'->>'providerId' = ${externalToId}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function upsertSingleRecommendation(
  fromMangaId: number,
  edge: AniListRecommendationEdge,
  toMangaId: number | null,
  externalSource = 'anilist',
): Promise<'created' | 'updated' | 'skipped'> {
  const data = {
    fromMangaId,
    externalSource,
    externalToId: String(edge.anilistId),
    toMangaId,
    targetTitle: edge.title.slice(0, 500),
    targetMedium: edge.medium,
    targetFormat: edge.format,
    targetCoverUrl: edge.coverUrl,
    rating: edge.rating,
  };
  const result = await prisma.mangaRecommendation.upsert({
    where: {
      fromMangaId_externalSource_externalToId: {
        fromMangaId,
        externalSource,
        externalToId: String(edge.anilistId),
      },
    },
    create: data,
    update: {
      toMangaId,
      targetCoverUrl: edge.coverUrl,
      rating: edge.rating,
    },
  });
  return result.createdAt.getTime() === result.updatedAt.getTime() ? 'created' : 'updated';
}

async function processEdge(
  fromMangaId: number,
  edge: AniListRecommendationEdge,
  externalSource = 'anilist',
): Promise<'created' | 'updated' | 'skipped'> {
  const toMangaId = await findTargetMangaId(String(edge.anilistId), externalSource);
  try {
    return await upsertSingleRecommendation(fromMangaId, edge, toMangaId, externalSource);
  } catch (err: unknown) {
    log.warn('Failed to upsert MangaRecommendation', {
      fromMangaId, externalSource, externalToId: edge.anilistId,
      error: err instanceof Error ? err.message : String(err),
    });
    return 'skipped';
  }
}

export async function resolveAniListRecommendations(
  fromMangaId: number,
  edges: AniListRecommendationEdge[],
): Promise<UpsertCounts> {
  return resolveRecommendations(fromMangaId, edges, 'anilist');
}

/** Sprint #2: shared resolver that the AL + MAL flows both reach. */
export async function resolveRecommendations(
  fromMangaId: number,
  edges: AniListRecommendationEdge[],
  externalSource: 'anilist' | 'mal',
): Promise<UpsertCounts> {
  if (edges.length === 0) return { created: 0, updated: 0, skipped: 0 };
  let created = 0; let updated = 0; let skipped = 0;
  for (const edge of edges) {
    // eslint-disable-next-line no-await-in-loop -- sequential keeps logs ordered; ≤ 20 edges typical
    const verdict = await processEdge(fromMangaId, edge, externalSource);
    if (verdict === 'created') created++;
    else if (verdict === 'updated') updated++;
    else skipped++;
  }
  log.info('MangaRecommendation persistence complete', {
    fromMangaId, externalSource, created, updated, skipped, total: edges.length,
  });
  return { created, updated, skipped };
}

/**
 * Inverse pass: when a manga gets newly imported, back-fill `toMangaId`
 * on any existing `MangaRecommendation` rows that pointed at its AL id.
 */
export async function backfillRecommendationsForNewManga(
  newMangaId: number,
  alId: string,
): Promise<number> {
  const result = await prisma.mangaRecommendation.updateMany({
    where: { externalSource: 'anilist', externalToId: alId, toMangaId: null },
    data: { toMangaId: newMangaId },
  });
  if (result.count > 0) {
    log.info('Back-filled MangaRecommendation toMangaId on inverse pass', {
      newMangaId, alId, count: result.count,
    });
  }
  return result.count;
}

/**
 * Phase-finalize entry point. Idempotent — safe to re-run on every
 * enrichment cycle. Failures are caught + logged; recommendation persistence
 * is non-critical to overall enrichment success.
 */
export async function persistAniListRecommendationsForManga(
  mangaId: number,
  providerResults: { enrichmentResult: { enrichedData?: unknown } },
): Promise<void> {
  const enrichedData = providerResults.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
  const unifiedManga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
  const alEdges = unifiedManga?.['anilistRecommendations'] as AniListRecommendationEdge[] | undefined;
  const malEdges = unifiedManga?.['malRecommendations'] as AniListRecommendationEdge[] | undefined;
  const malId = unifiedManga?.['malId'] as number | undefined;
  try {
    if (Array.isArray(alEdges) && alEdges.length > 0) {
      await resolveAniListRecommendations(mangaId, alEdges);
    }
    // Phase 5 Sprint #2: MAL recommendations land in the same table with
    // externalSource='mal'. The inverse-resolve runs against MAL ids too.
    if (Array.isArray(malEdges) && malEdges.length > 0) {
      await resolveRecommendations(mangaId, malEdges, 'mal');
    }
    // Inverse direction (AL): other manga may have been waiting for this manga's
    // AL id to be imported as a target.
    const alId = await readMangaAniListId(mangaId);
    if (alId !== null) await backfillRecommendationsForNewManga(mangaId, alId);
    // Inverse direction (MAL): backfill MAL recs whose target is this manga.
    if (typeof malId === 'number') {
      await backfillRecommendationsForNewMangaMAL(mangaId, String(malId));
    }
  } catch (err: unknown) {
    log.warn('MangaRecommendation resolver failed (non-critical)', {
      mangaId, error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function backfillRecommendationsForNewMangaMAL(
  newMangaId: number,
  malId: string,
): Promise<number> {
  const result = await prisma.mangaRecommendation.updateMany({
    where: { externalSource: 'mal', externalToId: malId, toMangaId: null },
    data: { toMangaId: newMangaId },
  });
  if (result.count > 0) {
    log.info('Back-filled MAL MangaRecommendation toMangaId', {
      newMangaId, malId, count: result.count,
    });
  }
  return result.count;
}

async function readMangaAniListId(mangaId: number): Promise<string | null> {
  const row = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  const pm = row?.providerMetadata as Record<string, Record<string, unknown>> | null;
  const al = pm?.['anilist']?.['providerId'];
  return typeof al === 'string' && al.length > 0 ? al : null;
}
