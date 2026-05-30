/**
 * Phase 1.5 commit #10: telemetry write helper.
 *
 * Persists one `MetadataSelectionAttempt` row per enrichment pass that ran
 * the cross-source consensus selector. Called by `phase-provider-fetch.ts`
 * after `buildEnrichmentResult` so shadow-mode deltas are captured even
 * before the cutover in commit #12.
 *
 * Failures are swallowed + logged — telemetry must never block enrichment.
 */

import { prisma } from '@/server/db';
import type { MetadataField, SourceName } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';
import { logger } from '@/utils/logger';

import type { ShadowDelta, ShadowSelection } from './shadow-mode';
import type { Prisma } from '@prisma/client';

/**
 * Bumped whenever authority weights or selector rules change. Lets
 * historical attempts be compared against current behavior without
 * re-running enrichment.
 */
export const SELECTOR_VERSION = '1.0.0';

interface SelectionSummary {
  winner: SourceName | null;
  winnerConfidence: number;
  dissenterCount: number;
}

export async function persistSelectionAttempt(
  mangaId: number,
  shadow: ShadowSelection,
  deltas: ShadowDelta[],
): Promise<void> {
  try {
    await prisma.metadataSelectionAttempt.create({
      data: {
        mangaId,
        selectorVersion: SELECTOR_VERSION,
        selections: buildSelectionsSummary(shadow) as unknown as Prisma.InputJsonValue,
        refusedFields: shadow.refusedFields.map(f => String(f)),
        shadowDeltas: buildShadowDeltasJson(deltas) as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err: unknown) {
    // Telemetry failure must not abort enrichment.
    logger.warn(
      `MetadataSelectionAttempt write failed for manga ${mangaId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function buildSelectionsSummary(shadow: ShadowSelection): Record<string, SelectionSummary> {
  const out: Record<string, SelectionSummary> = {};
  for (const [field, outcome] of shadow.outcomes) {
    out[field] = {
      winner: outcome.winnerProvider,
      winnerConfidence: round3(outcome.confidence),
      dissenterCount: outcome.alternatives.length,
    };
  }
  return out;
}

function buildShadowDeltasJson(
  deltas: ShadowDelta[],
): Record<string, { newProvider: SourceName | null; oldProvider: SourceName | null; newValue: unknown; oldValue: unknown }> {
  const out: Record<string, { newProvider: SourceName | null; oldProvider: SourceName | null; newValue: unknown; oldValue: unknown }> = {};
  for (const d of deltas) {
    out[d.field as MetadataField] = {
      newProvider: d.newProvider,
      oldProvider: d.oldProvider,
      newValue: d.newValue,
      oldValue: d.oldValue,
    };
  }
  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
