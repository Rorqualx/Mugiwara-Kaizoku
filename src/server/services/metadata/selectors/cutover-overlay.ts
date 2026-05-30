/**
 * Phase 1.5 #12: selector cutover overlay.
 *
 * The legacy Object.assign chain in `enrichment-result-builder.ts` produces
 * the `metadata` Record + `perFieldProvenance` map the persister consumes.
 * After the full-corpus scorecard hit 100% across 71 manga × 23 fields
 * (2026-05-30 baseline), the selector takes over as the primary picker.
 *
 * This module is the bridge: it overlays the selector's winners onto the
 * legacy result so the persister sees selector picks. Fields the selector
 * couldn't pick (guard-refused or below reject threshold) keep their legacy
 * value — pure additive, no data loss.
 *
 * Also emits `fieldAlternatives` for `Metadata.fieldAlternatives` persistence
 * — the column that was added in Phase 1.5 #1 but had nothing writing to it
 * until now.
 */

import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

import type { ShadowSelection } from './shadow-mode';

export interface CutoverResult {
  /** Number of fields where the selector overrode the legacy pick. */
  fieldsOverlaid: number;
  /** Number of fields the selector couldn't pick (kept legacy). */
  fieldsSkipped: number;
  /** Fields where the selector refused due to drift-guard (kept legacy). */
  refusedFields: MetadataField[];
  /** Per-field dissenters for Metadata.fieldAlternatives write. */
  fieldAlternatives: Record<string, Array<{ provider: string; value: unknown; confidence: number }>>;
}

/**
 * Mutate `legacyMetadata` + `legacyProvenance` in place so they carry the
 * selector's picks. Returns a summary + the `fieldAlternatives` payload the
 * persister should write to `Metadata.fieldAlternatives`.
 *
 * Behavior per field:
 *  - Selector picked a winner with confidence above its type's threshold →
 *    overlay (replace legacy value + provenance).
 *  - Selector refused via drift-guard → keep legacy. Field appears in
 *    `refusedFields`.
 *  - Selector returned null (all candidates failed) → keep legacy if any,
 *    otherwise leave field unset.
 */
export function applySelectorCutover(
  shadow: ShadowSelection,
  legacyMetadata: Record<string, unknown>,
  legacyProvenance: Record<string, string>,
): CutoverResult {
  const result: CutoverResult = {
    fieldsOverlaid: 0,
    fieldsSkipped: 0,
    refusedFields: [...shadow.refusedFields],
    fieldAlternatives: {},
  };

  for (const [field, outcome] of shadow.outcomes) {
    if (outcome.guardRefused) {
      result.fieldsSkipped++;
      continue;
    }
    if (outcome.winnerProvider === null) {
      result.fieldsSkipped++;
      continue;
    }
    // Overlay: replace legacy pick with selector's winner.
    // eslint-disable-next-line no-param-reassign -- documented in-place overlay
    legacyMetadata[field] = outcome.winnerValue;
    // eslint-disable-next-line no-param-reassign -- documented in-place overlay
    legacyProvenance[field] = outcome.winnerProvider;
    result.fieldsOverlaid++;

    // Capture dissenters for the fieldAlternatives column.
    if (outcome.alternatives.length > 0) {
      result.fieldAlternatives[field] = outcome.alternatives.map(a => ({
        provider: a.provider,
        value: a.value,
        confidence: a.confidence,
      }));
    }
  }

  return result;
}
