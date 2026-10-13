/**
 * Range-only proposals in the membership-consensus path.
 *
 * The consensus votes chapter by chapter, so only proposals that carry a
 * per-chapter list take part. A source that gives a volume's range but not
 * its chapters (Fandom's volume table) was silently left out: when MangaDex's
 * aggregate was the only per-chapter source, the result held just the
 * volumes MangaDex tagged. Sakamoto Days kept 4 of its 28 volumes; Fandom's
 * correct ranges for the other 24 never reached the database.
 *
 * Pure: no database, no network.
 */

import type { ValidatedVolumeRange, VolumeRangeProposal } from '../phase-volume-cross-validation';

type Resolve = (volumeNumber: number, proposals: VolumeRangeProposal[]) => ValidatedVolumeRange | null;

function hasChapters(p: VolumeRangeProposal): boolean {
  return p.chapters !== undefined && p.chapters.length > 0;
}

function disjoint(range: { chapterStart: number; chapterEnd: number }, p: VolumeRangeProposal): boolean {
  return range.chapterEnd < p.chapterStart || range.chapterStart > p.chapterEnd;
}

/**
 * Consensus ranges with the volumes only range-only proposals speak to added,
 * each resolved from those proposals as the range path would.
 *
 * Also replaces a consensus volume whose chapters come from one source alone
 * when every other source's range for that volume shares none of them: a
 * lone chapter MangaDex files under volume 25 (232, which is volume 26's)
 * against Fandom's 218-226.
 */
export function withRangeOnlyVolumes(
  consensusRanges: ValidatedVolumeRange[],
  byVolume: Map<number, VolumeRangeProposal[]>,
  resolve: Resolve,
): ValidatedVolumeRange[] {
  const byNumber = new Map(consensusRanges.map(r => [r.volumeNumber, r]));
  for (const [volumeNumber, proposals] of byVolume) {
    const rangeOnly = proposals.filter(p => !hasChapters(p));
    if (rangeOnly.length === 0) continue;
    const voters = new Set(proposals.filter(hasChapters).map(p => p.source));
    const current = byNumber.get(volumeNumber);
    if (current === undefined) {
      if (voters.size > 0) continue;
      const resolved = resolve(volumeNumber, rangeOnly);
      if (resolved) byNumber.set(volumeNumber, resolved);
      continue;
    }
    if (voters.size !== 1) continue;
    const others = rangeOnly.filter(p => !voters.has(p.source));
    if (others.length === 0 || !others.every(p => disjoint(current, p))) continue;
    const resolved = resolve(volumeNumber, others);
    if (resolved) byNumber.set(volumeNumber, { ...current, ...resolved });
  }
  return [...byNumber.values()].sort((a, b) => a.volumeNumber - b.volumeNumber);
}
