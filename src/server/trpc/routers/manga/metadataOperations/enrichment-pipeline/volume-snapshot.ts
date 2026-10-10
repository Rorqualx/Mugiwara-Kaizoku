/**
 * Snapshot / restore around the per-run volume rebuild.
 *
 * Every enrichment that has provider chapters deletes the manga's Volume rows
 * and rebuilds them from that run's provider results. The rebuild runs in
 * later phases and outside the deleting transaction, so a provider outage or a
 * failed rebuild used to leave the title with fewer volumes — or none — while
 * the pipeline reported success. The delete also cascades to VolumeProgress
 * and nulls every Chapter.volumeId.
 *
 * This keeps the delete-and-rebuild semantics for a healthy run (so nothing a
 * wrong binding wrote can stick) and adds a safety net: snapshot before, then
 * after the rebuild put back
 *   - every volume, when the rebuild produced none;
 *   - volumes that are missing and were sourced from a provider that did not
 *     answer this run;
 *   - descriptive fields (title, cover, ISBN…) the rebuild left empty on a
 *     volume whose previous data came from a provider that did not answer;
 *   - user volume progress, re-pointed at the rebuilt row for the same number.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { unansweredProviders, type ProviderOutcomes } from './phase-provider-fetch/provider-outcome';

import type { Prisma, Volume, VolumeProgress } from '@prisma/client';

export interface VolumeSnapshot {
  volumes: Volume[];
  /** chapterId → volumeId as linked before the rebuild. */
  chapterLinks: Array<{ id: number; volumeId: number }>;
  progress: VolumeProgress[];
}

export interface VolumeRestoreResult {
  restoredVolumes: number;
  refilledVolumes: number;
  relinkedChapters: number;
  restoredProgress: number;
}

export async function snapshotVolumes(mangaId: number): Promise<VolumeSnapshot> {
  const [volumes, chapterRows, progress] = await Promise.all([
    prisma.volume.findMany({ where: { mangaId } }),
    prisma.chapter.findMany({ where: { mangaId, volumeId: { not: null } }, select: { id: true, volumeId: true } }),
    prisma.volumeProgress.findMany({ where: { mangaId } }),
  ]);
  const chapterLinks = chapterRows.flatMap(c => (c.volumeId === null ? [] : [{ id: c.id, volumeId: c.volumeId }]));
  return { volumes, chapterLinks, progress };
}

/** True when a `Volume.source` like "comicvine+wikipedia" names one of `providers`. */
function sourcedFrom(source: string | null, providers: readonly string[]): boolean {
  if (source === null) return false;
  const parts = source.toLowerCase().split('+');
  return providers.some(p => parts.includes(p));
}

/**
 * Pick the snapshot volume numbers to put back after the rebuild.
 *
 * A healthy run restores nothing: its rebuilt set is the truth. Manual volumes
 * are always restored when missing — no provider run should remove them.
 */
export function planVolumeRestore(
  snapshot: ReadonlyArray<Pick<Volume, 'number' | 'source'>>,
  currentNumbers: ReadonlySet<number>,
  unanswered: readonly string[],
): number[] {
  if (snapshot.length === 0) return [];
  if (currentNumbers.size === 0) return snapshot.map(v => v.number);
  return snapshot
    .filter(v => !currentNumbers.has(v.number))
    .filter(v => v.source === 'manual' || sourcedFrom(v.source, unanswered))
    .map(v => v.number);
}

/** Descriptive columns a provider supplies; ranges and source are owned by the rebuild. */
const REFILLABLE_FIELDS = [
  'title', 'subtitle', 'alternativeTitle', 'description', 'summary', 'isbn', 'isbn13',
  'publisher', 'pageCount', 'releaseDate', 'coverImage',
] as const satisfies ReadonlyArray<keyof Volume>;

type RefillableField = typeof REFILLABLE_FIELDS[number];
export type VolumeFieldRefill = Partial<Pick<Volume, RefillableField>>;

/**
 * Fields to copy back onto a rebuilt volume from its previous version: only
 * ones the rebuild left empty, and only when the previous data came from a
 * provider that did not answer this run. A healthy run refills nothing, so a
 * value written under a since-corrected binding cannot come back.
 */
export function planVolumeFieldRefill(
  previous: Pick<Volume, RefillableField | 'source'>,
  rebuilt: Pick<Volume, RefillableField>,
  unanswered: readonly string[],
): VolumeFieldRefill {
  if (!sourcedFrom(previous.source, unanswered)) return {};
  const refill: Record<string, unknown> = {};
  for (const field of REFILLABLE_FIELDS) {
    const before = previous[field];
    if (before !== null && rebuilt[field] === null) refill[field] = before;
  }
  return refill as VolumeFieldRefill;
}

async function refillVolumeFields(mangaId: number, snapshot: VolumeSnapshot, unanswered: readonly string[]): Promise<number> {
  if (unanswered.length === 0) return 0;
  const previousByNumber = new Map(snapshot.volumes.map(v => [v.number, v]));
  const rebuilt = await prisma.volume.findMany({ where: { mangaId } });
  let refilled = 0;
  for (const volume of rebuilt) {
    const previous = previousByNumber.get(volume.number);
    if (!previous || previous.id === volume.id) continue;
    const data = planVolumeFieldRefill(previous, volume, unanswered);
    if (Object.keys(data).length === 0) continue;
    // eslint-disable-next-line no-await-in-loop -- one statement per affected volume, degraded runs only
    await prisma.volume.update({ where: { id: volume.id }, data });
    refilled++;
  }
  if (refilled > 0) {
    logger.warn(`[enrichmentPipeline] Refilled fields on ${refilled} volume(s) for manga ${mangaId} from before this run`, { unanswered });
  }
  return refilled;
}

export async function restoreVolumesAfterRebuild(
  mangaId: number,
  snapshot: VolumeSnapshot,
  providerStatus: ProviderOutcomes | undefined,
): Promise<VolumeRestoreResult> {
  const none: VolumeRestoreResult = { restoredVolumes: 0, refilledVolumes: 0, relinkedChapters: 0, restoredProgress: 0 };
  if (snapshot.volumes.length === 0) return none;
  try {
    const current = await prisma.volume.findMany({ where: { mangaId }, select: { id: true, number: true } });
    const unanswered = unansweredProviders(providerStatus);
    const toRestore = new Set(planVolumeRestore(snapshot.volumes, new Set(current.map(v => v.number)), unanswered));
    const rows = snapshot.volumes.filter(v => toRestore.has(v.number));

    let relinkedChapters = 0;
    if (rows.length > 0) {
      // Original ids are reused so the saved chapter links point at them again.
      await prisma.volume.createMany({ data: rows as Prisma.VolumeCreateManyInput[], skipDuplicates: true });
      const restoredIds = new Set(rows.map(v => v.id));
      const byVolume = new Map<number, number[]>();
      for (const link of snapshot.chapterLinks) {
        if (!restoredIds.has(link.volumeId)) continue;
        byVolume.set(link.volumeId, [...(byVolume.get(link.volumeId) ?? []), link.id]);
      }
      for (const [volumeId, chapterIds] of byVolume) {
        // eslint-disable-next-line no-await-in-loop -- one statement per restored volume, bounded by volume count
        const updated = await prisma.chapter.updateMany({
          where: { id: { in: chapterIds }, mangaId, volumeId: null },
          data: { volumeId },
        });
        relinkedChapters += updated.count;
      }
      logger.warn(`[enrichmentPipeline] Restored ${rows.length} volume(s) for manga ${mangaId} that this run did not rebuild`, {
        numbers: rows.map(v => v.number), unanswered,
      });
    }

    const refilledVolumes = await refillVolumeFields(mangaId, snapshot, unanswered);
    const restoredProgress = await restoreVolumeProgress(mangaId, snapshot);
    return { restoredVolumes: rows.length, refilledVolumes, relinkedChapters, restoredProgress };
  } catch (err) {
    logger.error(`[enrichmentPipeline] Volume restore failed for manga ${mangaId}`, err);
    return none;
  }
}

/** Re-create progress rows the delete cascaded away, on the rebuilt volume of the same number. */
async function restoreVolumeProgress(mangaId: number, snapshot: VolumeSnapshot): Promise<number> {
  if (snapshot.progress.length === 0) return 0;
  const numberByOldId = new Map(snapshot.volumes.map(v => [v.id, v.number]));
  const current = await prisma.volume.findMany({ where: { mangaId }, select: { id: true, number: true } });
  const idByNumber = new Map(current.map(v => [v.number, v.id]));

  const data: Prisma.VolumeProgressCreateManyInput[] = [];
  for (const { id: _id, volumeId, ...rest } of snapshot.progress) {
    const number = numberByOldId.get(volumeId);
    const newVolumeId = number === undefined ? undefined : idByNumber.get(number);
    if (newVolumeId !== undefined) data.push({ ...rest, volumeId: newVolumeId });
  }
  if (data.length === 0) return 0;
  const created = await prisma.volumeProgress.createMany({ data, skipDuplicates: true });
  return created.count;
}
