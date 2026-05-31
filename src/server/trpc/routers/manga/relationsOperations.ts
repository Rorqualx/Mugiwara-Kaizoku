/**
 * Relations operations for manga
 *
 * Surfaces `MangaRelation` rows for the related-works carousel (Phase 4 v2-B).
 * Joins bound targets with title + cover for in-app linking; leaves unbound
 * targets as-is so the client can render an external link.
 */

import { z } from 'zod';

import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import type { MangaRelation, MangaRelationTargetMedium, MangaRelationType } from '@prisma/client';

const RELATION_PRIORITY: Record<MangaRelationType, number> = {
  PARENT: 0,
  PREQUEL: 1,
  SEQUEL: 2,
  SIDE_STORY: 3,
  SPIN_OFF: 4,
  ALTERNATIVE: 5,
  ADAPTATION: 6,
  CHARACTER: 7,
  SUMMARY: 8,
  COMPILATION: 9,
  CONTAINS: 10,
  SOURCE: 11,
  OTHER: 12,
};

export interface RelatedWorkEntry {
  id: number;
  relationType: MangaRelationType;
  targetMedium: MangaRelationTargetMedium;
  targetTitle: string;
  externalSource: string;
  externalToId: string;
  toMangaId: number | null;
  toMangaCover: string | null;
}

interface BoundTarget {
  id: number;
  title: string;
  Metadata: { cover: string; coverMedium: string | null; coverLarge: string | null } | null;
}

type RelationRow = MangaRelation & { toManga: BoundTarget | null };

const TARGET_META_SELECT = { cover: true, coverMedium: true, coverLarge: true } as const;
const TARGET_SELECT = { id: true, title: true, Metadata: { select: TARGET_META_SELECT } } as const;
const RELATIONS_INCLUDE = { toManga: { select: TARGET_SELECT } } as const;

function buildEntry(row: RelationRow): RelatedWorkEntry {
  const bound = row.toManga;
  const meta = bound?.Metadata ?? null;
  const cover = meta?.coverMedium ?? meta?.coverLarge ?? meta?.cover ?? null;
  return {
    id: row.id,
    relationType: row.relationType,
    targetMedium: row.targetMedium,
    targetTitle: bound?.title ?? row.targetTitle,
    externalSource: row.externalSource,
    externalToId: row.externalToId,
    toMangaId: row.toMangaId,
    toMangaCover: cover,
  };
}

function compareEntries(a: RelatedWorkEntry, b: RelatedWorkEntry): number {
  const pa = RELATION_PRIORITY[a.relationType];
  const pb = RELATION_PRIORITY[b.relationType];
  if (pa !== pb) return pa - pb;
  return a.targetTitle.localeCompare(b.targetTitle);
}

/**
 * Get all related works for a manga, ordered by relation-type priority
 * (parent/prequel/sequel first; other last). Bound targets carry their cover.
 */
const getRelations = protectedProcedure
  .input(z.object({ mangaId: z.number() }))
  .query(async ({ input, ctx }): Promise<RelatedWorkEntry[]> => {
    const rows = await ctx.prisma.mangaRelation.findMany({
      where: { fromMangaId: input.mangaId },
      include: RELATIONS_INCLUDE,
    });

    const entries = (rows as RelationRow[]).map(buildEntry);
    entries.sort(compareEntries);
    return entries;
  });

export const relationsRouter = router({
  getRelations,
});
