/**
 * Follow-up fetches ("stages") and what they do to a provider's outcome.
 *
 * The rule: `ok` means everything asked of the provider arrived.
 *  - A stage is `failed` when it asked for pages and none came back, `partial`
 *    when some did, `ok` when all did (or nothing was asked for).
 *  - A provider whose own fetch was `ok` becomes `partial` as soon as one of
 *    its stages is not `ok`. Its claims are still recorded, stamped `partial`,
 *    and `getLastGoodClaim` does not treat that run as good.
 *  - A gate noted after the fetch phase reported (the reconciliation gate)
 *    turns an `ok` or `partial` provider into `gated`.
 *
 * Pure: no database, no network.
 */

import type { ClaimFetchOutcome, ClaimJson } from '@/server/services/metadata/provider-claims/claim-types';

import type { FetchVerdict } from './fetch-rows';
import type { PageCounts } from './recorder';

export interface StageNote extends PageCounts {
  provider: string;
  stage: string;
}

export interface StageSummary extends StageNote {
  /** How many separate fetches were folded into this row. */
  calls: number;
  outcome: ClaimFetchOutcome;
}

/** Whole counts only; anything else is recorded as nothing asked, nothing fetched. */
function count(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function stageOutcome(requested: number, fetched: number): ClaimFetchOutcome {
  if (requested <= 0 || fetched >= requested) return 'ok';
  return fetched <= 0 ? 'failed' : 'partial';
}

/** One summary per (provider, stage): repeated fetches of a stage are added up. */
export function summariseStages(notes: readonly StageNote[]): StageSummary[] {
  const byKey = new Map<string, StageSummary>();
  for (const note of notes) {
    const key = `${note.provider}|${note.stage}`;
    const seen = byKey.get(key);
    const requested = (seen?.requested ?? 0) + count(note.requested);
    const fetched = (seen?.fetched ?? 0) + count(note.fetched);
    byKey.set(key, {
      provider: note.provider, stage: note.stage, requested, fetched,
      calls: (seen?.calls ?? 0) + 1, outcome: stageOutcome(requested, fetched),
    });
  }
  return [...byKey.values()];
}

function withOutcome(verdict: FetchVerdict, outcome: ClaimFetchOutcome, extra: { [key: string]: ClaimJson }): FetchVerdict {
  return { ...verdict, outcome, detail: { ...verdict.detail, ...extra } };
}

/**
 * The provider outcomes as stored: the fetch phase's verdicts, lowered by any
 * stage that fell short and by any gate noted after the phase reported.
 */
export function finaliseVerdicts(
  verdicts: readonly FetchVerdict[],
  stages: readonly StageSummary[],
  gated: ReadonlyMap<string, string>,
): FetchVerdict[] {
  return verdicts.map(verdict => {
    const gateReason = gated.get(verdict.provider);
    if (gateReason !== undefined && (verdict.outcome === 'ok' || verdict.outcome === 'partial')) {
      return withOutcome(verdict, 'gated', { reason: gateReason });
    }
    if (verdict.outcome !== 'ok') return verdict;
    const short = stages.filter(s => s.provider === verdict.provider && s.outcome !== 'ok');
    if (short.length === 0) return verdict;
    return withOutcome(verdict, 'partial', { reason: `stage_incomplete:${short.map(s => s.stage).join(',')}` });
  });
}
