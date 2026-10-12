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

/** Fandom's per-chapter pages: how many were asked for and how many came back. */
export function noteFandomChapterPages(
  options: EnrichmentPipelineOptions | undefined,
  requested: number,
  fetched: number,
): void {
  options?.claimRun?.noteStage('fandom', 'chapterPages', { requested, fetched });
}
