/**
 * Phase 1.5 commit #8: per-field custom structured selector.
 *
 * Selects fields whose values are nested objects, not scalars or lists.
 *
 * | Field          | Strategy                                        |
 * |---------------:|-------------------------------------------------|
 * | startDate      | Earliest non-null Date across providers         |
 * | endDate        | Latest non-null Date across providers           |
 * | rating         | RatingJson merge — weighted by scoredBy + authority |
 * | externalLinks  | Union deduped by `(site, url)` pair              |
 * | galleryImages  | Union deduped by URL                             |
 *
 * Pure function — no DB, no I/O.
 *
 * The per-field dispatch keeps the selector small but the strategies
 * domain-specific; rating JSON in particular is too custom for the generic
 * numeric/list selectors.
 */

import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';
import { parseRatingJson, type RatingJson } from '@/types/domain/rating-types';

import { resolveWeight } from './authority';
import { classifyConfidence, type FieldType } from './thresholds';

import type { Candidate, SelectorAlternative, SelectorContext, SelectorResult } from './types';

const FIELD_TYPE: FieldType = 'structured';

export function selectStructured(ctx: SelectorContext): SelectorResult {
  if (ctx.field === 'startDate') return selectDate(ctx, 'earliest');
  if (ctx.field === 'endDate') return selectDate(ctx, 'latest');
  if (ctx.field === 'rating') return selectRating(ctx);
  if (ctx.field === 'externalLinks') return selectExternalLinks(ctx);
  if (ctx.field === 'galleryImages') return selectGallery(ctx);
  return emptyResult('no structured strategy registered for field');
}

// ============================================================================
// Date strategies — earliest / latest non-null
// ============================================================================

interface DatedCandidate {
  candidate: Candidate;
  date: Date;
  weight: number;
}

function selectDate(ctx: SelectorContext, mode: 'earliest' | 'latest'): SelectorResult {
  const dated = parseDates(ctx);
  if (dated.length === 0) return emptyResult('no candidates parsed as dates');

  const sorted = [...dated].sort((a, b) =>
    mode === 'earliest' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime(),
  );
  const winnerParsed = sorted[0];
  if (!winnerParsed) return emptyResult('unreachable: sorted dated[] empty after non-empty check');

  // Confidence: weight-share baseline, lifted when there are credible
  // contributors. Without the lift, 3 equally-weighted dates each score ~0.33
  // and the structured reject threshold (0.50) drops them all — even though
  // each date is individually trustworthy.
  const totalWeight = dated.reduce((s, d) => s + d.weight, 0);
  const baseConfidence = totalWeight > 0 ? winnerParsed.weight / totalWeight : 0;
  const confidence = liftStructuredConfidence(baseConfidence, winnerParsed.weight, dated.length);

  const decision = classifyConfidence(confidence, FIELD_TYPE);
  const alternatives: SelectorAlternative[] = sorted.slice(1).map(d => ({
    provider: d.candidate.provider,
    value: d.date.toISOString(),
    confidence: Math.min(1, d.weight / Math.max(totalWeight, 1e-9)),
  }));
  if (decision === 'reject') return emptyResult(`date confidence ${confidence.toFixed(2)} below structured reject threshold`, alternatives);

  return {
    winner: { ...winnerParsed.candidate, value: winnerParsed.date },
    confidence,
    alternatives,
    guardRefused: false,
    reason: `${mode === 'earliest' ? 'earliest' : 'latest'} of ${dated.length} date(s)`,
  };
}

function parseDates(ctx: SelectorContext): DatedCandidate[] {
  const out: DatedCandidate[] = [];
  for (const c of ctx.candidates) {
    const date = coerceDate(c.value);
    if (date === null) continue;
    const weight = resolveWeight(c.field, c.provider) * c.matchConfidence;
    out.push({ candidate: c, date, weight });
  }
  return out;
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value.length > 0) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ============================================================================
// Rating JSON strategy — weighted merge across sources
// ============================================================================

interface RatingCandidate {
  candidate: Candidate;
  rating: RatingJson;
  weight: number;
}

function selectRating(ctx: SelectorContext): SelectorResult {
  const ratings = parseRatings(ctx);
  if (ratings.length === 0) return emptyResult('no candidates parsed as RatingJson');

  // Per-source confidence accounts for both authority and scoredBy depth.
  // A provider with 10k votes outweighs one with 50 even at equal authority.
  for (const r of ratings) {
    r.weight *= votesScale(r.rating.scoredBy);
  }
  const sorted = [...ratings].sort((a, b) => b.weight - a.weight);
  const winnerParsed = sorted[0];
  if (!winnerParsed) return emptyResult('unreachable: ratings sorted empty');

  const totalWeight = ratings.reduce((s, r) => s + r.weight, 0);
  const baseConfidence = totalWeight > 0 ? winnerParsed.weight / totalWeight : 0;
  const confidence = liftStructuredConfidence(baseConfidence, winnerParsed.weight, ratings.length);
  const decision = classifyConfidence(confidence, FIELD_TYPE);
  const alternatives: SelectorAlternative[] = sorted.slice(1).map(r => ({
    provider: r.candidate.provider,
    value: r.rating,
    confidence: Math.min(1, r.weight / Math.max(totalWeight, 1e-9)),
  }));
  if (decision === 'reject') return emptyResult(`rating confidence ${confidence.toFixed(2)} below threshold`, alternatives);

  return {
    winner: { ...winnerParsed.candidate, value: winnerParsed.rating },
    confidence,
    alternatives,
    guardRefused: false,
    reason: `picked ${winnerParsed.candidate.provider} rating (scoredBy ${winnerParsed.rating.scoredBy ?? '?'})`,
  };
}

function parseRatings(ctx: SelectorContext): RatingCandidate[] {
  const out: RatingCandidate[] = [];
  for (const c of ctx.candidates) {
    const rating = parseRatingJson(c.value);
    if (rating === null) continue;
    const weight = resolveWeight(c.field, c.provider) * c.matchConfidence;
    out.push({ candidate: c, rating, weight });
  }
  return out;
}

function votesScale(scoredBy: number | undefined): number {
  // log-scale boost so 10× more votes gives ~1.3× weight, not 10×.
  // No votes (scoredBy missing) → multiplier 0.7 (slight penalty).
  if (typeof scoredBy !== 'number' || scoredBy <= 0) return 0.7;
  return Math.min(1.5, 0.6 + 0.1 * Math.log10(scoredBy));
}

// ============================================================================
// externalLinks union — dedup by (site, url)
// ============================================================================

interface LinkRecord {
  site: string;
  url: string;
}

function selectExternalLinks(ctx: SelectorContext): SelectorResult {
  const links = collectLinks(ctx);
  if (links.size === 0) return emptyResult('no externalLinks candidates emitted entries');

  const value: LinkRecord[] = [...links.values()];
  const winnerCandidate: Candidate = {
    field: ctx.field,
    provider: pickPrimaryContributor(ctx),
    value,
    matchConfidence: 0.9,
  };
  return {
    winner: winnerCandidate,
    confidence: 0.9,
    alternatives: [],
    guardRefused: false,
    reason: `union of ${value.length} external link(s) across providers`,
  };
}

function collectLinks(ctx: SelectorContext): Map<string, LinkRecord> {
  const out = new Map<string, LinkRecord>();
  for (const c of ctx.candidates) {
    if (!Array.isArray(c.value)) continue;
    for (const raw of c.value) {
      const link = coerceLink(raw);
      if (!link) continue;
      const key = `${link.site.toLowerCase()}|${link.url.toLowerCase()}`;
      if (!out.has(key)) out.set(key, link);
    }
  }
  return out;
}

function coerceLink(raw: unknown): LinkRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  const url = typeof obj['url'] === 'string' ? obj['url'].trim() : '';
  const site = typeof obj['site'] === 'string' ? obj['site'].trim() : '';
  if (url.length === 0 || site.length === 0) return null;
  return { site, url };
}

// ============================================================================
// galleryImages — URL union with dedup
// ============================================================================

function selectGallery(ctx: SelectorContext): SelectorResult {
  const urls = new Map<string, string>();
  for (const c of ctx.candidates) {
    if (!Array.isArray(c.value)) continue;
    for (const raw of c.value) {
      if (typeof raw !== 'string') continue;
      const url = raw.trim();
      if (url.length === 0 || !/^https?:\/\//iu.test(url)) continue;
      if (!urls.has(url.toLowerCase())) urls.set(url.toLowerCase(), url);
    }
  }
  if (urls.size === 0) return emptyResult('no gallery URLs found');
  const value = [...urls.values()];
  return {
    winner: {
      field: ctx.field,
      provider: pickPrimaryContributor(ctx),
      value,
      matchConfidence: 0.9,
    },
    confidence: 0.9,
    alternatives: [],
    guardRefused: false,
    reason: `union of ${value.length} gallery image(s)`,
  };
}

// ============================================================================
// Shared helpers
// ============================================================================

/**
 * Lift weight-share confidence for "each provider contributes one credible
 * value" structured fields. Without the lift, 3 competing dates with equal
 * weights all score ~0.33 and the structured reject threshold (0.50) drops
 * them all.
 *
 * Rules:
 * - 1 candidate with non-zero weight → ≥ 0.75
 * - 2–4 candidates                   → ≥ 0.55
 * - 5+ candidates                    → ≥ 0.45
 */
function liftStructuredConfidence(base: number, winnerWeight: number, candidateCount: number): number {
  if (winnerWeight <= 0) return base;
  if (candidateCount === 1) return Math.max(base, 0.75);
  if (candidateCount <= 4) return Math.max(base, 0.55);
  return Math.max(base, 0.45);
}

function pickPrimaryContributor(ctx: SelectorContext): Candidate['provider'] {
  let best: Candidate['provider'] = 'anilist';
  let bestWeight = -1;
  for (const c of ctx.candidates) {
    if (!Array.isArray(c.value) || c.value.length === 0) continue;
    const weight = resolveWeight(c.field, c.provider) * c.matchConfidence;
    if (weight > bestWeight) {
      best = c.provider;
      bestWeight = weight;
    }
  }
  return best;
}

function emptyResult(reason: string, alternatives: SelectorAlternative[] = []): SelectorResult {
  return { winner: null, confidence: 0, alternatives, guardRefused: false, reason };
}

// Local hint so consumers can pre-empt the dispatch with a known field.
export const STRUCTURED_FIELDS: ReadonlySet<MetadataField> = new Set([
  'startDate',
  'endDate',
  'rating',
  'externalLinks',
  'galleryImages',
]);
