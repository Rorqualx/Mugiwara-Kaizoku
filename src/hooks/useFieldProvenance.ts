/**
 * Phase 4 #1: Per-field provenance hook.
 *
 * Surfaces `Manga.providerMetadata.metadataProvenance` (Phase 0) + the most
 * recent `MetadataSelectionAttempt` (Phase 1.5) as a typed record the UI
 * provenance badge can render.
 *
 * Takes provenance + selection inputs directly rather than querying — the
 * calling component usually already has the manga loaded. Caller passes
 * what it has; missing inputs degrade gracefully.
 *
 * Graceful degradation:
 * - Pre-Phase-0 manga rows have no provenance → returns `null` per field
 * - Pre-Phase-1.5-cutover manga rows have no `fieldAlternatives` populated
 *   → alternatives array is empty but the winner provider is still present
 */

import { useCallback, useMemo } from 'react';

import type { MetadataField, SourceName } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';

export interface FieldProvenance {
  field: MetadataField;
  winner: SourceName | null;
  /** Selector confidence (Phase 1.5 cutover sets this; pre-cutover = 0.9 by convention). */
  confidence: number;
  alternatives: Array<{ provider: SourceName; value: unknown; confidence: number }>;
  /** True when the user pinned this field's source. */
  manual: boolean;
}

interface ProvenanceEntryShape {
  provider?: string;
  confidence?: number;
  alternatives?: unknown;
  manual?: boolean;
}

type ProvenanceEntry = string | ProvenanceEntryShape;

export interface SelectionAttemptInput {
  selections: Record<string, { winner: string | null; winnerConfidence: number; dissenterCount: number }>;
  shadowDeltas: Record<string, { newProvider: string | null; newValue: unknown }> | null;
}

interface UseFieldProvenanceInput {
  /** Manga.providerMetadata as a raw JSON value. Hook narrows internally. */
  providerMetadata: unknown;
  /** Most recent MetadataSelectionAttempt row (or null when none yet). */
  latestAttempt: SelectionAttemptInput | null;
}

export function useFieldProvenance(input: UseFieldProvenanceInput): {
  getProvenance: (field: MetadataField) => FieldProvenance | null;
} {
  const provenanceMap = useMemo<Record<string, ProvenanceEntry>>(() => {
    const pm = input.providerMetadata as { metadataProvenance?: Record<string, ProvenanceEntry> } | null | undefined;
    return pm?.metadataProvenance ?? {};
  }, [input.providerMetadata]);

  const getProvenance = useCallback(
    (field: MetadataField): FieldProvenance | null => {
      const entry = provenanceMap[field];
      const selection = input.latestAttempt?.selections[field];
      const winner = resolveWinner(entry, selection);
      if (!winner) return null;
      return {
        field,
        winner,
        confidence: selection?.winnerConfidence ?? resolveConfidence(entry),
        alternatives: [],
        manual: resolveManual(entry),
      };
    },
    [provenanceMap, input.latestAttempt],
  );

  return { getProvenance };
}

function resolveWinner(
  entry: ProvenanceEntry | undefined,
  selection: SelectionAttemptInput['selections'][string] | undefined,
): SourceName | null {
  if (selection?.winner) return selection.winner as SourceName;
  if (typeof entry === 'string') return entry as SourceName;
  if (typeof entry === 'object' && typeof entry.provider === 'string') {
    return entry.provider as SourceName;
  }
  return null;
}

function resolveConfidence(entry: ProvenanceEntry | undefined): number {
  if (typeof entry === 'object' && typeof entry.confidence === 'number') {
    return entry.confidence;
  }
  return 0.9;
}

function resolveManual(entry: ProvenanceEntry | undefined): boolean {
  return typeof entry === 'object' && entry.manual === true;
}
