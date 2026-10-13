/**
 * Volume boundaries decided by agreement between sources.
 *
 * Two rules, both about the chapter where one volume ends and the next begins:
 *
 * 1. When two or more sources give a volume the same start (or end), a single
 *    source that disagrees cannot move it. The range vote used to take the
 *    lowest start of every source within two chapters, so ComicVine's counted
 *    guess for Dr. STONE volume 3 (16-24) beat Wikipedia and MangaDex agreeing
 *    on 17-25, and volume 3 shared chapter 16 with volume 2.
 *
 * 2. A merged result never has two neighbouring volumes sharing a whole
 *    chapter unless every source that reports both volumes says they share it
 *    (Solo Leveling: ComicVine, the only source, lists chapter 3 at the end of
 *    volume 1 and the start of volume 2 — a chapter split across the print
 *    volumes). Otherwise the boundary the non-sharing sources give is applied.
 */

import { logger } from '@/utils/logger';

import type { ValidatedVolumeRange, VolumeRangeProposal } from '../phase-volume-cross-validation';

const log = logger.child('VolumeBoundaryVote');

/** Tie-break between boundaries that the same number of sources give. */
const BOUNDARY_SOURCE_PRIORITY: Record<string, number> = {
  mangadex: 0,
  wikipedia: 1,
  fandom: 2,
  comicvine: 3,
};

/**
 * The value at least two proposals give, when no other value has as many.
 * Null when no value is shared or two values tie.
 */
export function agreedValue(values: number[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || top[1] < 2) return null;
  if (ranked[1] && ranked[1][1] === top[1]) return null;
  return top[0];
}

/** One proposal per source for a volume (the first one listed). */
function bySource(proposals: VolumeRangeProposal[]): Map<string, VolumeRangeProposal> {
  const out = new Map<string, VolumeRangeProposal>();
  for (const p of proposals) if (!out.has(p.source)) out.set(p.source, p);
  return out;
}

interface Boundary { prevEnd: number; curStart: number; sources: string[] }

/** The clean boundaries (no shared chapter) the given sources report, most supported first. */
function rankCleanBoundaries(reporters: Array<{ source: string; prev: VolumeRangeProposal; cur: VolumeRangeProposal }>): Boundary[] {
  const byKey = new Map<string, Boundary>();
  for (const r of reporters) {
    if (Math.floor(r.prev.chapterEnd) >= Math.ceil(r.cur.chapterStart)) continue;
    const key = `${r.prev.chapterEnd}|${r.cur.chapterStart}`;
    const entry = byKey.get(key) ?? { prevEnd: r.prev.chapterEnd, curStart: r.cur.chapterStart, sources: [] };
    entry.sources.push(r.source);
    byKey.set(key, entry);
  }
  const best = (b: Boundary): number => Math.min(...b.sources.map(s => BOUNDARY_SOURCE_PRIORITY[s] ?? 9));
  return [...byKey.values()].sort((a, b) => b.sources.length - a.sources.length || best(a) - best(b));
}

/**
 * Remove whole chapters shared by neighbouring volumes unless every source
 * reporting both volumes shares them too. Ranges are returned in the input
 * order; only chapterEnd of the earlier and chapterStart of the later volume
 * change.
 */
export function separateSharedBoundaries(
  ranges: ValidatedVolumeRange[],
  byVolume: Map<number, VolumeRangeProposal[]>,
): ValidatedVolumeRange[] {
  const out = ranges.map(r => ({ ...r }));
  const sorted = [...out].sort((a, b) => a.volumeNumber - b.volumeNumber);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (!prev || !cur) continue;
    // A decimal extra (88.5 next to 89) is not a shared whole chapter.
    if (Math.floor(prev.chapterEnd) < Math.ceil(cur.chapterStart)) continue;

    const prevBySource = bySource(byVolume.get(prev.volumeNumber) ?? []);
    const curBySource = bySource(byVolume.get(cur.volumeNumber) ?? []);
    const reporters = [...prevBySource.entries()]
      .map(([source, p]) => ({ source, prev: p, cur: curBySource.get(source) }))
      .filter((r): r is { source: string; prev: VolumeRangeProposal; cur: VolumeRangeProposal } => r.cur !== undefined);
    const clean = rankCleanBoundaries(reporters);
    if (reporters.length > 0 && clean.length === 0) continue; // every reporter says the chapter is shared

    const boundary = clean[0];
    // No source reports both volumes: the later volume keeps its start.
    const prevEnd = boundary
      ? Math.min(prev.chapterEnd, Math.max(boundary.prevEnd, cur.chapterStart - 1))
      : cur.chapterStart - 1;
    const curStart = Math.max(cur.chapterStart, Math.floor(prevEnd) + 1);
    if (prevEnd < prev.chapterStart || curStart > cur.chapterEnd) continue;

    log.info('Separated a chapter shared by neighbouring volumes', {
      volumes: [prev.volumeNumber, cur.volumeNumber],
      before: [prev.chapterEnd, cur.chapterStart],
      after: [prevEnd, curStart],
      boundarySources: boundary?.sources ?? [],
    });
    prev.chapterEnd = prevEnd;
    cur.chapterStart = curStart;
  }
  return out;
}
