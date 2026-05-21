/**
 * Manual volume manifest sentinel — "user has hand-curated which chapters
 * belong to which volume." Stored at
 * `Manga.providerMetadata.manual.volumeManifest`. Takes absolute precedence
 * over CV/MU/Fandom/Wikipedia raw volume ranges in
 * `persistValidatedVolumeRanges`.
 *
 * Schema:
 *   providerMetadata.manual.volumeManifest = {
 *     manual: true,
 *     setAt: '2026-05-17T...',
 *     volumes: {
 *       '1': { range: [1, 8], bonus: [5.1] },
 *       '2': { range: [9, 17], bonus: [13.5] },
 *       ...
 *     }
 *   }
 *
 * The bridge for iter-PVM: until the cross-source consensus resolver ships,
 * manual manifests are the only way to keep hand-corrected volume ranges
 * (Sweat and Soap canonical vol 1 = ch 1..8) from being clobbered on
 * `forceRefresh:true` re-enrich.
 */
import { prisma as defaultPrisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { ValidatedVolumeRange } from './phase-volume-cross-validation';

export interface ManualVolumeManifestEntry {
  range: [number, number];
  bonus?: number[];
}

export interface ManualVolumeManifest {
  manual: true;
  setAt: string;
  volumes: Record<string, ManualVolumeManifestEntry>;
}

interface ManualSection {
  volumeManifest?: unknown;
}

function isManifestEntry(v: unknown): v is ManualVolumeManifestEntry {
  if (!v || typeof v !== 'object') return false;
  const r = (v as { range?: unknown }).range;
  if (!Array.isArray(r) || r.length !== 2) return false;
  const start: unknown = r[0];
  const end: unknown = r[1];
  return typeof start === 'number' && typeof end === 'number' && start <= end;
}

export function readManualVolumeManifest(
  providerMetadata: unknown,
): ManualVolumeManifest | null {
  if (!providerMetadata || typeof providerMetadata !== 'object' || Array.isArray(providerMetadata)) {
    return null;
  }
  const manual = (providerMetadata as Record<string, unknown>)['manual'] as ManualSection | undefined;
  if (!manual || typeof manual !== 'object') return null;
  const raw = manual.volumeManifest;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  if (m['manual'] !== true) return null;
  const volumes = m['volumes'];
  if (!volumes || typeof volumes !== 'object' || Array.isArray(volumes)) return null;

  const out: Record<string, ManualVolumeManifestEntry> = {};
  for (const [k, v] of Object.entries(volumes as Record<string, unknown>)) {
    if (!isManifestEntry(v)) continue;
    out[k] = v;
  }
  if (Object.keys(out).length === 0) return null;

  const setAt = typeof m['setAt'] === 'string' ? (m['setAt'] as string) : new Date(0).toISOString();
  return { manual: true, setAt, volumes: out };
}

/**
 * Override cross-validated volume ranges with the manual manifest.
 * - For volumes present in BOTH the manifest and the input ranges: replaces
 *   chapterStart/chapterEnd from the manifest, marks `sources: ['manual']`.
 * - For volumes in the manifest but missing from the input ranges: synthesizes
 *   a ValidatedVolumeRange so the volume row gets created.
 * - For volumes in the input ranges but not in the manifest: left untouched.
 */
export function applyManualVolumeManifest(
  ranges: ValidatedVolumeRange[],
  manifest: ManualVolumeManifest,
): ValidatedVolumeRange[] {
  const byNum = new Map(ranges.map(r => [r.volumeNumber, r]));
  const result: ValidatedVolumeRange[] = [];

  for (const [key, entry] of Object.entries(manifest.volumes)) {
    const volNum = Number(key);
    if (!Number.isFinite(volNum)) continue;
    const existing = byNum.get(volNum);
    const [start, end] = entry.range;
    if (existing) {
      result.push({
        ...existing,
        chapterStart: start,
        chapterEnd: end,
        confidence: 1,
        sources: ['manual'],
      });
      byNum.delete(volNum);
    } else {
      result.push({
        volumeNumber: volNum,
        chapterStart: start,
        chapterEnd: end,
        confidence: 1,
        sources: ['manual'],
      });
    }
  }
  for (const remaining of byNum.values()) result.push(remaining);

  result.sort((a, b) => a.volumeNumber - b.volumeNumber);
  return result;
}

/**
 * Final-pass reconciler — called from phase-finalize AFTER every other volume
 * write phase has run (cross-validation, Fandom helpers, sparse-prune,
 * reassignBonus). Restores manual manifest ranges to the live Volume rows so
 * the FK backfill that runs next sees the authoritative ranges.
 *
 * Side effect: clears `Chapter.volumeId` for any chapter whose number now
 * lies outside the manifest's range for that volume — backfill will re-link
 * them to the correct Volume.
 */
export async function reapplyManualManifestToDb(
  mangaId: number,
  prisma: typeof defaultPrisma = defaultPrisma,
): Promise<{ applied: number; clearedFKs: number } | null> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  const manifest = readManualVolumeManifest(manga?.providerMetadata);
  if (!manifest) return null;

  const volRows = await prisma.volume.findMany({
    where: { mangaId },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true },
  });
  const byNum = new Map(volRows.map(v => [v.number, v]));

  let applied = 0;
  for (const [key, entry] of Object.entries(manifest.volumes)) {
    const volNum = Number(key);
    if (!Number.isFinite(volNum)) continue;
    const [start, end] = entry.range;
    const existing = byNum.get(volNum);
    if (existing) {
      if (existing.chapterStart !== start || existing.chapterEnd !== end) {
        // eslint-disable-next-line no-await-in-loop -- per-volume sequential update
        await prisma.volume.update({
          where: { id: existing.id },
          data: { chapterStart: start, chapterEnd: end, totalChapters: end - start + 1, source: 'manual' },
        });
        applied++;
      }
    } else {
      // eslint-disable-next-line no-await-in-loop -- per-volume sequential create
      await prisma.volume.create({
        data: { mangaId, number: volNum, chapterStart: start, chapterEnd: end, totalChapters: end - start + 1, source: 'manual' },
      });
      applied++;
    }
  }

  // Clear FKs that now point to a Volume whose range no longer covers the
  // chapter — backfill (which runs next in phase-finalize) will re-link them.
  const linked = await prisma.chapter.findMany({
    where: { mangaId, volumeId: { not: null }, chapterNumber: { not: null } },
    select: { id: true, chapterNumber: true, volumeId: true },
  });
  const freshRanges = await prisma.volume.findMany({
    where: { mangaId, chapterStart: { not: null }, chapterEnd: { not: null } },
    select: { id: true, chapterStart: true, chapterEnd: true },
  });
  const rangeMap = new Map(freshRanges.map(v => [v.id, v]));
  const toClear: number[] = [];
  for (const ch of linked) {
    if (ch.chapterNumber === null || ch.volumeId === null) continue;
    const target = rangeMap.get(ch.volumeId);
    if (!target?.chapterStart || !target.chapterEnd) continue;
    if (ch.chapterNumber < target.chapterStart || ch.chapterNumber > target.chapterEnd) {
      toClear.push(ch.id);
    }
  }
  let clearedFKs = 0;
  if (toClear.length > 0) {
    const r = await prisma.chapter.updateMany({
      where: { id: { in: toClear } },
      data: { volumeId: null, volume: null },
    });
    clearedFKs = r.count;
  }

  logger.info(`[enrichmentPipeline] Manual volume manifest reapplied for manga ${mangaId}: ${applied} volume(s) updated, ${clearedFKs} chapter FKs cleared for re-link`);
  return { applied, clearedFKs };
}

/**
 * Writer for the sentinel — sets the manifest on a manga and returns the
 * updated providerMetadata JSON. Used by the seed script and (eventually)
 * a UI mutation.
 */
export async function writeManualVolumeManifest(
  mangaId: number,
  volumes: Record<string, ManualVolumeManifestEntry>,
  prisma: typeof defaultPrisma = defaultPrisma,
): Promise<void> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  const pm = (manga?.providerMetadata ?? {}) as Record<string, unknown>;
  const manualSection = (pm['manual'] && typeof pm['manual'] === 'object' && !Array.isArray(pm['manual']))
    ? { ...(pm['manual'] as Record<string, unknown>) }
    : {};
  manualSection['volumeManifest'] = {
    manual: true,
    setAt: new Date().toISOString(),
    volumes,
  };
  pm['manual'] = manualSection;
  await prisma.manga.update({ where: { id: mangaId }, data: { providerMetadata: pm as never } });
}
