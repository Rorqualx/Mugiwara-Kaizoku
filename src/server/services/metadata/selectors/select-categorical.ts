/**
 * Phase 1.5 commit #5: enum-normalize + majority-vote categorical selector.
 *
 * Decision rule (per deep-dive D4):
 *
 * 1. Normalize each candidate value via the per-field normalizer (lowercase,
 *    trim, map common synonyms onto the canonical enum).
 * 2. Drop candidates that normalize to null (placeholder, unknown).
 * 3. Group by normalized value; each group's score = Σ (matchConfidence ×
 *    authority) of its members.
 * 4. Winner = highest-scoring group. Confidence = agreement × f(k): the
 *    group's share of total weight, scaled by how many independent witnesses
 *    back it.
 * 5. Confidence below the categorical reject threshold (0.50) →
 *    winner=null (persister keeps the prior value).
 *
 * Pure function — no DB, no I/O.
 *
 * `status` is the highlight win: today's path lets a stale-AL "RELEASING"
 * persist even when MD/MAL/MU all agree on "COMPLETED" because AL writes
 * first. This selector lets the three agreeing providers outvote AL.
 */

import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

import { resolveWeight } from './authority';
import { classifyConfidence, type FieldType } from './thresholds';
import { computeAgreementConfidence, pickWeightedWinner } from './weighted-winner';

import type { Candidate, SelectorAlternative, SelectorContext, RawSelectorResult } from './types';

const FIELD_TYPE: FieldType = 'categorical';

interface ParsedCandidate {
  candidate: Candidate;
  normalized: string;
  weight: number;
}

interface ValueGroup {
  normalized: string;
  members: ParsedCandidate[];
  totalWeight: number;
}

export function selectCategorical(ctx: SelectorContext): RawSelectorResult {
  const parsed = parseAndNormalize(ctx);
  if (parsed.length === 0) {
    return {
      winner: null,
      confidence: 0,
      alternatives: [],
      guardRefused: false,
      reason: 'no candidates with normalizable categorical values',
    };
  }

  const groups = groupByNormalizedValue(parsed);
  // An exact tie has no principled winner; break it on the value itself so the
  // pick is at least independent of candidate order (it will sit at or below
  // the reject threshold anyway).
  const winnerGroup = pickWeightedWinner(groups, 'selectCategorical', (a, b) => (a.normalized < b.normalized ? -1 : 1));
  const totalWeight = parsed.reduce((sum, p) => sum + p.weight, 0);
  const agreement = totalWeight > 0 ? winnerGroup.totalWeight / totalWeight : 0;

  const winnerParsed = pickGroupRepresentative(winnerGroup);
  const winnerConfidence = computeAgreementConfidence(
    agreement,
    winnerGroup.members.map(m => m.candidate.provider),
  );

  const alternatives = buildAlternatives(parsed, winnerParsed);
  const decision = classifyConfidence(winnerConfidence, FIELD_TYPE);

  if (decision === 'reject') {
    return {
      winner: null,
      confidence: winnerConfidence,
      alternatives,
      guardRefused: false,
      reason: `winner confidence ${winnerConfidence.toFixed(2)} below categorical reject threshold`,
    };
  }

  // CRITICAL: return the NORMALIZED value, not the raw provider string.
  // The overlay writes this directly to a Prisma column; for `status` etc.
  // the column is an enum (MangaPublicationStatus) and the persister will
  // throw `Invalid value for argument 'status'` on lowercase raw input.
  // The categorical-field normalizers (status / format / contentRating /
  // demographic / countryOfOrigin) all map the raw to the canonical enum
  // form already; emit that here.
  return {
    winner: { ...winnerParsed.candidate, value: winnerParsed.normalized },
    confidence: winnerConfidence,
    alternatives,
    guardRefused: false,
    reason: `${winnerGroup.members.length}/${parsed.length} providers agree on "${winnerGroup.normalized}" (${(agreement * 100).toFixed(0)}%)`,
  };
}

// ============================================================================
// Per-field normalizers
// ============================================================================

/**
 * Map raw provider values to a canonical enum string, or null when the
 * value is a placeholder/unknown.
 *
 * Field-specific normalizers handle the heterogeneity (AL "FINISHED" → MAL
 * "Finished" → MD "completed"). For fields without a registered normalizer,
 * a generic trim + lowercase pass applies.
 */
type Normalizer = (raw: unknown) => string | null;

/**
 * Provider status spellings → MangaPublicationStatus, keyed on the token form
 * (`statusToken`: lower-case, separators collapsed to one space). `null` means
 * "the provider said it does not know" and is listed so the intent is explicit.
 *
 * Whole-value lookup on purpose: free text such as MangaUpdates'
 * "29 Volumes (Discontinued)" must not match on a substring here — the claim
 * builders reduce it to one of these tokens (or drop it) before it arrives.
 */
const STATUS_BY_TOKEN: ReadonlyMap<string, string | null> = new Map<string, string | null>([
  // AniList FINISHED · MangaDex completed · Kitsu finished · Jikan "Finished"
  ['finished', 'COMPLETED'], ['completed', 'COMPLETED'], ['complete', 'COMPLETED'], ['ended', 'COMPLETED'],
  // AniList RELEASING · MangaDex ongoing · Kitsu current · Jikan "Publishing"
  ['releasing', 'ONGOING'], ['ongoing', 'ONGOING'], ['publishing', 'ONGOING'], ['current', 'ONGOING'],
  // AniList HIATUS · MangaDex hiatus · Jikan "On Hiatus"
  ['hiatus', 'HIATUS'], ['on hiatus', 'HIATUS'], ['paused', 'HIATUS'],
  // AniList CANCELLED · MangaDex cancelled · Jikan "Discontinued"
  ['cancelled', 'CANCELLED'], ['canceled', 'CANCELLED'], ['discontinued', 'CANCELLED'], ['dropped', 'CANCELLED'],
  // AniList NOT_YET_RELEASED · Kitsu unreleased/upcoming · Jikan "Not yet published"
  ['not yet released', 'UPCOMING'], ['not yet published', 'UPCOMING'], ['not published', 'UPCOMING'],
  ['unreleased', 'UPCOMING'], ['upcoming', 'UPCOMING'],
  // Kitsu `tba` carries no publication state; MAL's map emits UNKNOWN.
  ['tba', null], ['unknown', null], ['n/a', null],
]);

function statusToken(s: string): string {
  return s.replace(/[\s_-]+/gu, ' ');
}

const NORMALIZERS: Partial<Record<MetadataField, Normalizer>> = {
  status: (raw): string | null => {
    const s = genericNormalize(raw);
    if (s === null) return null;
    // The column is a Prisma enum: one value outside it makes the whole
    // metadata update throw, so anything unrecognised abstains instead of
    // being passed through.
    return STATUS_BY_TOKEN.get(statusToken(s)) ?? null;
  },
  format: (raw): string | null => {
    const s = genericNormalize(raw);
    if (s === null) return null;
    // AL/MD/MAL/Kitsu all return slightly different format strings.
    if (/^(?:manga|graphic[\s_-]?novel)$/u.test(s)) return 'MANGA';
    if (/^manhwa$/u.test(s)) return 'MANHWA';
    if (/^manhua$/u.test(s)) return 'MANHUA';
    if (/^(?:one[\s_-]?shot|oneshot)$/u.test(s)) return 'ONE_SHOT';
    if (/^doujin(?:shi)?$/u.test(s)) return 'DOUJINSHI';
    if (/^(?:novel|light[\s_-]?novel)$/u.test(s)) return 'NOVEL';
    return s.toUpperCase();
  },
  contentRating: (raw): string | null => {
    const s = genericNormalize(raw);
    if (s === null) return null;
    // MangaDex is the only source today; surface MD's enum directly.
    if (/^(?:safe|general)$/u.test(s)) return 'safe';
    if (/^(?:suggestive|teen)$/u.test(s)) return 'suggestive';
    if (/^(?:erotica|mature)$/u.test(s)) return 'erotica';
    if (/^(?:pornographic|explicit|adult)$/u.test(s)) return 'pornographic';
    return s;
  },
  publicationDemographic: (raw): string | null => {
    const s = genericNormalize(raw);
    if (s === null) return null;
    if (/^(?:shounen|shonen)$/u.test(s)) return 'shounen';
    if (/^(?:shoujo|shojo)$/u.test(s)) return 'shoujo';
    if (/^seinen$/u.test(s)) return 'seinen';
    if (/^josei$/u.test(s)) return 'josei';
    if (/^none$/u.test(s)) return null;
    return s;
  },
  countryOfOrigin: (raw): string | null => {
    const s = genericNormalize(raw);
    if (s === null) return null;
    // AL emits ISO 3166-1 alpha-2 already; uppercase it for safety.
    return s.toUpperCase();
  },
};

function genericNormalize(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  return trimmed;
}

function normalizeFor(field: MetadataField): Normalizer {
  return NORMALIZERS[field] ?? genericNormalize;
}

// ============================================================================
// Helpers
// ============================================================================

function parseAndNormalize(ctx: SelectorContext): ParsedCandidate[] {
  const normalize = normalizeFor(ctx.field);
  const out: ParsedCandidate[] = [];
  for (const c of ctx.candidates) {
    const normalized = normalize(c.value);
    if (normalized === null) continue;
    const authority = resolveWeight(c.field, c.provider);
    out.push({ candidate: c, normalized, weight: c.matchConfidence * authority });
  }
  // Canonical order (strongest first, then provider) so weight sums, group
  // representatives and tie-breaks never depend on candidate order.
  return out.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (a.candidate.provider !== b.candidate.provider) return a.candidate.provider < b.candidate.provider ? -1 : 1;
    return a.normalized < b.normalized ? -1 : a.normalized > b.normalized ? 1 : 0;
  });
}

function groupByNormalizedValue(parsed: ParsedCandidate[]): ValueGroup[] {
  const byNorm = new Map<string, ValueGroup>();
  for (const p of parsed) {
    const existing = byNorm.get(p.normalized);
    if (existing) {
      existing.members.push(p);
      existing.totalWeight += p.weight;
    } else {
      byNorm.set(p.normalized, { normalized: p.normalized, members: [p], totalWeight: p.weight });
    }
  }
  return [...byNorm.values()];
}

function pickGroupRepresentative(group: ValueGroup): ParsedCandidate {
  // Members keep the strongest-first order `parseAndNormalize` established.
  const top = group.members[0];
  if (!top) {
    throw new Error('selectCategorical: group has no members');
  }
  return top;
}

function buildAlternatives(parsed: ParsedCandidate[], winner: ParsedCandidate): SelectorAlternative[] {
  return parsed
    .filter(p => p.normalized !== winner.normalized || p.candidate.provider !== winner.candidate.provider)
    .map(p => ({
      provider: p.candidate.provider,
      value: p.candidate.value,
      confidence: Math.min(1, p.weight),
    }));
}
