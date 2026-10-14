/**
 * Merging the MediaWiki fallback's volume assignments into the map the
 * adaptive parser already built.
 *
 * The fallback scans the list page's text for "Volume N" markers and files
 * every chapter link after one under it. When the adaptive parser has already
 * read the page into a usable map, that map wins: the fallback only fills
 * chapters the adaptive parser never saw. SPY x FAMILY's adaptive map left
 * 128-141 out of any volume (not yet collected) and so held fewer entries
 * (127) than the fallback (142); the fallback then replaced the whole map and
 * filed 0 and 120-141 under a volume 18 that does not exist.
 *
 * @module fandom-mediawiki-fallback/volume-merge
 */

import { findCollapsedVolumeInMap } from '@/server/services/fandom/adaptive/orchestrator/collapsed-volume-guard';

import { isUnreliableVolumeMap } from '../fandom-volume-helpers/range-builders';

/**
 * The fallback assignments to write into `chapterVolumeMap`.
 *
 * @param seenChapters chapters an earlier Fandom source listed (with or
 *   without a volume), taken before the fallback added its own titles
 */
export function fallbackVolumesToApply(
  chapterVolumeMap: Readonly<Record<number, number>>,
  fallback: Readonly<Record<number, number>>,
  seenChapters: ReadonlySet<number>,
): Record<number, number> {
  const existingCount = Object.keys(chapterVolumeMap).length;
  const existingUsable = existingCount > 0
    && !isUnreliableVolumeMap({ ...chapterVolumeMap })
    && findCollapsedVolumeInMap({ ...chapterVolumeMap }) === null;
  if (!existingUsable && Object.keys(fallback).length >= existingCount) return { ...fallback };

  const knownVolumes = new Set(Object.values(chapterVolumeMap));
  const apply: Record<number, number> = {};
  for (const [k, v] of Object.entries(fallback)) {
    const num = Number(k);
    if (chapterVolumeMap[num]) continue;
    // A chapter the adaptive parser listed without a volume is not collected
    // yet, and a volume it never saw (SPY x FAMILY's "18") is not out yet.
    if (existingUsable && (seenChapters.has(num) || !knownVolumes.has(v))) continue;
    apply[num] = v;
  }
  return apply;
}
