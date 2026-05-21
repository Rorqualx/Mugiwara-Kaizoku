/**
 * Volume Coherence Check
 *
 * Detects out-of-order volume ranges after per-volume conflict resolution
 * and falls back to an alternative source that provides coherent ordering.
 *
 * For titles with monotonically ordered ranges (the common case),
 * this is a fast no-op.
 */

import { logger } from '@/utils/logger';

import type { ValidatedVolumeRange, VolumeRangeProposal } from './phase-volume-cross-validation';

const log = logger.child('VolumeCoherenceCheck');

/**
 * Ensure resolved volume ranges are globally coherent (monotonically ordered
 * by `chapterStart`). When violations are found, replace incoherent volumes
 * with ranges from an alternative source that IS coherent.
 *
 * @param resolved  Sorted (by volumeNumber) resolved ranges
 * @param proposals Raw proposals from all sources
 * @returns Coherent ranges — identical to input when already ordered
 */
export function sanitizeGlobalCoherence(
  resolved: ValidatedVolumeRange[],
  proposals: VolumeRangeProposal[],
): ValidatedVolumeRange[] {
  if (resolved.length <= 1) return resolved;

  // Identify volumes where chapterStart violates monotonic ordering
  const incoherent = new Set<number>();
  let highWaterStart = resolved[0]?.chapterStart ?? 0;

  for (let i = 1; i < resolved.length; i++) {
    const curr = resolved[i];
    if (!curr) continue;

    if (curr.chapterStart < highWaterStart) {
      // Current volume starts before a previous volume — both are suspect
      incoherent.add(curr.volumeNumber);
      // Also mark the volume that set the high water mark
      const prev = resolved[i - 1];
      if (prev) incoherent.add(prev.volumeNumber);
    } else {
      highWaterStart = curr.chapterStart;
    }
  }

  // Fast path: all ranges already monotonic
  if (incoherent.size === 0) return resolved;

  log.warn('Detected out-of-order volume ranges', {
    incoherentVolumes: [...incoherent].sort((a, b) => a - b),
  });

  const alternative = findCoherentAlternative(incoherent, proposals);
  if (!alternative) {
    log.warn('No coherent alternative found — preserving with reduced confidence');
    return resolved.map(r =>
      incoherent.has(r.volumeNumber)
        ? { ...r, confidence: Math.max(0.1, r.confidence - 0.3) }
        : r,
    );
  }

  // Replace incoherent volumes with the coherent alternative
  const result = resolved.map(r => {
    if (!incoherent.has(r.volumeNumber)) return r;
    const alt = alternative.get(r.volumeNumber);
    if (!alt) {
      // Preserve single-source range instead of dropping it.
      // validateConstraints() downstream will still catch anomalies.
      log.info('No alternative for incoherent volume — preserving with reduced confidence', {
        vol: r.volumeNumber,
      });
      return { ...r, confidence: Math.max(0.1, r.confidence - 0.3) };
    }
    // Preserve already-merged semantic fields from r; only override range + source
    return {
      ...r,
      chapterStart: alt.chapterStart,
      chapterEnd: alt.chapterEnd,
      confidence: alt.confidence,
      sources: [alt.source],
    } satisfies ValidatedVolumeRange;
  });

  log.info('Replaced incoherent ranges with alternative source', {
    replacedVolumes: [...incoherent].sort((a, b) => a - b),
    source: [...new Set([...alternative.values()].map(a => a.source))],
  });

  return result;
}

/**
 * Find a source whose proposals for the incoherent volumes are
 * monotonically ordered and don't overlap with each other.
 *
 * Returns a Map of volumeNumber → proposal for the best coherent source,
 * or null if no source is coherent.
 */
function findCoherentAlternative(
  incoherentVols: Set<number>,
  proposals: VolumeRangeProposal[],
): Map<number, VolumeRangeProposal> | null {
  // Group proposals for incoherent volumes by source
  const bySource = new Map<string, VolumeRangeProposal[]>();
  for (const p of proposals) {
    if (!incoherentVols.has(p.volumeNumber)) continue;
    const arr = bySource.get(p.source) ?? [];
    arr.push(p);
    bySource.set(p.source, arr);
  }

  let bestSource: Map<number, VolumeRangeProposal> | null = null;
  let bestCoverage = 0;

  for (const [source, sourceProposals] of bySource) {
    const sorted = [...sourceProposals].sort((a, b) => a.volumeNumber - b.volumeNumber);

    // Check monotonic ordering
    let monotonic = true;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (!prev || !curr) continue;
      if (curr.chapterStart <= prev.chapterStart || curr.chapterStart <= prev.chapterEnd) {
        monotonic = false;
        break;
      }
    }

    if (!monotonic) {
      log.debug('Source not coherent for incoherent volumes', { source });
      continue;
    }

    if (sorted.length > bestCoverage) {
      bestCoverage = sorted.length;
      bestSource = new Map(sorted.map(p => [p.volumeNumber, p]));
    }
  }

  return bestSource;
}
