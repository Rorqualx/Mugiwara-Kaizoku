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
 *     answer this run, or that the title is bound to but this run's search
 *     did not find again;
 *   - descriptive fields (title, cover, ISBN…) and an empty chapter range the
 *     rebuild left on a volume whose previous data came from such a provider;
 *   - volumes the rebuild did not produce that are numbered within the
 *     stored volume count and fill a gap it left (planWithinCountRestore);
 *   - user volume progress, re-pointed at the rebuilt row for the same number.
 */

import { prisma } from '@/server/db';
import { parseProviderMetadata, readProviderId } from '@/server/services/metadata/provider-metadata-utils';
import { logger } from '@/utils/logger';

import { unansweredProviders, type ProviderOutcomes } from './phase-provider-fetch/provider-outcome';

import type { Prisma, Volume, VolumeProgress } from '@prisma/client';

export interface VolumeSnapshot {
  volumes: Volume[];
  /** chapterId → volumeId as linked before the rebuild. */
  chapterLinks: Array<{ id: number; volumeId: number }>;
  progress: VolumeProgress[];
  /** Providers the title held a bound entity for when the run started. */
  boundProviders: string[];
}

export interface VolumeRestoreResult {
  restoredVolumes: number;
  refilledVolumes: number;
  relinkedChapters: number;
  restoredProgress: number;
}

export async function snapshotVolumes(mangaId: number): Promise<VolumeSnapshot> {
  const [volumes, chapterRows, progress, manga] = await Promise.all([
    prisma.volume.findMany({ where: { mangaId } }),
    prisma.chapter.findMany({ where: { mangaId, volumeId: { not: null } }, select: { id: true, volumeId: true } }),
    prisma.volumeProgress.findMany({ where: { mangaId } }),
    prisma.manga.findUnique({ where: { id: mangaId }, select: { providerMetadata: true } }),
  ]);
  const chapterLinks = chapterRows.flatMap(c => (c.volumeId === null ? [] : [{ id: c.id, volumeId: c.volumeId }]));
  return { volumes, chapterLinks, progress, boundProviders: boundProvidersOf(manga?.providerMetadata) };
}

/** Lower-cased provider names that carry a bound entity id in `Manga.providerMetadata`. */
export function boundProvidersOf(providerMetadata: unknown): string[] {
  const parsed = parseProviderMetadata(providerMetadata);
  const bound = Object.keys(parsed).filter(provider => readProviderId(parsed, provider) !== null);
  return [...new Set(bound.map(provider => provider.toLowerCase()))];
}

/**
 * Providers whose earlier volume data this run must not discard: the ones
 * that did not answer, plus the ones the title is bound to that came back
 * with no match. A search that no longer finds a bound entity (ComicVine's
 * language gate turning away "<Title> (Official Colored)", say) has not
 * refreshed that entity's data, so the rebuild has nothing to replace it
 * with. Re-identify clears automatic bindings before the run and so still
 * starts clean.
 */
export function providersToKeep(
  providerStatus: ProviderOutcomes | undefined,
  boundProviders: readonly string[],
): string[] {
  const keep = new Set(unansweredProviders(providerStatus));
  for (const [provider, outcome] of Object.entries(providerStatus ?? {})) {
    if (outcome === 'no_match' && boundProviders.includes(provider.toLowerCase())) keep.add(provider);
  }
  return [...keep];
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

type RangedVolume = Pick<Volume, 'number' | 'chapterStart' | 'chapterEnd'>;

/**
 * Snapshot volumes the rebuild dropped that are still the series' own: numbered
 * within the stored volume count, covering chapters within the stored chapter
 * count, and not overlapping any rebuilt volume's range. No provider rebuilds a
 * volume that only this library knows — "Vol 14 (placeholder)" of a 14-volume,
 * 66-chapter series (chapters 60-66, which no provider places in a volume) —
 * so the rebuild deleted it on every refresh and its chapters fell out as
 * overflow. A volume of a since-corrected wrong binding is not put back unless
 * it fits the counts and the gap the rebuild left.
 */
export function planWithinCountRestore(
  snapshot: ReadonlyArray<RangedVolume>,
  current: ReadonlyArray<RangedVolume>,
  storedVolumes: number,
  storedChapters: number,
): number[] {
  if (storedVolumes <= 0 || storedChapters <= 0) return [];
  const currentNumbers = new Set(current.map(v => v.number));
  const overlapsRebuilt = (start: number, end: number): boolean => current.some(v =>
    v.chapterStart !== null && v.chapterEnd !== null && start <= v.chapterEnd && end >= v.chapterStart);
  return snapshot
    .filter(v => v.number >= 1 && v.number <= storedVolumes && !currentNumbers.has(v.number))
    .filter(v => v.chapterStart !== null && v.chapterEnd !== null
      && v.chapterStart >= 1 && v.chapterEnd >= v.chapterStart && v.chapterEnd <= storedChapters
      && !overlapsRebuilt(v.chapterStart, v.chapterEnd))
    .map(v => v.number);
}

/** Descriptive columns a provider supplies; ranges and source are owned by the rebuild. */
const REFILLABLE_FIELDS = [
  'title', 'subtitle', 'alternativeTitle', 'description', 'summary', 'isbn', 'isbn13',
  'publisher', 'pageCount', 'releaseDate', 'coverImage',
] as const satisfies ReadonlyArray<keyof Volume>;

/** Providers that write per-volume titles, covers, ISBNs and dates. */
const VOLUME_DATA_PROVIDERS: readonly string[] = ['comicvine', 'wikipedia', 'fandom', 'mangadex'];

type RefillableField = typeof REFILLABLE_FIELDS[number];
type RangeField = 'chapterStart' | 'chapterEnd';
export type VolumeFieldRefill = Partial<Pick<Volume, RefillableField | RangeField>>;

/**
 * Fields to copy back onto a rebuilt volume from its previous version: only
 * ones the rebuild left empty, and only when a provider that supplies volume
 * data (or the one named in the previous source) was not refreshed this run.
 * A healthy run refills nothing, so a value written under a since-corrected
 * binding cannot come back.
 */
export function planVolumeFieldRefill(
  previous: Pick<Volume, RefillableField | RangeField | 'source'>,
  rebuilt: Pick<Volume, RefillableField | RangeField>,
  unanswered: readonly string[],
): VolumeFieldRefill {
  // `Volume.source` names who set the range, not who wrote each field (ComicVine
  // titles and covers sit on volumes labelled "mangadex"), so any volume-data
  // provider that was not refreshed is reason enough to keep what was there.
  const volumeDataNotRefreshed = unanswered.some(p => VOLUME_DATA_PROVIDERS.includes(p.toLowerCase()));
  if (!volumeDataNotRefreshed && !sourcedFrom(previous.source, unanswered)) return {};
  const refill: Record<string, unknown> = {};
  for (const field of REFILLABLE_FIELDS) {
    const before = previous[field];
    if (before !== null && rebuilt[field] === null) refill[field] = before;
  }
  // The rebuild owns ranges, but when it produced none at all the previous
  // range is better than a volume that covers nothing.
  if (rebuilt.chapterStart === null && rebuilt.chapterEnd === null && previous.chapterStart !== null) {
    refill['chapterStart'] = previous.chapterStart;
    refill['chapterEnd'] = previous.chapterEnd;
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
    const [current, counts] = await Promise.all([
      prisma.volume.findMany({ where: { mangaId }, select: { id: true, number: true, chapterStart: true, chapterEnd: true } }),
      prisma.manga.findUnique({ where: { id: mangaId }, select: { Metadata: { select: { volumes: true, chapters: true } } } }),
    ]);
    const unanswered = providersToKeep(providerStatus, snapshot.boundProviders);
    const toRestore = new Set([
      ...planVolumeRestore(snapshot.volumes, new Set(current.map(v => v.number)), unanswered),
      ...planWithinCountRestore(snapshot.volumes, current, counts?.Metadata?.volumes ?? 0, counts?.Metadata?.chapters ?? 0),
    ]);
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
