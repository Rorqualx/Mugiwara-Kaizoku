/**
 * Phase 1.5: Cross-source consensus selector authority weights.
 *
 * The selector multiplies match-confidence × authority weight to score
 * candidates. Authority captures "given that provider X bound correctly to
 * this manga, how trustworthy is its claim on field F?" — distinct from
 * binding accuracy (which the matcher already encodes).
 *
 * The weight VALUES now live in the provider registry
 * (`@/lib/metadata/provider-registry`) — `baseWeight` per provider plus
 * per-field `fieldWeights` overrides — alongside every other per-provider fact.
 * `resolveWeight` is re-exported here so the five `select-*.ts` importers keep
 * a stable import surface.
 *
 * Rationale for the notable overrides (all empirically derived from the
 * metadata-accuracy harness, `scripts/surveys/metadata-accuracy/`, and gated
 * through `gate.ts` which runs them through the REAL selector):
 *
 * - **status**: MangaDex's ongoing/completed flag is often stale (23% correct
 *   when contested) yet its base weight (0.96) made it the top status authority
 *   and flipped close votes wrong — floored to 0.40. MAL is the measured best
 *   (0.95). Gate result: contested status 76.9% → 84.6%, no regression.
 * - **chapters/volumes**: LEFT AT BASELINE-ish overrides. The numeric selector's
 *   value-clustering already resolves counts near-optimally (gate 99%/97%);
 *   reweighting — including flooring MangaUpdates — REGRESSED chapters, because a
 *   low-accuracy source still casts a helpful confirming vote when it agrees with
 *   the true cluster. Weight tuning only pays off for contested categorical fields.
 * - **kitsu base (0.56)**: from bind-loop BINDING accuracy, which conflates
 *   binding reliability with field-value reliability; the harness shows Kitsu's
 *   field values are strong. The per-field overrides govern where measured.
 *
 * LIVE: consumed on every enrichment via select-*.ts → resolveWeight
 * (phase-provider-fetch.ts applySelectorCutoverInPlace; cutover went live
 * 2026-05-30). Re-derive with the harness and re-gate before changing values.
 */

export { resolveWeight } from '@/lib/metadata/provider-registry';
