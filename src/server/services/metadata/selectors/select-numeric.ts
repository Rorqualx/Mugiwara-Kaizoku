/**
 * Phase 1.5 commit #4: cluster-vote numeric selector with drift-guard fold-in.
 *
 * Decision rule (per deep-dive D4 + D5):
 *
 * 1. Coerce each candidate value to a finite number; drop the rest.
 * 2. Cluster by value with a per-field tolerance (default ±5%).
 * 3. Pick the cluster with highest summed (matchConfidence × authority).
 *    Ties break on summed weight, then on number of members.
 * 4. Winner = highest-(matchConfidence × authority) member of winning cluster.
 * 5. Confidence = winning-cluster-weight / total-weight  (the agreement %).
 * 6. **Drift-guard** (folded from `applyProvenanceGuards`): if the winner is
 *    a non-anchor provider AND would change the existing anchor value
 *    (AL/MAL) by more than `DRIFT_TOLERANCE`, REFUSE the write — winner is
 *    returned with `guardRefused: true` so telemetry can record it, but the
 *    persister will not apply it.
 * 7. Confidence below the numeric `reject` threshold from `thresholds.ts`
 *    returns `winner: null` (persister keeps the prior value).
 *
 * Pure function — no DB, no I/O.
 */

import { isAnchor } from '@/lib/metadata/provider-registry';

import { resolveWeight } from './authority';
import { classifyConfidence, type FieldType } from './thresholds';

import type { Candidate, SelectorAlternative, SelectorContext, RawSelectorResult } from './types';

const FIELD_TYPE: FieldType = 'numeric';

/**
 * Per-field cluster tolerance. Default 5% — chosen to absorb the difference
 * between AL "100 chapters" and MD's count-by-aggregating-chapter-list "104".
 * Per-field overrides accommodate stricter (idMal) or looser (popularity) fields.
 */
const CLUSTER_TOLERANCE: Partial<Record<string, number>> = {
  chapters:     0.05,
  volumes:      0.05,
  averageScore: 0.03, // 3% — scores are tight, 0..100
  popularity:   0.20, // 20% — popularity counts vary wildly between providers
  idMal:        0.0,  // exact match only — it's an ID
};
const DEFAULT_CLUSTER_TOLERANCE = 0.05;

/** Drift-guard tolerance: a non-anchor cannot overwrite an anchor by more than this. */
const DRIFT_TOLERANCE = 0.2;

interface ParsedCandidate {
  candidate: Candidate;
  value: number;
  /** matchConfidence × authority — the score the cluster sums and the picker maximizes. */
  weight: number;
}

interface Cluster {
  /** Representative value for the cluster (max-weighted member). */
  representative: number;
  members: ParsedCandidate[];
  /** Summed weight across all members. */
  totalWeight: number;
}

export function selectNumeric(ctx: SelectorContext): RawSelectorResult {
  const parsed = parseAndScore(ctx);
  if (parsed.length === 0) {
    return {
      winner: null,
      confidence: 0,
      alternatives: [],
      guardRefused: false,
      reason: 'no candidates with finite numeric values',
    };
  }

  const tolerance = CLUSTER_TOLERANCE[ctx.field] ?? DEFAULT_CLUSTER_TOLERANCE;
  const clusters = clusterByValue(parsed, tolerance);
  const winningCluster = pickWinningCluster(clusters);
  const totalWeight = parsed.reduce((sum, p) => sum + p.weight, 0);
  const agreement = totalWeight > 0 ? winningCluster.totalWeight / totalWeight : 0;

  const winnerParsed = pickClusterRepresentative(winningCluster);
  const winnerWeight = winnerParsed.weight;
  // Per-candidate confidence: own weight / cluster total. Falls back to
  // agreement so a sole-candidate field still gets a meaningful number.
  const winnerConfidence =
    winnerWeight > 0 && winningCluster.totalWeight > 0
      ? Math.min(1, agreement * (winnerWeight / winningCluster.totalWeight) + agreement * 0.5)
      : agreement;

  const alternatives = buildAlternatives(parsed, winnerParsed);
  const decision = classifyConfidence(winnerConfidence, FIELD_TYPE);

  if (decision === 'reject') {
    return {
      winner: null,
      confidence: winnerConfidence,
      alternatives,
      guardRefused: false,
      reason: `winner confidence ${winnerConfidence.toFixed(2)} below numeric reject threshold`,
    };
  }

  // Drift-guard: protect AL/MAL anchors from large overrides by non-anchors.
  const guardRefused = shouldRefuseDrift(ctx, winnerParsed.value);
  return {
    winner: winnerParsed.candidate,
    confidence: winnerConfidence,
    alternatives,
    guardRefused,
    reason: guardRefused
      ? `non-anchor drift > ${(DRIFT_TOLERANCE * 100).toFixed(0)}% from anchor ${String(ctx.existingProvider)}(${String(ctx.existingValue)})`
      : `cluster agreement ${(agreement * 100).toFixed(0)}%`,
  };
}

// ============================================================================
// Helpers
// ============================================================================

function parseAndScore(ctx: SelectorContext): ParsedCandidate[] {
  const out: ParsedCandidate[] = [];
  for (const c of ctx.candidates) {
    const v = coerceFinite(c.value);
    if (v === null) continue;
    const authority = resolveWeight(c.field, c.provider);
    out.push({ candidate: c, value: v, weight: c.matchConfidence * authority });
  }
  return out;
}

function coerceFinite(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Bucket candidates whose values lie within `tolerance` of an existing
 * cluster's representative. Greedy single-pass — sufficient for the small
 * candidate counts we see (typically 1–8 per field).
 */
function clusterByValue(parsed: ParsedCandidate[], tolerance: number): Cluster[] {
  // Sort by weight desc so the strongest candidate seeds each cluster.
  const sorted = [...parsed].sort((a, b) => b.weight - a.weight);
  const clusters: Cluster[] = [];
  for (const p of sorted) {
    const cluster = clusters.find(c => withinTolerance(c.representative, p.value, tolerance));
    if (cluster) {
      cluster.members.push(p);
      cluster.totalWeight += p.weight;
    } else {
      clusters.push({ representative: p.value, members: [p], totalWeight: p.weight });
    }
  }
  return clusters;
}

function withinTolerance(a: number, b: number, tolerance: number): boolean {
  if (tolerance === 0) return a === b;
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base <= tolerance;
}

function pickWinningCluster(clusters: Cluster[]): Cluster {
  // Sort by totalWeight desc, then by member count desc (more agreement = stronger).
  const sorted = [...clusters].sort((a, b) => {
    if (b.totalWeight !== a.totalWeight) return b.totalWeight - a.totalWeight;
    return b.members.length - a.members.length;
  });
  const winner = sorted[0];
  if (!winner) {
    throw new Error('selectNumeric: pickWinningCluster called with empty clusters[]');
  }
  return winner;
}

function pickClusterRepresentative(cluster: Cluster): ParsedCandidate {
  // Highest weight in the cluster — already sorted desc, so the first is it.
  const top = cluster.members[0];
  if (!top) {
    throw new Error('selectNumeric: cluster has no members');
  }
  return top;
}

function buildAlternatives(parsed: ParsedCandidate[], winner: ParsedCandidate): SelectorAlternative[] {
  return parsed
    .filter(p => p.candidate.provider !== winner.candidate.provider || p.value !== winner.value)
    .sort((a, b) => b.weight - a.weight)
    .map(p => ({
      provider: p.candidate.provider,
      value: p.value,
      // Per-candidate confidence: its share of total parsed weight.
      // Capped at 1 — defensive against rounding artifacts.
      confidence: Math.min(1, p.weight),
    }));
}

function shouldRefuseDrift(ctx: SelectorContext, winnerValue: number): boolean {
  const existing = coerceFinite(ctx.existingValue);
  const existingProvider = ctx.existingProvider;
  if (existing === null || existingProvider === null) return false;
  const winnerProvider = pickProvider(ctx);
  if (winnerProvider === null) return false;
  // Anchor-overwrites-anchor: not the guard's concern.
  if (isAnchor(winnerProvider)) return false;
  // Existing wasn't from an anchor: nothing to protect.
  if (!isAnchor(existingProvider)) return false;
  const drift = Math.abs(winnerValue - existing) / Math.max(Math.abs(existing), 1);
  return drift > DRIFT_TOLERANCE;
}

function pickProvider(ctx: SelectorContext): string | null {
  // Find the candidate the picker landed on. The first candidate matching
  // the winning value is good enough for guard purposes (the field-name
  // dedup happens upstream).
  const top = ctx.candidates[0];
  return top?.provider ?? null;
}
