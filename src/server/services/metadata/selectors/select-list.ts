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

import type { MetadataField } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

import { resolveWeight } from './authority';
import { classifyConfidence, type FieldType } from './thresholds';

import type { Candidate, SelectorAlternative, SelectorContext, SelectorResult } from './types';

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
  /** Canonical-cased display form picked from the first contributor. */
  display: string;
  /** Σ weights across all contributors. */
  totalWeight: number;
  contributors: Contributor[];
}

interface RankedItem {
  display: string;
  itemConfidence: number;
  contributors: Contributor[];
}

export function selectList(ctx: SelectorContext): SelectorResult {
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
  } else {
    itemMap.set(key, {
      display,
      totalWeight: candidateWeight,
      contributors: [{ provider, weight: candidateWeight }],
    });
  }
}

function normalizeListKey(display: string, field: MetadataField): string {
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
