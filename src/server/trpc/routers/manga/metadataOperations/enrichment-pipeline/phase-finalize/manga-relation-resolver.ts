/**
 * Phase 1: persist AniList relations.edges[] into the MangaRelation table.
 *
 * Inputs come from enrichment-result-builder via enrichedData.manga.anilistRelations.
 * For each AL relation edge, upsert a MangaRelation row keyed by
 * (fromMangaId, externalSource='anilist', externalToId, relationType).
 *
 * `toMangaId` back-fill: when the AL target id matches a manga already in the
 * library (via Manga.providerMetadata.anilist.providerId), set toMangaId at
 * insert. Otherwise leave null — the Manga.create inverse-resolver
 * (`backfillMangaRelationsForNewManga`) fills it when the target gets imported.
 *
 * Relation types map AL's `relationType` strings to the `MangaRelationType`
 * enum. Unknown values fall through to OTHER.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { MangaRelationType, MangaRelationTargetMedium } from '@prisma/client';

const log = logger.child('phase-finalize:manga-relation-resolver');

interface AniListRelationEdge {
  externalToId: string;
  relationType: string;
  targetTitle: string;
  targetMedium: 'MANGA' | 'ANIME' | 'NOVEL' | 'OTHER';
}

interface UpsertCounts { created: number; updated: number; skipped: number }

const RELATION_TYPE_MAP: Record<string, MangaRelationType> = {
  PREQUEL: 'PREQUEL',
  SEQUEL: 'SEQUEL',
  SIDE_STORY: 'SIDE_STORY',
  PARENT: 'PARENT',
  SPIN_OFF: 'SPIN_OFF',
  ALTERNATIVE: 'ALTERNATIVE',
  ADAPTATION: 'ADAPTATION',
  CHARACTER: 'CHARACTER',
  SUMMARY: 'SUMMARY',
  COMPILATION: 'COMPILATION',
  CONTAINS: 'CONTAINS',
  SOURCE: 'SOURCE',
  OTHER: 'OTHER',
};

function mapRelationType(raw: string): MangaRelationType {
  return RELATION_TYPE_MAP[raw.toUpperCase()] ?? 'OTHER';
}

async function findTargetMangaId(externalToId: string): Promise<number | null> {
  // Find a Manga whose providerMetadata.anilist.providerId equals the AL target id.
  // Using a raw query because Prisma JSON path filters are clumsy across versions.
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM "Manga"
    WHERE "providerMetadata"->'anilist'->>'providerId' = ${externalToId}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function upsertSingleRelation(
  fromMangaId: number,
  edge: AniListRelationEdge,
  relationType: MangaRelationType,
  targetMedium: MangaRelationTargetMedium,
  toMangaId: number | null,
): Promise<'created' | 'updated'> {
  const existing = await prisma.mangaRelation.findUnique({
    where: {
      fromMangaId_externalSource_externalToId_relationType: {
        fromMangaId,
        externalSource: 'anilist',
        externalToId: edge.externalToId,
        relationType,
      },
    },
  });
  if (existing === null) {
    await prisma.mangaRelation.create({
      data: {
        fromMangaId, toMangaId,
        externalSource: 'anilist',
        externalToId: edge.externalToId,
        targetTitle: edge.targetTitle,
        targetMedium, relationType,
      },
    });
    return 'created';
  }
  // Update targetTitle (AL may have changed the canonical name) + back-fill
  // toMangaId if it's still null and we found a match this run.
  const data: Record<string, unknown> = { targetTitle: edge.targetTitle };
  if (existing.toMangaId === null && toMangaId !== null) data['toMangaId'] = toMangaId;
  await prisma.mangaRelation.update({ where: { id: existing.id }, data });
  return 'updated';
}

async function processEdge(
  fromMangaId: number,
  edge: AniListRelationEdge,
): Promise<'created' | 'updated' | 'skipped'> {
  const relationType = mapRelationType(edge.relationType);
  const targetMedium = edge.targetMedium as MangaRelationTargetMedium;
  const toMangaId = await findTargetMangaId(edge.externalToId);
  try {
    return await upsertSingleRelation(fromMangaId, edge, relationType, targetMedium, toMangaId);
  } catch (err) {
    log.warn('Failed to upsert MangaRelation', {
      fromMangaId, externalToId: edge.externalToId, relationType,
      error: err instanceof Error ? err.message : String(err),
    });
    return 'skipped';
  }
}

export async function resolveAniListRelations(
  fromMangaId: number,
  edges: AniListRelationEdge[],
): Promise<UpsertCounts> {
  if (edges.length === 0) return { created: 0, updated: 0, skipped: 0 };
  let created = 0; let updated = 0; let skipped = 0;
  for (const edge of edges) {
    // eslint-disable-next-line no-await-in-loop -- sequential keeps logs ordered; <20 edges typical
    const verdict = await processEdge(fromMangaId, edge);
    if (verdict === 'created') created++;
    else if (verdict === 'updated') updated++;
    else skipped++;
  }
  log.info('MangaRelation persistence complete', {
    fromMangaId, created, updated, skipped, total: edges.length,
  });
  return { created, updated, skipped };
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

/**
 * Phase-finalize entry point: runs BOTH directions.
 *  1. Forward: extract `anilistRelations` from enrichedData and upsert
 *     MangaRelation rows for relations this manga has TO other manga.
 *  2. Inverse: back-fill `toMangaId` on any existing rows where this
 *     manga's AL providerId is the target (other manga → this).
 * Idempotent — safe to re-run on every enrichment cycle.
 */
export async function persistAniListRelationsForManga(
  mangaId: number,
  providerResults: { enrichmentResult: { enrichedData?: unknown } },
): Promise<void> {
  const enrichedData = providerResults.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
  const unifiedManga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
  const edges = unifiedManga?.['anilistRelations'] as AniListRelationEdge[] | undefined;
  try {
    if (Array.isArray(edges) && edges.length > 0) {
      await resolveAniListRelations(mangaId, edges);
    }
    // Inverse direction: even when this manga has no outbound relations, other
    // manga may have been waiting for it as a target.
    const alId = await readMangaAniListId(mangaId);
    if (alId !== null) await backfillMangaRelationsForNewManga(mangaId, alId);
  } catch (err) {
    log.warn('MangaRelation resolver failed (non-critical)', {
      mangaId, error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Inverse-resolver: when a manga is newly imported (or its AL providerId is
 * first bound), look for existing MangaRelation rows whose `externalSource =
 * 'anilist'` AND `externalToId = <new manga's AL id>` AND `toMangaId IS NULL`,
 * and back-fill `toMangaId` to point at the new manga. One query, cheap.
 *
 * Call site: invoke this from `Manga.create` / `Manga.update` paths where the
 * AL binding is established (e.g. import-from-pipeline, scanner auto-match).
 */
export async function backfillMangaRelationsForNewManga(
  newMangaId: number,
  newMangaAnilistId: string,
): Promise<number> {
  const updated = await prisma.mangaRelation.updateMany({
    where: {
      externalSource: 'anilist',
      externalToId: newMangaAnilistId,
      toMangaId: null,
    },
    data: { toMangaId: newMangaId },
  });
  if (updated.count > 0) {
    log.info('Back-filled MangaRelation.toMangaId for newly-imported manga', {
      newMangaId, newMangaAnilistId, backfilled: updated.count,
    });
  }
  return updated.count;
}
