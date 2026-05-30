/**
 * Adapter — Phase 0/1.5 write shapes → EnhancedProviderData (badge input).
 *
 * The persister writes per-field provenance as `{provider, confidence?}` into
 * `Manga.providerMetadata.metadataProvenance` (Phase 0 shape). Phase 1.5
 * additionally writes `MetadataSelectionAttempt.shadowDeltas` rows + future
 * `Metadata.fieldAlternatives` (post-cutover).
 *
 * `FieldProvenanceBadge` consumes `EnhancedProviderData` from `./types`.
 * This adapter is the missing wire between the two — the existing badge
 * component was built before Phase 0 shipped, so its hook was reading a
 * legacy `{source, confidence, lastUpdated}` shape that no one writes
 * anymore.
 */

import { parseFieldAlternatives } from '@/types/domain/field-alternatives-types';

import type { EnhancedProviderData } from './types';

interface Phase0ProvenanceEntry {
  provider?: string;
  confidence?: number;
  manual?: boolean;
  alternatives?: Array<{ provider: string; value: unknown; confidence: number }>;
}

interface ProviderMetadataShape {
  metadataProvenance?: Record<string, Phase0ProvenanceEntry | string | undefined>;
}

interface SelectionRow {
  selections: Record<string, { winner: string | null; winnerConfidence: number; dissenterCount: number }> | null;
  shadowDeltas: Record<string, { newProvider: string | null; oldProvider: string | null; newValue: unknown; oldValue: unknown }> | null;
}

/**
 * Build `EnhancedProviderData` for a single field by combining:
 *   1. Phase 0 `metadataProvenance` entry  (always present post-Phase-0)
 *   2. Phase 1.5 selection summary         (the most recent attempt row)
 *   3. Phase 1.5 alternatives              (from `Metadata.fieldAlternatives` — cutover-gated; null until #12)
 *
 * Returns `null` when no provenance exists for the field — the badge
 * gracefully renders nothing in that case.
 */
export function buildEnhancedProvenance(
  field: string,
  providerMetadata: unknown,
  latestAttempt: SelectionRow | null,
  fieldAlternatives: unknown,
): EnhancedProviderData | null {
  const provenanceEntry = extractPhase0Entry(field, providerMetadata);
  const selectionEntry = latestAttempt?.selections?.[field];
  const altSourceEntry = extractAlternativesEntry(field, fieldAlternatives);

  const provider = selectionEntry?.winner ?? extractProvider(provenanceEntry);
  if (!provider) return null;

  const confidence = selectionEntry
    ? toPercentage(selectionEntry.winnerConfidence)
    : toPercentage(extractConfidence(provenanceEntry));

  const alternatives = mergeAlternatives(altSourceEntry, provenanceEntry?.alternatives);
  const result: EnhancedProviderData = { provider, confidence };
  if (alternatives.length > 0) result.alternatives = alternatives;
  return result;
}

function extractPhase0Entry(field: string, providerMetadata: unknown): Phase0ProvenanceEntry | null {
  if (typeof providerMetadata !== 'object' || providerMetadata === null) return null;
  const pm = providerMetadata as ProviderMetadataShape;
  const entry = pm.metadataProvenance?.[field];
  if (entry === undefined) return null;
  if (typeof entry === 'string') return { provider: entry };
  return entry;
}

function extractProvider(entry: Phase0ProvenanceEntry | null): string | null {
  if (!entry) return null;
  return typeof entry.provider === 'string' ? entry.provider : null;
}

function extractConfidence(entry: Phase0ProvenanceEntry | null): number {
  if (entry && typeof entry.confidence === 'number') return entry.confidence;
  // Pre-Phase-1.5 default — confidence isn't recorded yet.
  return 0.9;
}

function extractAlternativesEntry(
  field: string,
  fieldAlternatives: unknown,
): Array<{ provider: string; value: unknown; confidence: number }> | null {
  // Phase 2 #3 Zod schema enforced here at the reader boundary. Malformed
  // payloads (e.g. legacy rows or a future selectorVersion shape we don't
  // recognize) fall through to null instead of crashing the UI.
  const parsed = parseFieldAlternatives(fieldAlternatives);
  if (!parsed) return null;
  const entry = parsed[field];
  if (!entry || entry.length === 0) return null;
  // Zod's inferred `value: z.unknown()` is structurally optional; widen back
  // to required-unknown for the consumer signature.
  return entry.map(a => ({ provider: a.provider, value: a.value as unknown, confidence: a.confidence }));
}

function mergeAlternatives(
  fromColumn: Array<{ provider: string; value: unknown; confidence: number }> | null,
  fromProvenance: Phase0ProvenanceEntry['alternatives'] | undefined,
): Array<{ provider: string; value: unknown; confidence: number }> {
  // `Metadata.fieldAlternatives` is the authoritative source (Phase 1.5 cutover).
  // Provenance entry alternatives are a forward-compatibility hook that was
  // never wired. Prefer column data; fall back to provenance.
  if (fromColumn && fromColumn.length > 0) {
    return fromColumn.map(a => ({
      provider: a.provider,
      value: a.value,
      confidence: toPercentage(a.confidence),
    }));
  }
  if (fromProvenance && fromProvenance.length > 0) {
    return fromProvenance.map(a => ({
      provider: a.provider,
      value: a.value,
      confidence: toPercentage(a.confidence),
    }));
  }
  return [];
}

function toPercentage(value: number): number {
  // EnhancedProviderData.confidence is a 0–100 percentage; the upstream
  // selector writes 0–1. Convert here in one place.
  if (value > 1) return Math.round(Math.min(value, 100));
  return Math.round(Math.min(value, 1) * 100);
}
