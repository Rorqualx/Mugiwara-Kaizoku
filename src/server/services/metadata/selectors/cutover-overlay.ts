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
 * value — with one exception: an objective field the selector abstained on
 * while a value is already stored is withheld from the write altogether, so
 * the stored value survives (see `withholdAbstainedField`).
 *
 * Also emits `fieldAlternatives` for `Metadata.fieldAlternatives` persistence
 * — the column that was added in Phase 1.5 #1 but had nothing writing to it
 * until now.
 */

import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

import { OBJECTIVE_REVIEW_FIELDS, type FieldReviewMap } from '../field-review';

import { adoptColumnProvenanceKeys, writeWinnerToColumn } from './column-mapping';

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
  /** Objective fields committed at low confidence / abstained → review badge. */
  fieldReview: FieldReviewMap;
}

/**
 * Mutate `legacyMetadata` + `legacyProvenance` in place so they carry the
 * selector's picks. Returns a summary + the `fieldAlternatives` payload the
 * persister should write to `Metadata.fieldAlternatives`.
 *
 * Behavior per field:
 *  - Selector picked a winner with confidence above its type's threshold →
 *    overlay (replace legacy value + provenance), written under the key the
 *    persister reads and stamped under the column name (column-mapping.ts).
 *    Summary keeps a legacy description of 80+ characters; synonyms are the
 *    legacy list plus the selector's additions.
 *  - Selector refused via drift-guard → keep legacy. Field appears in
 *    `refusedFields`.
 *  - Selector returned null (all candidates failed) → keep legacy if any,
 *    otherwise leave field unset. For an objective field with dissent and a
 *    value in `storedValues`, the legacy value is removed instead so the
 *    persister keeps what is stored.
 *
 * `storedValues` is the currently persisted Metadata row (objective fields are
 * enough). Omit it, or leave a field empty, for a title with nothing stored —
 * the legacy value is then the only one available and stays.
 */
export function applySelectorCutover(
  shadow: ShadowSelection,
  legacyMetadata: Record<string, unknown>,
  legacyProvenance: Record<string, string>,
  storedValues: Readonly<Record<string, unknown>> = {},
): CutoverResult {
  const result: CutoverResult = {
    fieldsOverlaid: 0,
    fieldsSkipped: 0,
    refusedFields: [...shadow.refusedFields],
    fieldAlternatives: {},
    fieldReview: {},
  };

  for (const [field, outcome] of shadow.outcomes) {
    const objective = OBJECTIVE_REVIEW_FIELDS.has(field);

    if (outcome.guardRefused) {
      result.fieldsSkipped++;
      continue;
    }
    if (outcome.winnerProvider === null) {
      result.fieldsSkipped++;
      // Abstain on an objective field with dissent → flag for review and
      // capture the alternatives (this branch otherwise records nothing).
      if (objective && outcome.alternatives.length > 0) {
        result.fieldReview[field] = { state: 'abstained' };
        result.fieldAlternatives[field] = outcome.alternatives.map(a => ({
          provider: a.provider, value: a.value, confidence: a.confidence,
        }));
        if (hasStoredValue(storedValues[field])) withholdAbstainedField(field, legacyMetadata, legacyProvenance);
      }
      continue;
    }
    // Overlay: replace legacy pick with selector's winner, under the key the
    // persister reads. For summary and synonyms the legacy value may be kept
    // or merged instead (decision D3) — see column-mapping.ts.
    const written = writeWinnerToColumn(
      field, { value: outcome.winnerValue, provider: outcome.winnerProvider }, legacyMetadata, legacyProvenance,
    );
    if (written) result.fieldsOverlaid++;
    else result.fieldsSkipped++;

    // Objective field committed at low confidence → flag for review.
    if (objective && outcome.confidenceClass === 'persist-with-badge') {
      result.fieldReview[field] = { state: 'low-confidence', confidence: outcome.confidence };
    }

    // Capture dissenters for the fieldAlternatives column.
    if (outcome.alternatives.length > 0) {
      result.fieldAlternatives[field] = outcome.alternatives.map(a => ({
        provider: a.provider,
        value: a.value,
        confidence: a.confidence,
      }));
    }
  }

  // One provenance entry per column, whichever chain supplied the value.
  adoptColumnProvenanceKeys(legacyMetadata, legacyProvenance);

  return result;
}

/** The persister also reads these legacy spellings of the count columns. */
const LEGACY_KEY_ALIASES: Readonly<Record<string, string>> = {
  chapters: 'chapterCount',
  volumes: 'volumeCount',
};

/** A stored value worth protecting: `UNKNOWN` status and non-positive counts are placeholders. */
function hasStoredValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value.length > 0 && value !== 'UNKNOWN';
  return true;
}

/**
 * Drop an abstained field from the record about to be persisted.
 *
 * The legacy chain's value is one provider's unchecked claim (AniList's, for
 * status) — exactly what the selector just declined to endorse. The persister
 * keeps the existing column and provenance for any key that is absent, so
 * removing the key is what "do not write this field" means here.
 */
function withholdAbstainedField(
  field: string,
  legacyMetadata: Record<string, unknown>,
  legacyProvenance: Record<string, string>,
): void {
  const alias = LEGACY_KEY_ALIASES[field];
  for (const key of alias ? [field, alias] : [field]) {
    // eslint-disable-next-line no-param-reassign -- documented in-place overlay
    delete legacyMetadata[key];
    // eslint-disable-next-line no-param-reassign -- documented in-place overlay
    delete legacyProvenance[key];
  }
}
