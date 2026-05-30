/**
 * Phase 1.5: Cross-source consensus selector — types + field-type registry.
 *
 * The selector replaces the Object.assign chain in
 * `enrichment-result-builder.ts` with a collect-then-select pass. Each
 * provider emits Candidates; the selector groups them by field, scores
 * by authority × match-confidence, and picks a winner per the field-type
 * rule (cluster-vote for numeric, majority-vote for categorical, etc).
 *
 * NOT yet consumed — types ship in commit #3; selector bodies arrive in
 * commits #4–#8 and the result-builder pivot lands in #9.
 */

import type { MetadataField, SourceName } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

import type { FieldType } from './thresholds';

/**
 * A single provider's claim on a single field for a single manga.
 *
 * Emitted by `collectCandidates()` (added to the result-builder in commit
 * #9). Selectors consume arrays of these grouped by field.
 *
 * `matchConfidence` is the **matcher's** score for this provider's bind
 * to the manga (e.g. 0.92 for a strong AniList title match). Distinct
 * from the **selector's** output confidence, which folds in authority +
 * cross-source agreement.
 */
export interface Candidate {
  field: MetadataField;
  provider: SourceName;
  value: unknown;
  matchConfidence: number;
  /** Optional provenance string for telemetry/debug (e.g. "MD attributes.contentRating"). Not persisted. */
  evidence?: string;
}

/**
 * The input the selector receives for one field of one manga.
 *
 * `existingValue` + `existingProvider` are read from the prior persisted
 * row when present; they let the numeric drift-guard (D5) compare against
 * an anchor before overwriting.
 */
export interface SelectorContext {
  mangaId: number;
  field: MetadataField;
  fieldType: FieldType;
  candidates: Candidate[];
  existingValue: unknown;
  existingProvider: SourceName | null;
}

/**
 * One dissenter retained for `Metadata.fieldAlternatives` + UI badges.
 * Matches the per-field-array shape described in deep-dive D1.
 */
export interface SelectorAlternative {
  provider: SourceName;
  value: unknown;
  confidence: number;
}

/**
 * Selector output. The persister maps this onto the canonical Metadata
 * column (winner.value) + `fieldAlternatives` (alternatives[]) +
 * `metadataProvenance.{field}` ({provider, confidence, alternatives}).
 *
 * `winner` is null when no candidate cleared the reject threshold for
 * the field-type. `guardRefused` true means the numeric drift-guard
 * (folded into selectNumeric) overrode an otherwise-acceptable winner.
 */
export interface SelectorResult {
  winner: Candidate | null;
  confidence: number;
  alternatives: SelectorAlternative[];
  guardRefused: boolean;
  /** Debugging only — not persisted. */
  reason: string;
}

export type SelectorFn = (ctx: SelectorContext) => SelectorResult;

// ============================================================================
// Field → FieldType registry
// ============================================================================

/**
 * Maps every MetadataField onto its FieldType. Total over the union — every
 * field the selector might touch must have an entry, otherwise dispatch
 * throws. Exhaustiveness is enforced at type level via `Record<MetadataField, FieldType>`.
 *
 * Field-type assignments per deep-dive D4:
 * - numeric:     comparable scalars (counts, scores, popularity, IDs)
 * - categorical: enum-shaped strings (status, format, ratings)
 * - string:      free-text + URLs (summary, covers, banner)
 * - list:        string arrays (genres, authors, tags, etc.)
 * - structured:  nested objects (dates, externalLinks, rating JSON, galleries)
 */
export const FIELD_TYPE_REGISTRY: Record<MetadataField, FieldType> = {
  // numeric
  chapters:     'numeric',
  volumes:      'numeric',
  averageScore: 'numeric',
  popularity:   'numeric',
  idMal:        'numeric',
  // categorical
  status:                 'categorical',
  format:                 'categorical',
  contentRating:          'categorical',
  publicationDemographic: 'categorical',
  countryOfOrigin:        'categorical',
  source:                 'categorical',
  sourceId:               'categorical',
  // string
  summary:         'string',
  cover:           'string',
  coverExtraLarge: 'string',
  coverLarge:      'string',
  coverMedium:     'string',
  bannerImage:     'string',
  // list
  genres:     'list',
  authors:    'list',
  artists:    'list',
  tags:       'list',
  themes:     'list',
  synonyms:   'list',
  urls:       'list',
  publishers: 'list',
  // structured
  startDate:     'structured',
  endDate:       'structured',
  externalLinks: 'structured',
  galleryImages: 'structured',
  rating:        'structured', // RatingJson — Phase 1
};

export function getFieldType(field: MetadataField): FieldType {
  return FIELD_TYPE_REGISTRY[field];
}
