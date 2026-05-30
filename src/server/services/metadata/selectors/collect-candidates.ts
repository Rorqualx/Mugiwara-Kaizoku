/**
 * Phase 1.5 commit #9: candidate-emission pivot.
 *
 * Reads the per-provider supplements that `enrichment-result-builder.ts`
 * sees and pivots them into `Candidate[]` arrays keyed by field. This is the
 * boundary between "what each provider claims" and "what the selector picks."
 *
 * Lives outside the result-builder so #9 stays additive — the legacy
 * Object.assign chain is untouched. Commit #12 deletes that chain after
 * shadow-mode evidence confirms the selector picks aren't worse.
 *
 * Pure function — no DB, no I/O.
 */

import type { AniListMangaDetails } from '@/server/services/anilist/service';
import type { MetadataField, SourceName } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

import { FIELD_TYPE_REGISTRY, type Candidate } from './types';

/**
 * Per-provider unified field map. Each value is the same kind of dict the
 * `buildKitsuMetadataSupplements` etc. functions already return — the
 * collector just pivots them, not re-shapes them.
 *
 * Provider matchConfidence is the matcher's binding score (the score the
 * sticky-binding hook in Phase 3 will use). Defaults to 0.9 when not known.
 */
export interface ProviderClaim {
  provider: SourceName;
  matchConfidence: number;
  /** Whatever fields the provider emitted, keyed on Metadata column name. */
  fields: Record<string, unknown>;
}

/**
 * Pivot per-provider claims into per-field candidate arrays.
 *
 * Only fields registered in `FIELD_TYPE_REGISTRY` produce candidates;
 * provider-specific scratch keys (e.g. `staff`, `mangadexMeta`) are dropped
 * — the selector has no rule for them.
 */
export function collectCandidates(claims: ProviderClaim[]): Map<MetadataField, Candidate[]> {
  const byField = new Map<MetadataField, Candidate[]>();
  for (const claim of claims) {
    addClaimToCandidates(claim, byField);
  }
  return byField;
}

function addClaimToCandidates(
  claim: ProviderClaim,
  byField: Map<MetadataField, Candidate[]>,
): void {
  for (const [rawKey, value] of Object.entries(claim.fields)) {
    if (value === null || value === undefined) continue;
    const field = mapKeyToField(rawKey);
    if (field === null) continue;
    const candidate: Candidate = {
      field,
      provider: claim.provider,
      value,
      matchConfidence: claim.matchConfidence,
    };
    const existing = byField.get(field);
    if (existing) existing.push(candidate);
    else byField.set(field, [candidate]);
  }
}

/**
 * Map a provider-side key onto a canonical MetadataField. Returns null when
 * the key isn't a Metadata column (e.g. AL's `staff`, MD's `mangadexMeta`).
 *
 * The result-builder's older code wrote some legacy aliases (`chapterCount`
 * → `chapters`, `coverImage` → `cover`) — that aliasing folds here so
 * provider fetchers can keep emitting whatever they emit today.
 */
function mapKeyToField(rawKey: string): MetadataField | null {
  // Direct hits.
  if (rawKey in FIELD_TYPE_REGISTRY) return rawKey as MetadataField;

  // Known legacy aliases. Keep in sync with metadata-persister's
  // buildMetadataUpdateData fallbacks.
  const aliases: Record<string, MetadataField> = {
    chapterCount: 'chapters',
    volumeCount:  'volumes',
    coverImage:   'cover',
    description:  'summary',
    publisher:    'publishers', // single-string emitter wraps to []
    age_rating:   'contentRating',
    ageRating:    'contentRating',
    demographic:  'publicationDemographic',
  };
  return aliases[rawKey] ?? null;
}

// ============================================================================
// AniList-specific helper — extracts every field the AL block currently maps.
// ============================================================================

/**
 * Convert an AniListMangaDetails object into a flat `fields` dict suitable
 * for `ProviderClaim`. Mirrors the field surface that the Object.assign
 * chain in `enrichment-result-builder.ts` reads — minus the post-processing
 * (theme extraction, staff role splitting, rating JSON construction).
 *
 * Implementation: a declarative table of (field, extractor) pairs so the
 * branching count stays small even as fields are added.
 */
export function aniListClaimFields(details: AniListMangaDetails): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [field, extract] of ANILIST_FIELD_EXTRACTORS) {
    const value = extract(details);
    if (value !== null && value !== undefined) fields[field] = value;
  }
  return fields;
}

type AniListExtractor = (d: AniListMangaDetails) => unknown;

const ANILIST_FIELD_EXTRACTORS: ReadonlyArray<readonly [string, AniListExtractor]> = [
  ['title',           d => d.title.english ?? d.title.romaji ?? null],
  ['summary',         d => d.description ?? null],
  ['coverExtraLarge', d => d.coverImage?.extraLarge ?? null],
  ['coverLarge',      d => d.coverImage?.large ?? null],
  ['coverMedium',     d => d.coverImage?.medium ?? null],
  ['cover',           d => d.coverImage?.extraLarge ?? d.coverImage?.large ?? d.coverImage?.medium ?? null],
  ['bannerImage',     d => d.bannerImage ?? null],
  ['chapters',        d => (typeof d.chapters === 'number' ? d.chapters : null)],
  ['volumes',         d => (typeof d.volumes === 'number' ? d.volumes : null)],
  ['genres',          d => (Array.isArray(d.genres) && d.genres.length > 0 ? d.genres : null)],
  ['status',          d => (typeof d.status === 'string' ? d.status : null)],
  ['averageScore',    d => (typeof d.averageScore === 'number' ? d.averageScore : null)],
  ['popularity',      d => (typeof d.popularity === 'number' ? d.popularity : null)],
  ['idMal',           d => (typeof d.idMal === 'number' ? d.idMal : null)],
  ['countryOfOrigin', d => (typeof d.countryOfOrigin === 'string' ? d.countryOfOrigin : null)],
  ['format',          d => (typeof d.format === 'string' ? d.format : null)],
  ['synonyms',        d => (Array.isArray(d.synonyms) && d.synonyms.length > 0 ? d.synonyms : null)],
  ['externalLinks',   extractAniListExternalLinks],
  ['rating',          d => (typeof d.averageScore === 'number'
    ? { value: d.averageScore, source: 'anilist' as const }
    : null)],
];

function extractAniListExternalLinks(d: AniListMangaDetails): unknown {
  if (!Array.isArray(d.externalLinks)) return null;
  const links = d.externalLinks
    .filter((l): l is { url: string; site: string } =>
      typeof l.url === 'string' && typeof l.site === 'string',
    );
  return links.length > 0 ? links : null;
}
