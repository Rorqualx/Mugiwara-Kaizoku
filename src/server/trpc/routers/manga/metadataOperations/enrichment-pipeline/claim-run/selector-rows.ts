/**
 * Scalar claim rows: each provider's own value per field, labelled with what
 * the selector did with it.
 *
 * Nothing here decides anything. The winner, the winning group and each
 * candidate's normalised value are read from the selector's result
 * (`ShadowFieldOutcome.ballots`); a provider whose value the selector dropped
 * gets `not_counted`, never a borrowed outcome.
 *
 * Pure: no database, no network.
 */

import type { ClaimJson, ClaimSelectorOutcome } from '@/server/services/metadata/provider-claims/claim-types';
import { mapKeyToField, type ProviderClaim } from '@/server/services/metadata/selectors/collect-candidates';
import type { ShadowFieldOutcome, ShadowSelection } from '@/server/services/metadata/selectors/shadow-mode';

/** A scalar row before the provider's fetch outcome and record id are attached. */
export interface ScalarFragment {
  provider: string;
  field: string;
  value: ClaimJson;
  selectorOutcome: ClaimSelectorOutcome;
  inWinningGroup: boolean | null;
  matchConfidence: number | null;
  fieldConfidence: number | null;
}

const CONFIDENCE_DECIMALS = 10_000;

function roundConfidence(n: number): number | null {
  return Number.isFinite(n) ? Math.round(n * CONFIDENCE_DECIMALS) / CONFIDENCE_DECIMALS : null;
}

/**
 * A value as plain JSON, or undefined when there is nothing to store (the
 * provider gave no value, or it cannot be serialised).
 */
export function toClaimJson(value: unknown): ClaimJson | undefined {
  if (value === null || value === undefined) return undefined;
  try {
    const text = JSON.stringify(value);
    if (typeof text !== 'string') return undefined;
    const parsed = JSON.parse(text) as ClaimJson;
    return parsed ?? undefined;
  } catch {
    return undefined;
  }
}

interface Verdict {
  outcome: ClaimSelectorOutcome;
  inWinningGroup: boolean | null;
}

/** What the selector did with `provider`'s value for one field. */
export function selectorVerdict(provider: string, decided: ShadowFieldOutcome): Verdict {
  const ballots = decided.ballots;
  const ballot = ballots?.find(b => b.provider === provider);
  // A voting selector that has no ballot for this provider dropped its value.
  if (ballots && !ballot) return { outcome: 'not_counted', inWinningGroup: null };
  const inWinningGroup = ballot ? ballot.inWinningGroup : null;

  if (decided.guardRefused) return { outcome: 'refused', inWinningGroup };
  if (decided.winnerProvider === null) return { outcome: 'not_selected', inWinningGroup };
  if (decided.winnerProvider === provider) return { outcome: 'winner', inWinningGroup };
  // Ranked or merged field types have no notion of "the same value".
  if (!ballots || !ballot) return { outcome: 'not_compared', inWinningGroup };

  const winnerBallot = ballots.find(b => b.provider === decided.winnerProvider);
  const sameValue = winnerBallot !== undefined && winnerBallot.normalized === ballot.normalized;
  return { outcome: sameValue ? 'agrees' : 'dissent', inWinningGroup };
}

function fragmentFor(claim: ProviderClaim, rawKey: string, value: ClaimJson, shadow: ShadowSelection): ScalarFragment {
  const field = mapKeyToField(rawKey);
  const decided = field === null ? undefined : shadow.outcomes.get(field);
  const matchConfidence = roundConfidence(claim.matchConfidence);
  if (field === null || !decided) {
    // No selector rule for this key: the value is the provider's, nothing voted on it.
    return {
      provider: claim.provider, field: field ?? rawKey, value,
      selectorOutcome: 'not_compared', inWinningGroup: null, matchConfidence, fieldConfidence: null,
    };
  }
  const verdict = selectorVerdict(claim.provider, decided);
  return {
    provider: claim.provider, field, value,
    selectorOutcome: verdict.outcome, inWinningGroup: verdict.inWinningGroup,
    matchConfidence, fieldConfidence: roundConfidence(decided.confidence),
  };
}

/**
 * One fragment per (provider, field) the provider gave a value for. Providers
 * that gave no value for a field get no row.
 */
export function buildSelectorFragments(claims: readonly ProviderClaim[], shadow: ShadowSelection): ScalarFragment[] {
  const fragments: ScalarFragment[] = [];
  const seen = new Set<string>();
  for (const claim of claims) {
    for (const [rawKey, raw] of Object.entries(claim.fields)) {
      const value = toClaimJson(raw);
      if (value === undefined) continue;
      const fragment = fragmentFor(claim, rawKey, value, shadow);
      const key = `${fragment.provider}|${fragment.field}`;
      if (seen.has(key)) continue;
      seen.add(key);
      fragments.push(fragment);
    }
  }
  return fragments;
}
