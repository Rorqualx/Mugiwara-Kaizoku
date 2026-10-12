/**
 * Phase 1.5 commit #7: frequency-weighted union list selector.
 *
 * Selects list-shaped Metadata fields (genres, authors, artists, tags,
 * themes, synonyms, urls, publishers). Unlike the other selectors, lists
 * unite — every provider contributes; the picker decides what to keep.
 *
 * Decision rule (per deep-dive D4):
 *
 * 1. Normalize + flatten every candidate's list. Drop empties.
 * 2. Build an item map keyed on normalized form. For each item track
 *    its providers and their (matchConfidence × authority) weights.
 * 3. Each item's confidence = Σ weights / Σ all weights for the field.
 * 4. Keep items in confidence order, capped at the per-field limit.
 * 5. Winner = synthetic Candidate carrying the kept items as its value.
 *    Per-field "winner provider" = whoever contributed the most kept items.
 * 6. Confidence = mean per-item confidence of kept items. Below the list
 *    reject threshold (0.30) → winner=null.
 *
 * Per-field caps and aliasing tables stop tag/genre blowup and merge
 * provider-side spelling drift (Sci-Fi / Science Fiction → 'sci-fi').
 *
 * Pure function — no DB, no I/O.
 */

import { synonymKey } from '@/lib/metadata/synonym-key';
import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

import { resolveWeight } from './authority';
import { classifyConfidence, type FieldType } from './thresholds';

import type { Candidate, SelectorAlternative, SelectorContext, RawSelectorResult } from './types';

const FIELD_TYPE: FieldType = 'list';

/** Per-field cap on the number of items kept. */
const FIELD_LIMITS: Partial<Record<MetadataField, number>> = {
  genres:     12,
  tags:       30,
  themes:     20,
  authors:    8,
  artists:    8,
  synonyms:   25,
  urls:       40,
  publishers: 6,
};
const DEFAULT_LIMIT = 30;

/**
 * Provider-side spelling drift normalizers. Run BEFORE keying, so
 * `Sci-Fi`/`Science Fiction`/`science_fiction` all converge.
 */
const TAG_ALIASES: ReadonlyMap<string, string> = new Map<string, string>([
  ['science fiction',        'sci-fi'],
  ['scifi',                  'sci-fi'],
  ['sci fi',                 'sci-fi'],
  ['coming of age',          'coming-of-age'],
  ['slice of life',          'slice of life'],
  ['boys love',              'boys-love'],
  ['boys-love',              'boys-love'],
  ['bl',                     'boys-love'],
  ['girls love',             'girls-love'],
  ['gl',                     'girls-love'],
  ['martial arts',           'martial-arts'],
  ['post apocalyptic',       'post-apocalyptic'],
  ['post-apocalyptic',       'post-apocalyptic'],
]);

interface Contributor {
  provider: Candidate['provider'];
  weight: number;
}

interface ItemAccum {
  /**
   * Display form. First contributor's spelling, except for person names,
   * where the heaviest contributor's spelling wins (see `addItem`).
   */
  display: string;
  /** Weight of the contributor whose spelling `display` carries. */
  displayWeight: number;
  /** Σ weights across all contributors. */
  totalWeight: number;
  contributors: Contributor[];
}

interface RankedItem {
  display: string;
  itemConfidence: number;
  contributors: Contributor[];
}

export function selectList(ctx: SelectorContext): RawSelectorResult {
  const itemMap = collectItems(ctx);
  if (itemMap.size === 0) {
    return {
      winner: null,
      confidence: 0,
      alternatives: [],
      guardRefused: false,
      reason: 'no candidates contributed list items',
    };
  }

  const totalWeight = sumAllWeights(itemMap);
  const ranked = rankItems(itemMap, totalWeight);
  const limit = FIELD_LIMITS[ctx.field] ?? DEFAULT_LIMIT;
  const kept = ranked.slice(0, limit);

  const meanConfidence =
    kept.length > 0 ? kept.reduce((s, it) => s + it.itemConfidence, 0) / kept.length : 0;
  const confidence = applyListConfidenceFloor(meanConfidence, ctx.candidates.length);

  const decision = classifyConfidence(confidence, FIELD_TYPE);
  if (decision === 'reject') {
    return {
      winner: null,
      confidence,
      alternatives: [],
      guardRefused: false,
      reason: `mean item confidence ${confidence.toFixed(2)} below list reject threshold`,
    };
  }

  const winnerCandidate: Candidate = {
    field: ctx.field,
    provider: pickWinnerProvider(kept),
    value: kept.map(item => item.display),
    matchConfidence: confidence,
  };

  return {
    winner: winnerCandidate,
    confidence,
    alternatives: buildAlternatives(ranked, kept.length),
    guardRefused: false,
    reason: `union of ${itemMap.size} items, kept ${kept.length}/${itemMap.size} (limit ${limit})`,
  };
}

// ============================================================================
// Helpers — flat, no deep nesting
// ============================================================================

function collectItems(ctx: SelectorContext): Map<string, ItemAccum> {
  const itemMap = new Map<string, ItemAccum>();
  for (const c of ctx.candidates) {
    accumulateCandidate(c, ctx.field, itemMap);
  }
  return itemMap;
}

function accumulateCandidate(
  c: Candidate,
  field: MetadataField,
  itemMap: Map<string, ItemAccum>,
): void {
  if (!Array.isArray(c.value)) return;
  const authority = resolveWeight(c.field, c.provider);
  const candidateWeight = c.matchConfidence * authority;
  for (const raw of c.value) {
    addItem(raw, c.provider, candidateWeight, field, itemMap);
  }
}

function addItem(
  raw: unknown,
  provider: Candidate['provider'],
  candidateWeight: number,
  field: MetadataField,
  itemMap: Map<string, ItemAccum>,
): void {
  if (typeof raw !== 'string') return;
  const display = raw.trim();
  if (display.length === 0) return;
  const key = normalizeListKey(display, field);
  if (key.length === 0) return;
  const existing = itemMap.get(key);
  if (existing) {
    existing.totalWeight += candidateWeight;
    existing.contributors.push({ provider, weight: candidateWeight });
    if (PERSON_NAME_FIELDS.has(field) && prefersSpelling(display, candidateWeight, existing)) {
      existing.display = display;
      existing.displayWeight = candidateWeight;
    }
  } else {
    itemMap.set(key, {
      display,
      displayWeight: candidateWeight,
      totalWeight: candidateWeight,
      contributors: [{ provider, weight: candidateWeight }],
    });
  }
}

/** Fields whose items are person names, keyed by `normalizePersonKey`. */
const PERSON_NAME_FIELDS: ReadonlySet<MetadataField> = new Set<MetadataField>(['authors', 'artists']);

/**
 * Fold the spellings of a romanised long vowel onto one form: AniList writes
 * "Eiichirou Oda" and "Kentarou Miura" where MangaUpdates writes "ODA
 * Eiichiro" and "MIURA Kentaro" (and others "Ohba" for "Ooba"). Applied to
 * the comparison key only, never to what is stored.
 */
function foldLongVowels(token: string): string {
  return token.replace(/ou|oo|oh(?![aeiouy])/gu, 'o').replace(/uu/gu, 'u');
}

/**
 * Key a person's name on its tokens, ignoring their order, case, punctuation,
 * diacritics and long-vowel romanisation — AniList writes "Eiichirou Oda",
 * MangaUpdates "ODA Eiichiro", and without this one author is stored twice.
 */
function normalizePersonKey(display: string): string {
  return display
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(token => token.length > 0)
    .map(foldLongVowels)
    .sort()
    .join(' ');
}

/**
 * Whether a later contributor's spelling should replace the kept one: the
 * heavier provider wins; an exact tie falls to string order so the result
 * does not depend on which claim was read first.
 */
function prefersSpelling(display: string, weight: number, kept: ItemAccum): boolean {
  if (weight !== kept.displayWeight) return weight > kept.displayWeight;
  return display < kept.display;
}

function normalizeListKey(display: string, field: MetadataField): string {
  if (PERSON_NAME_FIELDS.has(field)) return normalizePersonKey(display);
  // Synonyms share one key with the overlay merge and the finalize union.
  if (field === 'synonyms') return synonymKey(display);
  const lowered = display.toLowerCase().replace(/[\s_-]+/gu, ' ').trim();
  const alias = TAG_ALIASES.get(lowered);
  if (alias && (field === 'genres' || field === 'tags' || field === 'themes')) return alias;
  return lowered;
}

function sumAllWeights(itemMap: Map<string, ItemAccum>): number {
  let s = 0;
  for (const item of itemMap.values()) s += item.totalWeight;
  return s;
}

function rankItems(itemMap: Map<string, ItemAccum>, totalWeight: number): RankedItem[] {
  const items: RankedItem[] = [];
  for (const item of itemMap.values()) {
    const itemConfidence = totalWeight > 0 ? item.totalWeight / totalWeight : 0;
    items.push({ display: item.display, itemConfidence, contributors: item.contributors });
  }
  return items.sort((a, b) => b.itemConfidence - a.itemConfidence);
}

/**
 * Without a floor, a 50-item synonyms list each contributed by exactly one
 * provider would have mean confidence ~0.02 and always reject — even when
 * everything is fine. Boost the floor when there are few candidates.
 */
function applyListConfidenceFloor(meanConfidence: number, candidateCount: number): number {
  if (candidateCount <= 1) return Math.max(meanConfidence, 0.5);
  if (candidateCount <= 2) return Math.max(meanConfidence, 0.4);
  return meanConfidence;
}

function pickWinnerProvider(kept: RankedItem[]): Candidate['provider'] {
  const tally = new Map<Candidate['provider'], number>();
  for (const item of kept) {
    for (const contrib of item.contributors) {
      tally.set(contrib.provider, (tally.get(contrib.provider) ?? 0) + contrib.weight);
    }
  }
  let bestProvider: Candidate['provider'] = 'anilist';
  let bestWeight = -1;
  for (const [provider, weight] of tally) {
    if (weight > bestWeight) {
      bestProvider = provider;
      bestWeight = weight;
    }
  }
  return bestProvider;
}

function buildAlternatives(ranked: RankedItem[], keptCount: number): SelectorAlternative[] {
  return ranked.slice(keptCount).map(item => {
    const top = item.contributors.reduce(
      (best, c) => (c.weight > best.weight ? c : best),
      item.contributors[0] ?? { provider: 'anilist' as const, weight: 0 },
    );
    return { provider: top.provider, value: item.display, confidence: item.itemConfidence };
  });
}
