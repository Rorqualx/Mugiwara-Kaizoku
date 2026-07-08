/**
 * Phase 1.5 commit #9: shadow-mode runner.
 *
 * Calls every per-field-type selector against the candidates the builder
 * just collected, returns a structured `ShadowSelection` that the persister
 * (commit #10) writes alongside the legacy result for evidence-gathering.
 *
 * Pure function — no DB, no I/O.
 */

import type { MetadataField, SourceName } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

import { type ConfidenceClass } from './thresholds';
import { getFieldType, type Candidate, type SelectorContext } from './types';

import { selectField } from './index';

export interface ShadowFieldOutcome {
  winnerProvider: SourceName | null;
  winnerValue: unknown;
  confidence: number;
  /** Persistence class — 'persist-with-badge' flags a low-confidence commit. */
  confidenceClass: ConfidenceClass;
  alternatives: Array<{ provider: SourceName; value: unknown; confidence: number }>;
  guardRefused: boolean;
  reason: string;
}

export interface ShadowSelection {
  /** Per-field selector decisions. Only includes fields with ≥1 candidate. */
  outcomes: Map<MetadataField, ShadowFieldOutcome>;
  /** Field names where the guard refused the write. */
  refusedFields: MetadataField[];
}

export function runShadowSelection(byField: Map<MetadataField, Candidate[]>): ShadowSelection {
  const outcomes = new Map<MetadataField, ShadowFieldOutcome>();
  const refusedFields: MetadataField[] = [];

  for (const [field, candidates] of byField) {
    if (candidates.length === 0) continue;
    const ctx: SelectorContext = {
      mangaId: candidates[0]?.field === field ? 0 : 0, // mangaId not needed in pure selector
      field,
      fieldType: getFieldType(field),
      candidates,
      existingValue: null,
      existingProvider: null,
    };
    const result = selectField(ctx);
    outcomes.set(field, {
      winnerProvider: result.winner?.provider ?? null,
      winnerValue: result.winner?.value ?? null,
      confidence: result.confidence,
      confidenceClass: result.confidenceClass,
      alternatives: result.alternatives,
      guardRefused: result.guardRefused,
      reason: result.reason,
    });
    if (result.guardRefused) refusedFields.push(field);
  }

  return { outcomes, refusedFields };
}

/**
 * Diff the selector's picks against the legacy Object.assign chain's picks.
 *
 * `legacyMetadata` is the `metadata` Record the result-builder ends up
 * writing today; `legacyProvenance` is the same builder's per-field
 * provenance map. Both are read-only inputs.
 *
 * Returns an array of `{field, oldValue, oldProvider, newValue, newProvider}`
 * for every field where the selector's pick differs from the legacy pick.
 */
export interface ShadowDelta {
  field: MetadataField;
  oldValue: unknown;
  oldProvider: SourceName | null;
  newValue: unknown;
  newProvider: SourceName | null;
}

export function computeShadowDeltas(
  shadow: ShadowSelection,
  legacyMetadata: Record<string, unknown>,
  legacyProvenance: Record<string, string>,
): ShadowDelta[] {
  const out: ShadowDelta[] = [];
  for (const [field, outcome] of shadow.outcomes) {
    const oldValue = legacyMetadata[field];
    const oldProvider = (legacyProvenance[field] ?? null) as SourceName | null;
    if (
      outcome.winnerProvider !== oldProvider ||
      !valuesEqual(outcome.winnerValue, oldValue)
    ) {
      out.push({
        field,
        oldValue: oldValue ?? null,
        oldProvider,
        newValue: outcome.winnerValue,
        newProvider: outcome.winnerProvider,
      });
    }
  }
  return out;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => valuesEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}
