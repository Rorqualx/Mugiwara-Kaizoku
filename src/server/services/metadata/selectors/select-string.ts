/**
 * Phase 1.5 commit #6: placeholder-reject + length × language × completeness
 * ranking string selector.
 *
 * Selects free-text + URL Metadata fields (summary, cover/cover variants,
 * bannerImage). Unlike numeric/categorical, strings rarely cluster — the
 * choice is usually "pick the best of N somewhat-different blobs."
 *
 * Decision rule (per deep-dive D4):
 *
 * 1. Reject placeholders (empty / "No image" / "TBA" / etc.).
 * 2. Reject too-short summaries (< MIN_SUMMARY_LEN — matches the
 *    existing < 80 char gate in `enrichment-result-builder.ts`).
 * 3. Score each surviving candidate as:
 *      authority × matchConfidence × richness(value, field)
 *    where richness rewards length (for summaries), high-resolution
 *    cover variants, and English-language signals.
 * 4. Winner = highest score.
 * 5. Confidence = winner_score / max_possible_score; below the string
 *    reject threshold (0.40) → winner=null.
 *
 * Pure function — no DB, no I/O.
 */

import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

import { resolveWeight } from './authority';
import { classifyConfidence, type FieldType } from './thresholds';

import type { Candidate, SelectorAlternative, SelectorContext, SelectorResult } from './types';

const FIELD_TYPE: FieldType = 'string';

const MIN_SUMMARY_LEN = 80; // matches enrichment-result-builder.ts <80 gate
const IDEAL_SUMMARY_LEN = 800;

/**
 * Patterns that mean "no real value" — variants vendors emit for missing
 * data. Reject these regardless of length.
 */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^no\s+image\s+available?$/iu,
  /^cover[-\s]?not[-\s]?found/iu,
  /^tba$/iu,
  /^(unknown|n\/a|none)$/iu,
  /^description\s+not\s+available$/iu,
  /^see\s+(also|wiki(pedia)?)/iu,
  /^this\s+(page|article)\s+is\s+a\s+stub/iu,
];

interface ParsedCandidate {
  candidate: Candidate;
  value: string;
  score: number;
}

export function selectString(ctx: SelectorContext): SelectorResult {
  const parsed = parseAndScore(ctx);
  if (parsed.length === 0) {
    return {
      winner: null,
      confidence: 0,
      alternatives: [],
      guardRefused: false,
      reason: 'no candidates with non-placeholder string values',
    };
  }

  const sorted = [...parsed].sort((a, b) => b.score - a.score);
  const winnerParsed = sorted[0];
  if (!winnerParsed) {
    throw new Error('selectString: empty parsed[] after non-empty check');
  }

  const maxPossible = computeMaxPossibleScore(ctx.field);
  const confidence = Math.min(1, winnerParsed.score / maxPossible);
  const decision = classifyConfidence(confidence, FIELD_TYPE);

  const alternatives = buildAlternatives(sorted.slice(1));

  if (decision === 'reject') {
    return {
      winner: null,
      confidence,
      alternatives,
      guardRefused: false,
      reason: `winner score ${winnerParsed.score.toFixed(2)} below string reject threshold`,
    };
  }

  return {
    winner: winnerParsed.candidate,
    confidence,
    alternatives,
    guardRefused: false,
    reason: `picked ${winnerParsed.candidate.provider} (score ${winnerParsed.score.toFixed(2)} / max ${maxPossible.toFixed(2)})`,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function parseAndScore(ctx: SelectorContext): ParsedCandidate[] {
  const out: ParsedCandidate[] = [];
  for (const c of ctx.candidates) {
    if (typeof c.value !== 'string') continue;
    const trimmed = c.value.trim();
    if (trimmed.length === 0) continue;
    if (isPlaceholder(trimmed)) continue;
    if (ctx.field === 'summary' && trimmed.length < MIN_SUMMARY_LEN) continue;
    const authority = resolveWeight(c.field, c.provider);
    const richness = computeRichness(trimmed, c.field);
    const score = authority * c.matchConfidence * richness;
    out.push({ candidate: c, value: trimmed, score });
  }
  return out;
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some(rx => rx.test(value));
}

/**
 * Field-aware richness multiplier in [0..1.5]. Bonuses past 1.0 let a
 * particularly strong candidate beat a higher-authority provider's weak one.
 */
function computeRichness(value: string, field: MetadataField): number {
  if (field === 'summary') return computeSummaryRichness(value);
  if (isCoverField(field)) return computeCoverRichness(value);
  if (field === 'bannerImage') return computeBannerRichness(value);
  // Generic string fields: length-normalized, capped at 1.
  return Math.min(1, value.length / 80);
}

function computeSummaryRichness(value: string): number {
  // Two factors: length saturation toward IDEAL_SUMMARY_LEN, and an
  // English-text signal (rough — punctuation density + ascii word
  // diversity).
  const lengthFactor = Math.min(1, value.length / IDEAL_SUMMARY_LEN);
  const englishFactor = computeEnglishSignal(value);
  // Weighted geometric blend so neither dominates.
  return Math.min(1.5, 0.6 + 0.6 * lengthFactor + 0.3 * englishFactor);
}

function computeEnglishSignal(value: string): number {
  // 1.0 when the string looks like English prose; 0 when it doesn't.
  // Heuristic: ratio of ascii letters + common-word density.
  const asciiLetters = (value.match(/[a-zA-Z]/gu) ?? []).length;
  const ratio = value.length > 0 ? asciiLetters / value.length : 0;
  if (ratio < 0.4) return 0; // mostly non-ascii (probably JP/CN/KR original)
  const COMMON_WORDS = /\b(the|a|an|and|of|to|in|is|for|on|with|by|that|this)\b/giu;
  const wordHits = (value.match(COMMON_WORDS) ?? []).length;
  return Math.min(1, wordHits / 10); // 10+ hits → max signal
}

const COVER_FIELDS: ReadonlySet<MetadataField> = new Set([
  'cover',
  'coverExtraLarge',
  'coverLarge',
  'coverMedium',
  'coverSmall',
]);

function isCoverField(field: MetadataField): boolean {
  return COVER_FIELDS.has(field);
}

function computeCoverRichness(url: string): number {
  // Validate URL shape; reward higher-resolution variants and CDN-stable hosts.
  if (!/^https?:\/\//iu.test(url)) return 0;
  let bonus = 1;
  if (/\/large\.|\/extraLarge\.|\.large\.|-large\./iu.test(url)) bonus += 0.3;
  if (/\/medium\.|\.medium\.|-medium\./iu.test(url)) bonus += 0.1;
  // AniList + MangaDex CDNs are durable; Fandom URLs rot.
  if (/anilist\.co|mangadex\.org|uploads\.mangadex\.org/iu.test(url)) bonus += 0.2;
  if (/static\.wikia\.|fandom\.com\/wiki/iu.test(url)) bonus -= 0.1;
  return Math.max(0, Math.min(1.5, bonus));
}

function computeBannerRichness(url: string): number {
  // Banners are AL-only today; sanity-check URL shape.
  return /^https?:\/\//iu.test(url) ? 1 : 0;
}

function computeMaxPossibleScore(field: MetadataField): number {
  // The score ceiling depends on the richness ceiling for the field.
  // Authority × matchConfidence both cap at 1; richness caps below.
  if (field === 'summary')        return 1 * 1 * 1.5;
  if (isCoverField(field))        return 1 * 1 * 1.5;
  if (field === 'bannerImage')    return 1 * 1 * 1;
  return 1; // generic string fields
}

function buildAlternatives(losers: ParsedCandidate[]): SelectorAlternative[] {
  return losers.map(p => ({
    provider: p.candidate.provider,
    value: p.value,
    confidence: Math.min(1, p.score),
  }));
}
