/**
 * Phase 1.5: Per-field-type confidence thresholds.
 *
 * After the selector scores candidates, the winner's confidence determines
 * what happens at the persister boundary:
 *
 * - confidence >= accept           → write canonical column + alternatives
 *                                    (UI shows a clean provenance badge)
 * - persistWithBadge <= c < accept → write canonical column + alternatives
 *                                    (UI shows a "low confidence" badge)
 * - confidence < reject            → do not write; previous canonical value
 *                                    is preserved. Alternatives are still
 *                                    recorded for telemetry.
 *
 * Per the Phase 1.5 deep-dive (D6): thresholds vary by field-type, not by
 * field. Lists tolerate ambiguity (a 0.4-confidence genre is still useful);
 * numerics don't (a 0.4-confidence chapter count corrupts the manga page).
 *
 * NOT consumed yet — wired up by the per-type selectors in commits #4–#8.
 */

/**
 * The five field-types the selector dispatches on.
 *
 * Mirrors the `SELECTORS` map in `selectors/types.ts` (added in commit #3).
 * Listed here independently to keep this file self-contained — thresholds
 * are constants, no runtime dependency on the dispatch layer.
 */
export type FieldType = 'numeric' | 'categorical' | 'string' | 'list' | 'structured';

export interface ConfidenceCutoffs {
  /** >= this → clean accept (no badge). */
  accept: number;
  /** >= this AND < accept → persist with low-confidence badge. */
  persistWithBadge: number;
  /** < this → refuse to write. Convention: equals `persistWithBadge`. */
  reject: number;
}

/**
 * Default thresholds per field-type.
 *
 * - **numeric** (chapters/volumes/score/popularity) — strict. Corrupting a
 *   numeric field cascades through filter/sort UI.
 * - **categorical** (status/format/contentRating) — strict-ish. Wrong
 *   status flips publication state across the manga-detail page.
 * - **string** (summary/cover/banner/title) — moderate. A low-confidence
 *   summary is still informative; UI surfaces the badge.
 * - **list** (genres/tags/themes/synonyms/urls) — most tolerant. List items
 *   are already understood as approximate.
 * - **structured** (rating JSON/externalLinks/dates) — strict-ish. Rating
 *   merges per-source, so the post-merge value should be trustworthy.
 */
export const CONFIDENCE_THRESHOLDS: Record<FieldType, ConfidenceCutoffs> = {
  numeric:     { accept: 0.70, persistWithBadge: 0.40, reject: 0.40 },
  categorical: { accept: 0.75, persistWithBadge: 0.50, reject: 0.50 },
  string:      { accept: 0.60, persistWithBadge: 0.40, reject: 0.40 },
  list:        { accept: 0.50, persistWithBadge: 0.30, reject: 0.30 },
  structured:  { accept: 0.70, persistWithBadge: 0.50, reject: 0.50 },
};

export type ConfidenceClass = 'accept' | 'persist-with-badge' | 'reject';

/**
 * Classify a confidence score for a given field-type into the three
 * persistence buckets. Pure function — selector + persister can both call.
 */
export function classifyConfidence(confidence: number, fieldType: FieldType): ConfidenceClass {
  const cutoffs = CONFIDENCE_THRESHOLDS[fieldType];
  if (confidence >= cutoffs.accept) return 'accept';
  if (confidence >= cutoffs.persistWithBadge) return 'persist-with-badge';
  return 'reject';
}
