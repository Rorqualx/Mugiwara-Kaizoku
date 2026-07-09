/**
 * Phase 3: Sticky-binding freshness check.
 *
 * Once a provider binding is established (the manga has a non-null
 * `Manga.providerMetadata.{provider}.providerId`), the binding persists
 * indefinitely. If the upstream provider's data changes — a CV volume
 * gets re-categorized, an AL entry merges, a Fandom wiki moves — the next
 * re-enrichment fetches the wrong entity and pollutes Metadata silently.
 *
 * This module detects that case: when a re-enrichment's matcher score
 * falls below `MIN_BIND_SCORE[provider]` for an already-bound provider,
 * emit a structured warning so the operator can decide whether to
 * invalidate via `scripts/surveys/invalidate-binding.ts`.
 *
 * Phase 3 v1 — logs only. Auto-invalidation is deferred until the warning
 * rate is calibrated.
 */

import { ALL_PROVIDERS, bindMinFor } from '@/lib/metadata/provider-registry';
import type { SourceName } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/source-priority-config';
import { logger } from '@/utils/logger';

/**
 * Per-provider minimum match score required to keep a binding. Derived
 * from each provider's existing matcher accept-threshold + bind-loop
 * parity data (see `project_bind_loop_parity_harnesses` memory).
 *
 * Below these floors, the current matcher would no longer have accepted
 * the binding — so the binding is presumptively stale.
 */
export const MIN_BIND_SCORE: Record<SourceName, number> = Object.fromEntries(
  ALL_PROVIDERS.map((p) => [p, bindMinFor(p)]),
) as Record<SourceName, number>;

export interface BindingFreshnessResult {
  /** True when the binding is presumptively stale (currentScore < threshold). */
  stale: boolean;
  currentScore: number;
  threshold: number;
}

/**
 * Compare a freshly-computed matcher score against the provider's minimum
 * binding threshold. Logs a structured warning when stale. Skips entirely
 * when `manualPin` is true — pinned bindings (`Manga.selectedSourceId`)
 * are intentional overrides and must not be flagged.
 *
 * Returns the freshness verdict so callers can record it in telemetry if
 * desired; current callers only care about the warning side-effect.
 */
export function validateBindingFreshness(args: {
  mangaId: number;
  provider: SourceName;
  currentScore: number;
  boundEntityId: string | null;
  manualPin: boolean;
}): BindingFreshnessResult {
  const { mangaId, provider, currentScore, boundEntityId, manualPin } = args;
  const threshold = MIN_BIND_SCORE[provider];
  const stale = !manualPin && currentScore < threshold;

  if (stale) {
    logger.warn(
      `[BindingFreshness] ${provider} binding for manga ${mangaId} is stale: score ${currentScore.toFixed(2)} < ${threshold.toFixed(2)}`,
      { mangaId, provider, currentScore, threshold, boundEntityId },
    );
  }

  return { stale, currentScore, threshold };
}
