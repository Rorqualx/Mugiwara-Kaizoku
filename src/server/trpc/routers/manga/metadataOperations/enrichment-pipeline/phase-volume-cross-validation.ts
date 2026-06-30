/**
 * Volume Cross-Validation Module
 *
 * Compares volume range proposals from multiple sources (ComicVine,
 * Wikipedia, Fandom) and produces a single validated set of volume
 * ranges using constraint validation and conflict resolution.
 *
 * Generic — no manga-specific logic or hardcoded ranges.
 */

import { logger } from '@/utils/logger';

import { sanitizeGlobalCoherence } from './phase-volume-coherence-check';
import { capVolumeCount, validateConstraints } from './phase-volume-cross-validation/constraint-validation';
import { resolveVolumeManifest } from './phase-volume-cross-validation/membership-consensus';
import { collectVolumeRangeProposals } from './phase-volume-cross-validation/proposal-collectors';

const log = logger.child('VolumeCrossValidation');

// ============================================================================
// Types
// ============================================================================

/** A proposed volume range from a single source */
export interface VolumeRangeProposal {
  volumeNumber: number;
  chapterStart: number;
  chapterEnd: number;
  source: 'comicvine' | 'wikipedia' | 'fandom' | 'mangadex';
  confidence: number;
  extractionMethod: 'explicit-range' | 'section-count' | 'cumulative' | 'table-parse';
  /**
   * iter-PVM-1: per-chapter list (integers + decimals like 5.1) when the
   * source exposes per-chapter granularity. Lets the membership-consensus
   * resolver (iter-PVM-3) vote per chapter rather than just per range.
   */
  chapters?: number[];
  /** Optional volume-level semantic data carried through cross-validation */
  title?: string;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
  publisher?: string;
  alternativeTitle?: string;
  pageCount?: number;
}

/** A validated volume range after cross-validation */
export interface ValidatedVolumeRange {
  volumeNumber: number;
  chapterStart: number;
  chapterEnd: number;
  confidence: number;
  sources: string[];
  /** Merged semantic data — first-non-empty-wins ordered by source confidence */
  title?: string;
  description?: string;
  coverImage?: string;
  releaseDate?: string;
  isbn?: string;
  publisher?: string;
  alternativeTitle?: string;
  pageCount?: number;
}

// ============================================================================
// Extraction Method Priority
// ============================================================================

const METHOD_PRIORITY: Record<string, number> = {
  'explicit-range': 4,
  'table-parse': 3,
  'section-count': 2,
  'cumulative': 1,
};

// Re-export for external consumers
export { collectVolumeRangeProposals };

/**
 * iter-PVM-N safety guard. Returns false when consensus output is structurally
 * bad in ways the downstream coherence pipeline can't always repair:
 *   - Adjacent volumes overlap (vol N+1 start <= vol N end)
 *   - Backwards ordering (vol N+1 start < vol N start)
 *   - A single volume claims an unreasonably large range (cap: 50 chapters)
 *   - Chapter numbers vastly exceed expectedChapterCount (>2x — likely overflow)
 *
 * When this fires, the caller bails to the legacy range-based path.
 */
function isConsensusStructurallySound(
  ranges: ValidatedVolumeRange[],
  expectedChapterCount: number | null,
): boolean {
  if (ranges.length === 0) return true;
  const sorted = [...ranges].sort((a, b) => a.volumeNumber - b.volumeNumber);

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    if (!r) continue;
    // Oversized volume — manga volumes typically hold 5-15 chapters
    if (r.chapterEnd - r.chapterStart + 1 > 50) return false;
    // Chapter number wildly above expected (e.g., 102/139 for a 16-chapter series)
    if (expectedChapterCount !== null && expectedChapterCount > 0 && r.chapterEnd > expectedChapterCount * 2) return false;
    if (i === 0) continue;
    const prev = sorted[i - 1];
    if (!prev) continue;
    // Backwards ordering
    if (r.chapterStart < prev.chapterStart) return false;
    // Overlap with previous volume
    if (r.chapterStart <= prev.chapterEnd) return false;
  }
  return true;
}

/**
 * Convert consensus manifest output into ValidatedVolumeRange[] for the
 * downstream persistence path. Pulls semantic fields (title/description/etc.)
 * from the proposals that contributed to each volume.
 */
function consensusToValidatedRanges(
  consensus: ReturnType<typeof resolveVolumeManifest>,
  proposals: VolumeRangeProposal[],
): ValidatedVolumeRange[] {
  const byVol = groupByVolume(proposals);
  const out: ValidatedVolumeRange[] = [];
  for (const [volKey, entry] of Object.entries(consensus.volumes)) {
    const volNum = Number(volKey);
    if (!Number.isFinite(volNum)) continue;
    const volProposals = byVol.get(volNum) ?? [];
    out.push({
      volumeNumber: volNum,
      chapterStart: entry.range[0],
      chapterEnd: entry.range[1],
      confidence: entry.confidence,
      sources: entry.sources,
      ...mergeSemanticFields(volProposals),
    });
  }
  out.sort((a, b) => a.volumeNumber - b.volumeNumber);
  return out;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Cross-validate volume range proposals from multiple sources.
 *
 * Groups proposals by volume number, resolves conflicts, validates
 * sequential constraints, and returns a single validated set.
 */
export function crossValidateVolumeRanges(
  rawProposals: VolumeRangeProposal[],
  expectedChapterCount: number | null,
  expectedVolumeCount?: number,
  trusted = false,
): ValidatedVolumeRange[] {
  if (rawProposals.length === 0) return [];

  // Refinement: truncate each source's own internal numbering discontinuity
  // BEFORE conflict resolution. ComicVine's description-parser can emit a
  // contiguous run (vols 1-10 = ch 1-45) then jump (vol 11 = ch 91-99); dropping
  // that tail at the proposal level lets a volume that ALSO has a valid in-range
  // proposal from another source (MangaDex vol 11 = ch 46-48) resolve to it
  // instead of being dropped wholesale by the resolved-range guard downstream.
  const proposals = truncateSourceDiscontinuities(rawProposals);
  if (proposals.length === 0) return [];

  // Group proposals by volume number (used by both consensus and legacy paths)
  const byVolume = groupByVolume(proposals);

  // iter-PVM-4: try membership-consensus first. When any proposal carries
  // per-chapter `chapters[]`, vote per chapter and produce ranges from the
  // grouped winners. Falls back to legacy range conflict resolution when no
  // proposal has per-chapter signal (older cached data path).
  const consensus = resolveVolumeManifest(proposals);
  if (consensus.hadSignal && Object.keys(consensus.volumes).length > 0) {
    const consensusRanges = consensusToValidatedRanges(consensus, proposals);
    // iter-PVM-N safety guard: bail to legacy when consensus output is
    // structurally bad (overlaps, backwards order, huge oversized volumes).
    // Surfaced by Attack on Titan: Before the Fall where upstream WP cached
    // chapters with overflow numbers (102, 139) for a 16-chapter series,
    // and CV's vol-15/16 descriptions both listed ch 60 — producing vol
    // 15=60..68 + vol 16=57..60 overlap that coherence couldn't unmangle.
    if (consensusRanges.length > 0 && isConsensusStructurallySound(consensusRanges, expectedChapterCount)) {
      // Run the SAME coherence/validation pipeline as the legacy path so
      // consensus output gets offset correction, coherence sanitization, gap
      // filling, constraint validation, and volume capping.
      const offsetCorrected = correctUniformOffset(consensusRanges, proposals, byVolume);
      const coherent = sanitizeGlobalCoherence(offsetCorrected, proposals);
      const gapFilled = fillSequenceGaps(coherent, byVolume);
      const constrained = validateConstraints(gapFilled, expectedChapterCount, trusted);
      return expectedVolumeCount ? capVolumeCount(constrained, expectedVolumeCount, trusted) : constrained;
    }
    log.warn('Consensus output failed structural-soundness guard — falling back to legacy', {
      consensusVolumes: consensusRanges.length,
      expectedChapterCount,
    });
  }

  // Resolve each volume's proposals into a single range
  const resolved: ValidatedVolumeRange[] = [];
  for (const [volNum, volProposals] of byVolume) {
    const result = resolveVolumeConflict(volNum, volProposals);
    if (result) resolved.push({ ...result, ...mergeSemanticFields(volProposals) });
  }

  // Sort by volume number
  resolved.sort((a, b) => a.volumeNumber - b.volumeNumber);

  // Detect and fix uniform offset between sources. When one source's ranges
  // are consistently shifted by the same amount (e.g., Fandom says Vol 1 = ch 5-8
  // while Wikipedia says ch 1-4), switch all volumes to the non-offset source.
  const offsetCorrected = correctUniformOffset(resolved, proposals, byVolume);

  // Fix out-of-order ranges by falling back to a coherent source
  const coherent = sanitizeGlobalCoherence(offsetCorrected, proposals);

  // Fill gaps caused by incompatible numbering across sources
  const gapFilled = fillSequenceGaps(coherent, byVolume);

  // Validate constraints on the full set
  const constrained = validateConstraints(gapFilled, expectedChapterCount, trusted);

  // Cap volume count to prevent runaway creation from inconsistent providers
  const validated = expectedVolumeCount
    ? capVolumeCount(constrained, expectedVolumeCount, trusted)
    : constrained;

  // Debug: log per-volume results and their proposals
  for (const v of validated) {
    const volProposals = byVolume.get(v.volumeNumber) ?? [];
    log.debug('Volume result', {
      vol: v.volumeNumber,
      start: v.chapterStart,
      end: v.chapterEnd,
      sources: v.sources,
      proposals: volProposals.map(p => ({ src: p.source, s: p.chapterStart, e: p.chapterEnd, c: p.confidence })),
    });
  }

  log.info('Cross-validated volume ranges', {
    inputProposals: proposals.length,
    uniqueVolumes: byVolume.size,
    outputRanges: validated.length,
    sources: [...new Set(proposals.map(p => p.source))],
  });

  return validated;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Merge semantic fields (title, description, coverImage, releaseDate) across
 * multiple proposals using first-non-empty-wins ordered by confidence then
 * extraction-method priority. Returns an object with only populated fields.
 */
type SemanticFields = Pick<ValidatedVolumeRange, 'title' | 'description' | 'coverImage' | 'releaseDate' | 'isbn' | 'publisher' | 'alternativeTitle' | 'pageCount'>;

const STRING_FIELDS: ReadonlyArray<keyof SemanticFields & ('title' | 'description' | 'coverImage' | 'releaseDate' | 'isbn' | 'publisher' | 'alternativeTitle')> =
  ['title', 'description', 'coverImage', 'releaseDate', 'isbn', 'publisher', 'alternativeTitle'];

function mergeSemanticFields(proposals: VolumeRangeProposal[]): SemanticFields {
  const sorted = [...proposals].sort((a, b) => {
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return (METHOD_PRIORITY[b.extractionMethod] ?? 0) - (METHOD_PRIORITY[a.extractionMethod] ?? 0);
  });
  const out: SemanticFields = {};
  for (const p of sorted) {
    for (const field of STRING_FIELDS) {
      if (out[field] !== undefined) continue;
      const value = p[field];
      if (typeof value === 'string' && value.trim().length > 0) out[field] = value;
    }
    if (out.pageCount === undefined && typeof p.pageCount === 'number' && p.pageCount > 0) out.pageCount = p.pageCount;
  }
  return out;
}

/**
 * Detect uniform offset between sources and correct it.
 * When two sources disagree consistently (e.g., Fandom offset by +4 from Wikipedia),
 * replaces affected volumes with the non-offset source's proposals.
 */
function correctUniformOffset(
  resolved: ValidatedVolumeRange[],
  proposals: VolumeRangeProposal[],
  byVolume: Map<number, VolumeRangeProposal[]>,
): ValidatedVolumeRange[] {
  const multiSourceVolumes = [...byVolume.entries()]
    .filter(([, ps]) => ps.length >= 2 && ps.some(p => p.source !== ps[0]?.source));
  if (multiSourceVolumes.length < 3) return resolved;

  const sourceStarts = buildSourceStartMap(proposals);
  const correction = detectOffsetCorrection(sourceStarts);
  if (!correction) return resolved;

  log.info('Detected uniform offset — correcting to non-offset source', {
    correctSource: correction, affectedVolumes: resolved.length,
  });

  return resolved.map(r => {
    const correct = byVolume.get(r.volumeNumber)?.find(p => p.source === correction);
    if (!correct) return r;
    // Preserve previously-merged semantic fields; only override range + source
    return { ...r, chapterStart: correct.chapterStart,
      chapterEnd: correct.chapterEnd, confidence: correct.confidence, sources: [correct.source] };
  });
}

/** Build a map of source -> (volumeNumber -> chapterStart) from all proposals */
function buildSourceStartMap(proposals: VolumeRangeProposal[]): Map<string, Map<number, number>> {
  const result = new Map<string, Map<number, number>>();
  for (const p of proposals) {
    const srcMap = result.get(p.source) ?? new Map<number, number>();
    srcMap.set(p.volumeNumber, p.chapterStart);
    result.set(p.source, srcMap);
  }
  return result;
}

/** Check all source pairs for a uniform offset; return the correct source name or null */
function detectOffsetCorrection(sourceStarts: Map<string, Map<number, number>>): string | null {
  const sources = [...sourceStarts.keys()];
  for (let i = 0; i < sources.length; i++) {
    const srcA = sources[i];
    const srcB = sources[i + 1];
    if (!srcA || !srcB) continue;
    const mapA = sourceStarts.get(srcA);
    const mapB = sourceStarts.get(srcB);
    if (!mapA || !mapB) continue;

    const commonVols = [...mapA.keys()].filter(v => mapB.has(v));
    if (commonVols.length < 3) continue;

    const offsets = commonVols.map(v => (mapB.get(v) ?? 0) - (mapA.get(v) ?? 0));
    if (!offsets.every(o => o === offsets[0]) || offsets[0] === 0) continue;

    const vol1A = mapA.get(1);
    const vol1B = mapB.get(1);
    if (vol1A !== undefined && vol1A <= 2) return srcA;
    if (vol1B !== undefined && vol1B <= 2) return srcB;
  }
  return null;
}

/**
 * A forward jump between a source's own consecutive volumes (by volume number)
 * larger than this many chapters marks an internal numbering discontinuity — no
 * real tankōbon volume spans more than ~20 chapters, so a gap this wide means the
 * provider's parser broke (ComicVine: vol 10 ends ch 45, vol 11 starts ch 91).
 */
const SOURCE_DISCONTINUITY_GAP = 20;
/** Require a contiguous baseline of this many volumes before treating a jump as a
 *  discontinuity, so a genuinely sparse listing isn't mistaken for a broken tail. */
const MIN_CONTIGUOUS_PREFIX = 2;

/**
 * Truncate each source's proposal list at its own internal numbering
 * discontinuity. Groups proposals by source, sorts each by volume number, and
 * drops every volume from the first oversized forward gap onward (once a
 * contiguous prefix has been established). Sources without a discontinuity
 * (MangaDex's vols 1-11 run contiguously into ch 46) are returned untouched.
 *
 * Operates purely on each source's internal chapter sequence — no dependency on
 * an external expected-chapter-count anchor, so it can't over-drop when the
 * anchor undercounts the real chapter total.
 */
export function truncateSourceDiscontinuities(
  proposals: VolumeRangeProposal[],
): VolumeRangeProposal[] {
  const bySource = new Map<string, VolumeRangeProposal[]>();
  for (const p of proposals) {
    const arr = bySource.get(p.source) ?? [];
    arr.push(p);
    bySource.set(p.source, arr);
  }

  const kept: VolumeRangeProposal[] = [];
  for (const [source, ps] of bySource) {
    const sorted = [...ps].sort((a, b) => a.volumeNumber - b.volumeNumber);
    let cut = sorted.length;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (!prev || !cur) continue;
      const gap = cur.chapterStart - prev.chapterEnd - 1;
      if (i >= MIN_CONTIGUOUS_PREFIX && gap > SOURCE_DISCONTINUITY_GAP) {
        cut = i;
        break;
      }
    }
    if (cut < sorted.length) {
      log.info('Truncated source proposals after numbering discontinuity', {
        source, kept: cut, dropped: sorted.length - cut,
        lastKeptEnd: sorted[cut - 1]?.chapterEnd, firstDroppedStart: sorted[cut]?.chapterStart,
      });
    }
    for (let i = 0; i < cut; i++) {
      const p = sorted[i];
      if (p) kept.push(p);
    }
  }
  return kept;
}

/** Group proposals by volume number */
function groupByVolume(proposals: VolumeRangeProposal[]): Map<number, VolumeRangeProposal[]> {
  const map = new Map<number, VolumeRangeProposal[]>();
  for (const p of proposals) {
    const arr = map.get(p.volumeNumber) ?? [];
    arr.push(p);
    map.set(p.volumeNumber, arr);
  }
  return map;
}

/**
 * Resolve conflict for a single volume number across multiple proposals.
 *
 * 1. If 2+ sources agree within 2 chapters -> consensus (average, round)
 * 2. If disagreement -> prefer higher confidence
 * 3. If tied confidence -> prefer higher extraction method priority
 * 4. Single source -> accept but reduce confidence by 0.2
 */
function resolveVolumeConflict(
  volumeNumber: number,
  proposals: VolumeRangeProposal[],
): ValidatedVolumeRange | null {
  if (proposals.length === 0) return null;

  if (proposals.length === 1) {
    const p = proposals[0];
    if (!p) return null;
    return {
      volumeNumber,
      chapterStart: p.chapterStart,
      chapterEnd: p.chapterEnd,
      confidence: Math.max(0.1, p.confidence - 0.2),
      sources: [p.source],
    };
  }

  // Check for consensus: pair of proposals agreeing within 2 chapters
  const consensus = findConsensus(proposals);
  if (consensus) return { volumeNumber, ...consensus };

  // Apply heuristics before falling back to best-pick
  const heuristic = applyVolumeHeuristics(volumeNumber, proposals);
  if (heuristic) return heuristic;

  const best = pickBestProposal(proposals);
  return {
    volumeNumber,
    chapterStart: best.chapterStart,
    chapterEnd: best.chapterEnd,
    confidence: best.confidence,
    sources: [best.source],
  };
}

/** Apply domain-specific heuristics for volume conflict resolution */
function applyVolumeHeuristics(
  volumeNumber: number,
  proposals: VolumeRangeProposal[],
): ValidatedVolumeRange | null {
  // Heuristic: Volume 1 must start at or near chapter 1. If the highest-confidence
  // source says Volume 1 starts at chapter 5+, prefer a source that starts at 1.
  if (volumeNumber === 1) {
    const startsAtOne = proposals.filter(p => p.chapterStart <= 2);
    const doesntStartAtOne = proposals.filter(p => p.chapterStart > 2);
    if (startsAtOne.length > 0 && doesntStartAtOne.length > 0) {
      const preferred = pickBestProposal(startsAtOne);
      log.info('Volume 1 offset correction: preferring source starting at chapter 1', {
        preferred: { s: preferred.chapterStart, e: preferred.chapterEnd, src: preferred.source },
        rejected: doesntStartAtOne.map(p => ({ s: p.chapterStart, e: p.chapterEnd, src: p.source })),
      });
      return {
        volumeNumber,
        chapterStart: preferred.chapterStart,
        chapterEnd: preferred.chapterEnd,
        confidence: preferred.confidence,
        sources: [preferred.source],
      };
    }
  }

  // Guard against anomalous ranges: single-chapter volume is almost always a data error
  const best = pickBestProposal(proposals);
  const bestCount = best.chapterEnd - best.chapterStart + 1;
  if (bestCount <= 2 && proposals.length >= 2) {
    const alternative = proposals.find(
      p => p !== best && (p.chapterEnd - p.chapterStart + 1) >= 4,
    );
    if (alternative) {
      log.info('Overriding anomalous best proposal with wider alternative', {
        vol: volumeNumber,
        best: { s: best.chapterStart, e: best.chapterEnd, src: best.source },
        alternative: { s: alternative.chapterStart, e: alternative.chapterEnd, src: alternative.source },
      });
      return {
        volumeNumber,
        chapterStart: alternative.chapterStart,
        chapterEnd: alternative.chapterEnd,
        confidence: alternative.confidence,
        sources: [alternative.source],
      };
    }
  }

  return null;
}

/** Find consensus among proposals within 2-chapter tolerance.
 *  Prefers multi-source consensus (all 3 agree) over pairwise (2 agree). */
function findConsensus(
  proposals: VolumeRangeProposal[],
): { chapterStart: number; chapterEnd: number; confidence: number; sources: string[] } | null {
  // First: check if ALL proposals agree within tolerance (best consensus)
  if (proposals.length >= 3) {
    const multiConsensus = findMultiSourceConsensus(proposals);
    if (multiConsensus) return multiConsensus;
  }

  // Fallback: pairwise consensus
  for (let i = 0; i < proposals.length; i++) {
    const a = proposals[i];
    if (!a) continue;
    const matched = findMatchingProposal(a, proposals, i + 1);
    if (matched) return matched;
  }
  return null;
}

/** Check if all proposals agree within 2-chapter tolerance and return their consensus */
function findMultiSourceConsensus(
  proposals: VolumeRangeProposal[],
): { chapterStart: number; chapterEnd: number; confidence: number; sources: string[] } | null {
  // Check every pair is within tolerance
  for (let i = 0; i < proposals.length; i++) {
    const a = proposals[i];
    if (!a) continue;
    for (let j = i + 1; j < proposals.length; j++) {
      const b = proposals[j];
      if (!b) continue;
      if (Math.abs(a.chapterStart - b.chapterStart) > 2 || Math.abs(a.chapterEnd - b.chapterEnd) > 2) {
        return null; // At least one pair disagrees
      }
    }
  }

  // All proposals agree within tolerance.
  // Use min for start (conservative — avoid missing chapters at beginning).
  // Use median for end — filters outliers where one source (e.g. Wikipedia table-parse)
  // inflates the count by including bonus chapters. Median lets the majority rule:
  //   [6, 8, 6] -> median 6 (two sources agree, Wikipedia's 8 is the outlier)
  const consStart = Math.round(Math.min(...proposals.map(p => p.chapterStart)));
  const sortedEnds = proposals.map(p => p.chapterEnd).sort((a, b) => a - b);
  const medianEnd = sortedEnds[Math.floor(sortedEnds.length / 2)] ?? sortedEnds[0] ?? consStart;
  const consEnd = Math.round(medianEnd);
  if (consEnd < consStart) return null;
  const maxConf = Math.max(...proposals.map(p => p.confidence));
  return {
    chapterStart: consStart,
    chapterEnd: consEnd,
    confidence: Math.min(1.0, maxConf + 0.15),
    sources: [...new Set(proposals.map(p => p.source))],
  };
}

/** Check if proposal `a` matches with another proposal starting from index `startIdx` */
function findMatchingProposal(
  a: VolumeRangeProposal,
  proposals: VolumeRangeProposal[],
  startIdx: number,
): { chapterStart: number; chapterEnd: number; confidence: number; sources: string[] } | null {
  for (let j = startIdx; j < proposals.length; j++) {
    const b = proposals[j];
    if (!b) continue;
    const startDiff = Math.abs(a.chapterStart - b.chapterStart);
    const endDiff = Math.abs(a.chapterEnd - b.chapterEnd);

    if (startDiff <= 2 && endDiff <= 2) {
      // Use higher-confidence proposal's chapterEnd (tiebreak: method priority)
      // to prevent lower-confidence sources from inflating volume ranges.
      const higher = a.confidence > b.confidence ? a
        : b.confidence > a.confidence ? b
        : (METHOD_PRIORITY[a.extractionMethod] ?? 0) >= (METHOD_PRIORITY[b.extractionMethod] ?? 0) ? a : b;
      return {
        chapterStart: Math.round(Math.min(a.chapterStart, b.chapterStart)),
        chapterEnd: Math.round(higher.chapterEnd),
        confidence: Math.min(1.0, Math.max(a.confidence, b.confidence) + 0.1),
        sources: [...new Set([a.source, b.source])],
      };
    }
  }
  return null;
}

/** Pick the single best proposal by confidence then method priority */
function pickBestProposal(proposals: VolumeRangeProposal[]): VolumeRangeProposal {
  const sorted = [...proposals].sort((a, b) => {
    if (a.confidence !== b.confidence) return b.confidence - a.confidence;
    return (METHOD_PRIORITY[b.extractionMethod] ?? 0) - (METHOD_PRIORITY[a.extractionMethod] ?? 0);
  });
  // sorted is non-empty since we only call this with proposals.length >= 1
  const best = sorted[0];
  if (!best) return proposals[0] as VolumeRangeProposal;
  return best;
}

/**
 * Fill gaps in the sequence by replacing gapped volumes with contiguous alternatives.
 *
 * When sources use incompatible numbering (e.g., one counts bonuses, another doesn't),
 * the resolved ranges may have gaps. For each gap, check if an alternative proposal
 * from a different source would be contiguous with the previous volume.
 */
function fillSequenceGaps(
  ranges: ValidatedVolumeRange[],
  byVolume: Map<number, VolumeRangeProposal[]>,
): ValidatedVolumeRange[] {
  const first = ranges[0];
  if (ranges.length <= 1 || !first) return ranges;

  const result = [first];

  for (let i = 1; i < ranges.length; i++) {
    const prev = result[result.length - 1];
    const curr = ranges[i];
    if (!prev || !curr) continue;
    const gap = curr.chapterStart - prev.chapterEnd - 1;

    if (gap <= 2) {
      result.push(curr);
      continue;
    }

    // Gap detected — try to find a contiguous alternative from the proposals
    const proposals = byVolume.get(curr.volumeNumber) ?? [];
    const contiguous = findContiguousProposal(proposals, prev.chapterEnd);

    if (contiguous) {
      log.info('Filled sequence gap with contiguous proposal', {
        vol: curr.volumeNumber,
        original: { start: curr.chapterStart, end: curr.chapterEnd },
        replacement: { start: contiguous.chapterStart, end: contiguous.chapterEnd, source: contiguous.source },
        gap,
      });
      // Preserve already-merged semantic fields on curr; only override range + source
      result.push({
        ...curr,
        chapterStart: contiguous.chapterStart,
        chapterEnd: contiguous.chapterEnd,
        confidence: contiguous.confidence,
        sources: [contiguous.source],
      });
      continue;
    }

    result.push(curr);
  }

  return result;
}

/** Find the proposal whose chapterStart is closest to prevEnd + 1 (contiguous) */
function findContiguousProposal(
  proposals: VolumeRangeProposal[],
  prevEnd: number,
): VolumeRangeProposal | null {
  const expectedStart = prevEnd + 1;
  let best: VolumeRangeProposal | null = null;
  let bestDist = Infinity;

  for (const p of proposals) {
    const dist = Math.abs(p.chapterStart - expectedStart);
    if (dist <= 2 && dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }

  return best;
}
