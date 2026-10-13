/**
 * Collapsed-volume guard.
 *
 * A wiki page parsed with the wrong parser (or a partial page such as a
 * series overview or a Category listing) can come back with every chapter
 * filed under one volume — Sakamoto Days once had all 278 chapters filed
 * under volume 28; Call of the Night's tabbed page parses as all 202 chapters
 * repeated under each of its 20 volumes. No tankōbon holds dozens of
 * chapters, so such an assignment is dropped: the chapters are kept, the
 * volume numbers are not.
 *
 * @module orchestrator/collapsed-volume-guard
 */

import { logger } from '@/utils/logger';

import type { StandardParsedData } from './result-converters';

/** A single volume may not claim this many chapters when it holds most of the list. */
export const COLLAPSED_VOLUME_MIN_CHAPTERS = 40;
/** Share of all volume-assigned chapters one volume must hold to count as collapsed. */
const COLLAPSED_VOLUME_SHARE = 0.8;

function chapterNumberOf(ch: unknown): number | null {
  if (typeof ch !== 'object' || ch === null) return null;
  const rec = ch as { number?: unknown; chapterNumber?: unknown };
  const n = typeof rec.number === 'number' ? rec.number : Number(rec.chapterNumber ?? rec.number);
  return Number.isFinite(n) ? n : null;
}

/** volume → distinct chapter numbers it claims, over flat and volume-nested chapters. */
function collectClaims(data: StandardParsedData): Map<number, Set<number>> {
  const claims = new Map<number, Set<number>>();
  const claim = (vol: number, ch: number): void => {
    const set = claims.get(vol) ?? new Set<number>();
    set.add(ch);
    claims.set(vol, set);
  };
  for (const ch of data.chapters) if (typeof ch.volume === 'number') claim(ch.volume, ch.number);
  for (const vol of data.volumes) {
    for (const ch of vol.chapters ?? []) {
      const n = chapterNumberOf(ch);
      if (n !== null) claim(vol.number, n);
    }
  }
  return claims;
}

/** Volumes that each claim ≥40 chapters and ≥80% of all volume-assigned chapters. */
function collapsedVolumes(claims: Map<number, Set<number>>): number[] {
  const assigned = new Set<number>();
  for (const set of claims.values()) for (const n of set) assigned.add(n);
  if (assigned.size < COLLAPSED_VOLUME_MIN_CHAPTERS) return [];
  return [...claims.entries()]
    .filter(([, set]) => set.size >= COLLAPSED_VOLUME_MIN_CHAPTERS && set.size >= assigned.size * COLLAPSED_VOLUME_SHARE)
    .map(([vol]) => vol);
}

/** The collapsed volume among chapter → volume assignments, or null. */
export function findCollapsedVolumeInMap(volumeByChapter: Readonly<Record<number, number>>): number | null {
  const claims = new Map<number, Set<number>>();
  for (const [ch, vol] of Object.entries(volumeByChapter)) {
    const set = claims.get(vol) ?? new Set<number>();
    set.add(Number(ch));
    claims.set(vol, set);
  }
  return collapsedVolumes(claims)[0] ?? null;
}

/**
 * Volumes whose chapter claims are implausible (one volume holding nearly the
 * whole list). Empty when the assignment is plausible.
 */
export function findCollapsedVolumes(data: StandardParsedData): number[] {
  return collapsedVolumes(collectClaims(data));
}

/**
 * Drop collapsed volume assignments in place: chapters filed under such a
 * volume lose their volume number and the volume entry loses its nested
 * chapter list. Returns the dropped volume numbers (empty when nothing changed).
 */
export function dropCollapsedVolumeAssignment(data: StandardParsedData, source: string): number[] {
  const vols = findCollapsedVolumes(data);
  if (vols.length === 0) return [];
  const drop = new Set(vols);
  const claimed = new Set<number>();
  for (const ch of data.chapters) {
    if (ch.volume !== undefined && drop.has(ch.volume)) { claimed.add(ch.number); delete ch.volume; }
  }
  for (const v of data.volumes) {
    if (!drop.has(v.number) || !Array.isArray(v.chapters)) continue;
    for (const ch of v.chapters) { const n = chapterNumberOf(ch); if (n !== null) claimed.add(n); }
    v.chapters = [];
  }
  logger.warn(`[adaptiveParse] ${source}: volume(s) ${vols.join(', ')} each claimed most of ${claimed.size} chapters — volume assignment rejected, chapters kept without a volume`);
  return vols;
}
