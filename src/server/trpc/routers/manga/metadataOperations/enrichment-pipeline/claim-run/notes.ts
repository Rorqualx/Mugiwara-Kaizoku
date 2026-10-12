/**
 * Record points that sit inside functions already at their complexity limit:
 * the optional-recorder check lives here so the call site stays one plain call.
 */

import { crossValidateVolumeRanges, type ValidatedVolumeRange, type VolumeRangeProposal } from '../phase-volume-cross-validation';

import type { EnrichmentPipelineOptions } from '../types';

/**
 * Cross-validate the volume-range proposals, recording every source's ranges
 * as they go in — before the different-edition drop, the discontinuity
 * truncation and the chapter gate inside — and which ranges came out.
 */
export function crossValidateRecorded(
  options: EnrichmentPipelineOptions | undefined,
  proposals: VolumeRangeProposal[],
  gate: { expectedChapterCount: number | null; expectedVolumeCount: number; volumeTrusted: boolean },
): ValidatedVolumeRange[] {
  options?.claimRun?.noteManifests(proposals);
  const validated = crossValidateVolumeRanges(
    proposals, gate.expectedChapterCount, gate.expectedVolumeCount, gate.volumeTrusted,
  );
  options?.claimRun?.noteValidatedRanges(validated);
  return validated;
}

/**
 * The reconciliation phase's own cross-series gate: it withholds Fandom's
 * chapter list from chapter reconciliation when the list looks cross-series.
 * Fired when chapters went in and none came out. The lists themselves are
 * left on the result, so nothing pre-gate needs keeping.
 */
export function noteReconciliationGate(
  options: EnrichmentPipelineOptions | undefined,
  before: number,
  after: number,
  counts: { mangadex: number; anilist: number },
): void {
  if (before === 0 || after > 0) return;
  options?.claimRun?.noteGated(
    'fandom', `reconciliation gate: ${before} chapters vs AniList ${counts.anilist} / MangaDex ${counts.mangadex}`, {},
  );
}

/** Fandom's per-chapter pages: how many were asked for and how many came back. */
export function noteFandomChapterPages(
  options: EnrichmentPipelineOptions | undefined,
  requested: number,
  fetched: number,
): void {
  options?.claimRun?.noteStage('fandom', 'chapterPages', { requested, fetched });
}
