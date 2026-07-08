/**
 * Phase 1.5: Cross-source consensus selector authority weights.
 *
 * The selector multiplies match-confidence × authority weight to score
 * candidates. Authority captures "given that provider X bound correctly to
 * this manga, how trustworthy is its claim on field F?" — distinct from
 * binding accuracy (which the matcher already encodes).
 *
 * Base weights are hand-seeded; the per-field OVERRIDES for volumes/chapters/
 * status are now EMPIRICALLY DERIVED from the metadata-accuracy harness
 * (`scripts/surveys/metadata-accuracy/`), which fetches each provider directly
 * and scores field-value accuracy against curated + consensus ground truth.
 * Re-derive with that harness after collecting more titles; gate weight changes
 * through `metadata-accuracy/gate.ts` (runs this table through the real selector).
 *
 * Final weight is the per-field override × base weight, capped at 1.0.
 * Fall-through: when a (field, provider) pair has no override, the base
 * weight applies directly.
 *
 * LIVE: consumed on every enrichment via select-*.ts → resolveWeight
 * (phase-provider-fetch.ts applySelectorCutoverInPlace). (An older comment here
 * said "NOT consumed yet" — that was stale; the cutover went live 2026-05-30.)
 */

import type { MetadataField, SourceName } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

/**
 * Base authority per provider — applies to any field the provider emits
 * without an explicit override.
 *
 * Numbers reflect bind-loop parity accuracy + structural-data quality:
 * - mangadex 0.96 — only provider with structured contentRating + demographic;
 *   bind-loop ~95.7%; aggregate data is current.
 * - anilist 0.95 — broad taxonomy coverage, but stale-status is its known
 *   failure mode (the master-plan example for why we need a consensus selector).
 * - mangaupdates 0.95 — bind-loop ~94.7%; multi-publisher native.
 * - mal 0.92 — Jikan-proxied; strong scores/rankings, weak taxonomy.
 * - wikipedia 0.90 — bind-loop ~89.9%; chapter/volume sourcing strong.
 * - fandom 0.87 — bind-loop ~87.3%; great on chapter titles, weak on
 *   Metadata-row fields.
 * - comicvine 0.70 — narrow surface, threshold-bound matches inconsistent.
 * - kitsu 0.56 — from bind-loop binding accuracy. NOTE: this conflates BINDING
 *   reliability with FIELD-VALUE reliability; the harness shows Kitsu's field
 *   values are actually strong (e.g. best-in-class for status/startDate). The
 *   per-field overrides above should govern where measured — this base only
 *   applies to unmeasured fields.
 */
export const PROVIDER_BASE_WEIGHT: Record<SourceName, number> = {
  anilist:      0.95,
  mangadex:     0.96,
  mal:          0.92,
  mangaupdates: 0.95,
  kitsu:        0.56,
  fandom:       0.87,
  wikipedia:    0.90,
  comicvine:    0.70,
};

/**
 * Per-field overrides. When set, takes precedence over the base weight for
 * that (field, provider) pair. When a provider isn't listed for a field,
 * the base weight applies. When a field isn't listed here at all, all
 * providers use their base weights.
 *
 * Override rationale per field group:
 *
 * - **Numeric counts** (`chapters`/`volumes`): AL/MAL stay anchors per
 *   `applyProvenanceGuards`. MD aggregate often catches stale AL scalars,
 *   so it ranks alongside the anchors here.
 * - **Rating** is selected against per-source rating JSON `value`; base
 *   weight applies to the provider-level pick. Rating's `scoredBy` weighting
 *   is selector-internal (see select-structured.ts in commit #8).
 * - **Publishers**: MU's `publishers[]` is the native multi-publisher shape;
 *   AL `staff[]` has publisher entries but is less reliable.
 * - **Content classification** (`contentRating`/`publicationDemographic`):
 *   MangaDex `attributes` are the only canonical source.
 * - **Themes**: MD's tag taxonomy is broader; AL's themed tags are curated
 *   (extracted via the `category=Theme-*` pattern in result-builder).
 * - **countryOfOrigin**: AL only — MD also exposes `originalLanguage` but
 *   it's not the same field.
 */
export const FIELD_AUTHORITY_OVERRIDES: Partial<Record<MetadataField, Partial<Record<SourceName, number>>>> = {
  // volumes/chapters LEFT AT BASELINE. The metadata-accuracy harness found MAL
  // most accurate here, but the numeric selector's value-clustering already
  // resolves these near-optimally (gate: 99%/97%), and reweighting — including
  // flooring MangaUpdates — REGRESSED chapters (a low-accuracy source still
  // casts a helpful confirming vote when it agrees with the true cluster).
  // Weight tuning only pays off for genuinely-contested categorical fields.
  chapters: {
    anilist:      0.95,
    mal:          0.92,
    mangadex:     0.93,
    mangaupdates: 0.88,
    kitsu:        0.50,
  },
  volumes: {
    anilist:      0.95,
    mal:          0.92,
    mangadex:     0.88,
    mangaupdates: 0.90,
    kitsu:        0.50,
  },
  // Empirically derived (metadata-accuracy harness). Candidates: anilist,
  // mangadex, mal, mangaupdates. MangaDex's ongoing/completed flag is often
  // stale (23% correct when contested) yet its base weight (0.96) made it the
  // top status authority, flipping close votes wrong — floored here. MAL is the
  // measured best (85%). Gate: contested status 76.9% → 84.6%, no regression.
  status: {
    mal:          0.95,
    anilist:      0.82,
    mangaupdates: 0.60,
    mangadex:     0.40,
  },
  rating: {
    anilist:      0.95,
    mal:          0.92,
    mangaupdates: 0.88,
    kitsu:        0.60,
  },
  // publishers[] is the Phase 1 field; lives outside source-priority-config's
  // MetadataField union until commit #3 wires it in.
  // contentRating / publicationDemographic: MD-only — listed so the override
  // dominates the base weight even though only one provider contributes.
  contentRating: {
    mangadex: 0.96,
  },
  publicationDemographic: {
    mangadex: 0.96,
    mal:      0.80,
  },
  themes: {
    mangadex: 0.93,
    anilist:  0.90,
    mal:      0.85,
  },
  countryOfOrigin: {
    anilist: 0.95,
  },
};

/**
 * Resolve the effective authority weight for a (field, provider) pair.
 *
 * Lookup order:
 *   1. FIELD_AUTHORITY_OVERRIDES[field][provider] (most specific)
 *   2. PROVIDER_BASE_WEIGHT[provider]            (fallback)
 *
 * `PROVIDER_BASE_WEIGHT` is a total record keyed on the SourceName union,
 * so the fallback lookup is always defined for the 8 wired providers.
 */
export function resolveWeight(field: MetadataField, provider: SourceName): number {
  const fieldOverrides = FIELD_AUTHORITY_OVERRIDES[field];
  const override = fieldOverrides?.[provider];
  if (typeof override === 'number') return override;
  return PROVIDER_BASE_WEIGHT[provider];
}
