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
 * 4. Winner = highest-scoring group. Confidence ≈ winner-score / total-score
 *    plus a small dampening for sole-candidate fields.
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

import type { Candidate, SelectorAlternative, SelectorContext, SelectorResult } from './types';

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

export function selectCategorical(ctx: SelectorContext): SelectorResult {
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
  const winnerGroup = pickWinningGroup(groups);
  const totalWeight = parsed.reduce((sum, p) => sum + p.weight, 0);
  const agreement = totalWeight > 0 ? winnerGroup.totalWeight / totalWeight : 0;

  const winnerParsed = pickGroupRepresentative(winnerGroup);
  // Per-candidate confidence in this group context. Dampening matches
  // selectNumeric's shape so cross-field-type metrics align.
  const winnerConfidence =
    winnerGroup.totalWeight > 0
      ? Math.min(1, agreement * (winnerParsed.weight / winnerGroup.totalWeight) + agreement * 0.5)
      : agreement;

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

  return {
    winner: winnerParsed.candidate,
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

const NORMALIZERS: Partial<Record<MetadataField, Normalizer>> = {
  status: (raw): string | null => {
    const s = genericNormalize(raw);
    if (s === null) return null;
    // Map all known provider-side spellings to MangaPublicationStatus.
    if (/^finished|completed|complete|ended$/u.test(s)) return 'COMPLETED';
    if (/^releasing|ongoing|publishing|current$/u.test(s)) return 'ONGOING';
    if (/^not[\s_-]?yet[\s_-]?released|upcoming|not[\s_-]?published$/u.test(s)) return 'UPCOMING';
    if (/^cancelled|canceled|discontinued|dropped$/u.test(s)) return 'CANCELLED';
    if (/^hiatus|paused$/u.test(s)) return 'HIATUS';
    if (/^unknown|tba|n\/a$/u.test(s)) return null;
    return s.toUpperCase();
  },
  format: (raw): string | null => {
    const s = genericNormalize(raw);
    if (s === null) return null;
    // AL/MD/MAL/Kitsu all return slightly different format strings.
    if (/^manga|graphic[\s_-]?novel$/u.test(s)) return 'MANGA';
    if (/^manhwa$/u.test(s)) return 'MANHWA';
    if (/^manhua$/u.test(s)) return 'MANHUA';
    if (/^one[\s_-]?shot|oneshot$/u.test(s)) return 'ONE_SHOT';
    if (/^doujin(?:shi)?$/u.test(s)) return 'DOUJINSHI';
    if (/^novel|light[\s_-]?novel$/u.test(s)) return 'NOVEL';
    return s.toUpperCase();
  },
  contentRating: (raw): string | null => {
    const s = genericNormalize(raw);
    if (s === null) return null;
    // MangaDex is the only source today; surface MD's enum directly.
    if (/^safe|general$/u.test(s)) return 'safe';
    if (/^suggestive|teen$/u.test(s)) return 'suggestive';
    if (/^erotica|mature$/u.test(s)) return 'erotica';
    if (/^pornographic|explicit|adult$/u.test(s)) return 'pornographic';
    return s;
  },
  publicationDemographic: (raw): string | null => {
    const s = genericNormalize(raw);
    if (s === null) return null;
    if (/^shounen|shonen$/u.test(s)) return 'shounen';
    if (/^shoujo|shojo$/u.test(s)) return 'shoujo';
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
  return out;
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

function pickWinningGroup(groups: ValueGroup[]): ValueGroup {
  const sorted = [...groups].sort((a, b) => {
    if (b.totalWeight !== a.totalWeight) return b.totalWeight - a.totalWeight;
    return b.members.length - a.members.length;
  });
  const winner = sorted[0];
  if (!winner) {
    throw new Error('selectCategorical: pickWinningGroup called with empty groups[]');
  }
  return winner;
}

function pickGroupRepresentative(group: ValueGroup): ParsedCandidate {
  const sorted = [...group.members].sort((a, b) => b.weight - a.weight);
  const top = sorted[0];
  if (!top) {
    throw new Error('selectCategorical: group has no members');
  }
  return top;
}

function buildAlternatives(parsed: ParsedCandidate[], winner: ParsedCandidate): SelectorAlternative[] {
  return parsed
    .filter(p => p.normalized !== winner.normalized || p.candidate.provider !== winner.candidate.provider)
    .sort((a, b) => b.weight - a.weight)
    .map(p => ({
      provider: p.candidate.provider,
      value: p.candidate.value,
      confidence: Math.min(1, p.weight),
    }));
}
