/**
 * Keep each volume's row id across a refresh.
 *
 * Phase 2 deletes a title's Volume rows and the later phases rebuild them from
 * this run's provider data (see volume-snapshot.ts for why the rebuild stays a
 * rebuild). Every rebuilt row used to get a fresh id, so every refresh moved
 * every `Chapter.volumeId`, dropped the user's bookmarked volumes (the delete
 * cascades and nothing put them back) and re-created the user's volume progress
 * under new ids — even when nothing about the volumes had changed.
 *
 * A volume is identified by (mangaId, number) — unique in the schema. After the
 * rebuild, each rebuilt row whose number existed before the run takes back that
 * row's id. Every foreign key to `Volume.id` is ON UPDATE CASCADE, so one
 * `UPDATE "Volume" SET id = <old>` re-points chapters, volume progress,
 * bookmarks and the creator/genre/theme/arc rows with it. A rebuilt row whose
 * content equals the previous row's also takes back its timestamps, so a
 * refresh that changes nothing leaves the row byte-identical. Volumes that are
 * truly new keep their new id; volumes the rebuild dropped stay dropped (the
 * restore and phantom-prune rules decide that, not this step).
 *
 * Idempotent: run before finalize (so its cache invalidation and WebSocket
 * update already carry the stable ids) and again after it (to catch a volume
 * finalize re-created and to compare content after finalize's fills).
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { BookmarkedVolume, Prisma, Volume, VolumeProgress } from '@prisma/client';

/** Columns that carry a volume's content; ids and bookkeeping timestamps excluded. */
const CONTENT_FIELDS = [
  'number', 'title', 'subtitle', 'alternativeTitle', 'description', 'summary', 'isbn', 'isbn13',
  'publisher', 'pageCount', 'format', 'releaseDate', 'coverImage', 'chapterStart', 'chapterEnd',
  'totalChapters', 'source', 'sourceId', 'sourceUrl', 'enrichmentTier',
] as const satisfies ReadonlyArray<keyof Volume>;

type ContentField = typeof CONTENT_FIELDS[number];
export type VolumeContent = Pick<Volume, ContentField>;

export interface VolumeRekey {
  number: number;
  /** Id the rebuild gave the row. */
  fromId: number;
  /** Id the row had before the run. */
  toId: number;
}

/**
 * Pair rebuilt rows with the rows they replace, by volume number.
 *
 * `takenIds` are ids some Volume row holds right now (any manga); a previous id
 * that is taken — a restored row already carries it — is not reused.
 */
export function planVolumeRekeys(
  previous: ReadonlyArray<Pick<Volume, 'id' | 'number'>>,
  current: ReadonlyArray<Pick<Volume, 'id' | 'number'>>,
  takenIds: ReadonlySet<number>,
): VolumeRekey[] {
  const previousIdByNumber = new Map(previous.map(v => [v.number, v.id]));
  const plan: VolumeRekey[] = [];
  for (const row of current) {
    const toId = previousIdByNumber.get(row.number);
    if (toId === undefined || toId === row.id || takenIds.has(toId)) continue;
    plan.push({ number: row.number, fromId: row.id, toId });
  }
  return plan;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/** True when two volume rows carry the same content (ids and timestamps aside). */
export function sameVolumeContent(a: VolumeContent, b: VolumeContent): boolean {
  return CONTENT_FIELDS.every(field => sameValue(a[field], b[field]));
}

/** What the run must hand back to `stabilizeVolumeIds`: the rows as they were before the rebuild. */
export interface VolumeIdentitySnapshot {
  volumes: Volume[];
  progress: VolumeProgress[];
  bookmarks: BookmarkedVolume[];
}

export interface VolumeIdentityResult {
  rekeyed: number;
  unchanged: number;
  restoredProgress: number;
  restoredBookmarks: number;
}

async function rekeyVolumes(mangaId: number, previous: Volume[]): Promise<number> {
  const current = await prisma.volume.findMany({ where: { mangaId }, select: { id: true, number: true } });
  const wanted = previous.map(v => v.id);
  const taken = await prisma.volume.findMany({ where: { id: { in: wanted } }, select: { id: true } });
  const plan = planVolumeRekeys(previous, current, new Set(taken.map(v => v.id)));
  if (plan.length === 0) return 0;
  await prisma.$transaction(plan.map(({ fromId, toId }) => prisma.$executeRaw`
    UPDATE "Volume" SET id = ${toId} WHERE id = ${fromId} AND "mangaId" = ${mangaId}
  `));
  return plan.length;
}

/** Give rows whose content did not change their previous timestamps back. */
async function restoreUnchangedTimestamps(mangaId: number, previous: Volume[]): Promise<number> {
  const current = await prisma.volume.findMany({ where: { mangaId, id: { in: previous.map(v => v.id) } } });
  const previousById = new Map(previous.map(v => [v.id, v]));
  const toRestore = current.flatMap(row => {
    const before = previousById.get(row.id);
    if (!before || !sameVolumeContent(before, row)) return [];
    const unchanged = sameValue(before.createdAt, row.createdAt) && sameValue(before.updatedAt, row.updatedAt)
      && sameValue(before.fetchedAt, row.fetchedAt) && sameValue(before.lastEnriched, row.lastEnriched);
    return unchanged ? [] : [before];
  });
  if (toRestore.length === 0) return 0;
  // Raw SQL: Prisma's @updatedAt would overwrite the value being put back.
  await prisma.$transaction(toRestore.map(v => prisma.$executeRaw`
    UPDATE "Volume" SET "createdAt" = ${v.createdAt}, "updatedAt" = ${v.updatedAt},
      "fetchedAt" = ${v.fetchedAt}, "lastEnriched" = ${v.lastEnriched}
    WHERE id = ${v.id}
  `));
  return toRestore.length;
}

/** Put back, under their own ids, the progress and bookmark rows the delete cascaded away. */
async function restoreUserRows(mangaId: number, snapshot: VolumeIdentitySnapshot): Promise<{ progress: number; bookmarks: number }> {
  if (snapshot.progress.length === 0 && snapshot.bookmarks.length === 0) return { progress: 0, bookmarks: 0 };
  const present = new Set((await prisma.volume.findMany({ where: { mangaId }, select: { id: true } })).map(v => v.id));
  const progress = snapshot.progress.filter(p => present.has(p.volumeId));
  const bookmarks = snapshot.bookmarks.filter(b => b.volumeId === null || present.has(b.volumeId));
  const [p, b] = await Promise.all([
    progress.length > 0
      ? prisma.volumeProgress.createMany({ data: progress as Prisma.VolumeProgressCreateManyInput[], skipDuplicates: true })
      : Promise.resolve({ count: 0 }),
    bookmarks.length > 0
      ? prisma.bookmarkedVolume.createMany({ data: bookmarks as Prisma.BookmarkedVolumeCreateManyInput[], skipDuplicates: true })
      : Promise.resolve({ count: 0 }),
  ]);
  return { progress: p.count, bookmarks: b.count };
}

/**
 * Give rebuilt volumes back the ids (and, when unchanged, the timestamps) they
 * had before the run, and put back the user rows the rebuild's delete removed.
 * Never throws: a failure leaves the rebuilt rows as they are.
 */
export async function stabilizeVolumeIds(mangaId: number, snapshot: VolumeIdentitySnapshot): Promise<VolumeIdentityResult> {
  const none: VolumeIdentityResult = { rekeyed: 0, unchanged: 0, restoredProgress: 0, restoredBookmarks: 0 };
  if (snapshot.volumes.length === 0) return none;
  try {
    const rekeyed = await rekeyVolumes(mangaId, snapshot.volumes);
    const unchanged = await restoreUnchangedTimestamps(mangaId, snapshot.volumes);
    const restored = await restoreUserRows(mangaId, snapshot);
    if (rekeyed > 0 || unchanged > 0 || restored.progress > 0 || restored.bookmarks > 0) {
      logger.info(`[enrichmentPipeline] Kept volume ids for manga ${mangaId}: rekeyed=${rekeyed}, unchangedRows=${unchanged}, progress=${restored.progress}, bookmarks=${restored.bookmarks}`);
    }
    return { rekeyed, unchanged, restoredProgress: restored.progress, restoredBookmarks: restored.bookmarks };
  } catch (err) {
    logger.error(`[enrichmentPipeline] Keeping volume ids failed for manga ${mangaId}`, err);
    return none;
  }
}
