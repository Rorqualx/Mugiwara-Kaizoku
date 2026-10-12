/**
 * Per-provider outcome of one provider-fetch phase.
 *
 * Provider results are `T | null`, and a timeout, an error and a genuine "no
 * match" all surface as null. Destructive steps downstream need to tell them
 * apart: "the provider said nothing exists" justifies pruning, "the provider
 * did not answer" does not.
 */

export type ProviderOutcome = 'ok' | 'no_match' | 'timeout' | 'error' | 'disabled';

export type ProviderOutcomes = Record<string, ProviderOutcome>;

export interface ProviderOutcomeInput {
  enabled: boolean;
  hasValue: boolean;
  timedOut: boolean;
  errored: boolean;
}

/**
 * A provider that produced a value is `ok` even if a later verify step timed
 * out or failed (the first-wave value was kept). Without a value, an error
 * outranks a timeout, which outranks a plain no-match.
 */
export function deriveProviderOutcome(input: ProviderOutcomeInput): ProviderOutcome {
  if (!input.enabled) return 'disabled';
  if (input.hasValue) return 'ok';
  if (input.errored) return 'error';
  if (input.timedOut) return 'timeout';
  return 'no_match';
}

/** Collects timeout / error signals during the phase, then derives outcomes. */
export class ProviderOutcomeTracker {
  private readonly timedOut = new Set<string>();
  private readonly errored = new Set<string>();

  markTimeout(provider: string): void {
    this.timedOut.add(provider);
  }

  markError(provider: string): void {
    this.errored.add(provider);
  }

  build(enabled: ReadonlySet<string>, values: Record<string, unknown>): ProviderOutcomes {
    const outcomes: ProviderOutcomes = {};
    for (const [provider, value] of Object.entries(values)) {
      outcomes[provider] = deriveProviderOutcome({
        enabled: enabled.has(provider),
        hasValue: value !== null && value !== undefined,
        timedOut: this.timedOut.has(provider),
        errored: this.errored.has(provider),
      });
    }
    return outcomes;
  }
}

/** Providers that were asked and did not answer (timeout or error). */
export function unansweredProviders(outcomes: ProviderOutcomes | undefined): string[] {
  if (!outcomes) return [];
  return Object.entries(outcomes)
    .filter(([, outcome]) => outcome === 'timeout' || outcome === 'error')
    .map(([provider]) => provider);
}

/**
 * Does a provider client's swallowed-error reason mean "did not answer"?
 * Clients such as the AniList service return null/[] on any error and report
 * the reason through `onFailure`; without this the phase would read the
 * outage as a plain no-match. A not-found reply is an answer (the entity is
 * gone), not an outage.
 */
export function isUnansweredReason(reason: string): boolean {
  return !/\bnot found\b|\b404\b/iu.test(reason);
}
