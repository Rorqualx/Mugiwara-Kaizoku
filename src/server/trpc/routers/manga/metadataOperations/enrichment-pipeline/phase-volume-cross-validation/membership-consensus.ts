/**
 * iter-PVM-3: chapter-membership consensus resolver.
 *
 * The architectural fix for "CV's raw start_issue/last_issue is wrong":
 * instead of voting on volume *ranges* (each source emits [start, end] and
 * we pick the best), vote on volume *membership* (each source emits a
 * per-chapter list, and for every chapter we pick the volume claimed by
 * the most sources, with priority tie-breaks).
 *
 * Output schema mirrors `manual-volume-manifest-sentinel.ts` —
 * `{ range, bonus[] }` per volume — so consensus and manual paths agree on
 * the contract.
 *
 * Falls back to nothing when no proposals carry per-chapter signal; the
 * caller should keep the legacy range-based `crossValidateVolumeRanges`
 * as the fallback path for that case.
 */

import type { VolumeRangeProposal } from '../phase-volume-cross-validation';

export interface ConsensusVolumeEntry {
  range: [number, number];
  bonus: number[];
  sources: string[];
  confidence: number;
}

export interface ConsensusVolumeManifest {
  volumes: Record<string, ConsensusVolumeEntry>;
  conflictChapters: Array<{ chapter: number; claimedBy: number[]; winner: number }>;
  hadSignal: boolean;
}

/**
 * Source priority for chapter→volume tie-breaks. Mangadex's aggregate is the
 * most reliable per-chapter signal in practice (publishers submit volume keys
 * directly). Wikipedia comes next (publisher tankobon tables). MU releases
 * are authoritative for English print runs. CV is per-volume Contents lists,
 * Fandom is fan-curated.
 */
const SOURCE_PRIORITY: Record<string, number> = {
  mangadex: 0,
  wikipedia: 1,
  mangaupdates: 2,
  comicvine: 3,
  fandom: 4,
};

function bestPriority(sources: string[]): number {
  let min = Number.POSITIVE_INFINITY;
  for (const s of sources) {
    const p = SOURCE_PRIORITY[s] ?? 99;
    if (p < min) min = p;
  }
  return min;
}

/**
 * iter-PVM-3.1: MangaDex emits "release-part" decimals (e.g. 34.1, 34.2 when
 * one canonical chapter is published in multiple parts). Those are NOT real
 * bonus chapters — the canonical chapter is `34`. Detect this by checking
 * whether floor(D) appears as an integer in ANY source's chapter list;
 * if yes, the decimal is a release-part → floor it. If no other source emits
 * the integer, keep the decimal (genuine bonus chapter).
 */
function buildIntegerCorpus(proposals: VolumeRangeProposal[]): Set<number> {
  const ints = new Set<number>();
  for (const p of proposals) {
    if (!p.chapters) continue;
    for (const ch of p.chapters) {
      if (Number.isInteger(ch) && ch > 0) ints.add(ch);
    }
  }
  return ints;
}

function normalizeChapter(ch: number, integerCorpus: Set<number>): number {
  if (Number.isInteger(ch)) return ch;
  const floored = Math.floor(ch);
  return integerCorpus.has(floored) ? floored : ch;
}

/**
 * Run the membership consensus. Accepts the full proposal list — only
 * proposals carrying `chapters[]` contribute; the rest are silently ignored.
 */
export function resolveVolumeManifest(proposals: VolumeRangeProposal[]): ConsensusVolumeManifest {
  const integerCorpus = buildIntegerCorpus(proposals);
  // chapter # -> volume # -> [sources that voted this assignment]
  const chapterVotes = new Map<number, Map<number, string[]>>();
  let hadSignal = false;
  for (const p of proposals) {
    if (!p.chapters || p.chapters.length === 0) continue;
    hadSignal = true;
    for (const rawCh of p.chapters) {
      if (!Number.isFinite(rawCh) || rawCh <= 0) continue;
      const ch = normalizeChapter(rawCh, integerCorpus);
      const volMap = chapterVotes.get(ch) ?? new Map<number, string[]>();
      const list = volMap.get(p.volumeNumber) ?? [];
      list.push(p.source);
      volMap.set(p.volumeNumber, list);
      chapterVotes.set(ch, volMap);
    }
  }

  if (!hadSignal) return { volumes: {}, conflictChapters: [], hadSignal: false };

  const conflicts: ConsensusVolumeManifest['conflictChapters'] = [];
  // chapter -> winning volume, with sources that voted for it
  const winners = new Map<number, { volume: number; sources: string[] }>();
  for (const [ch, volMap] of chapterVotes) {
    if (volMap.size === 1) {
      const entry = [...volMap.entries()][0];
      if (!entry) continue;
      winners.set(ch, { volume: entry[0], sources: entry[1] });
      continue;
    }
    // Multi-claim — pick by (most votes) → (best source priority among voters)
    const ranked = [...volMap.entries()].sort((a, b) => {
      if (a[1].length !== b[1].length) return b[1].length - a[1].length;
      return bestPriority(a[1]) - bestPriority(b[1]);
    });
    const top = ranked[0];
    if (!top) continue;
    winners.set(ch, { volume: top[0], sources: top[1] });
    conflicts.push({ chapter: ch, claimedBy: [...volMap.keys()], winner: top[0] });
  }

  // Group winning chapters by volume
  const byVol = new Map<number, { chapters: number[]; sources: Set<string> }>();
  for (const [ch, { volume, sources }] of winners) {
    const entry = byVol.get(volume) ?? { chapters: [], sources: new Set<string>() };
    entry.chapters.push(ch);
    for (const s of sources) entry.sources.add(s);
    byVol.set(volume, entry);
  }

  const out: ConsensusVolumeManifest = { volumes: {}, conflictChapters: conflicts, hadSignal: true };
  for (const [vol, { chapters, sources }] of byVol) {
    chapters.sort((a, b) => a - b);
    const integerCh = chapters.filter(c => Number.isInteger(c));
    const bonusCh = chapters.filter(c => !Number.isInteger(c));
    const first = integerCh[0];
    const last = integerCh[integerCh.length - 1];
    if (first === undefined || last === undefined) continue;
    out.volumes[String(vol)] = {
      range: [first, last],
      bonus: bonusCh,
      sources: [...sources],
      confidence: Math.min(1, 0.5 + 0.15 * sources.size),
    };
  }
  return out;
}
