import { describe, it, expect } from '@jest/globals';

import {
  deriveProviderOutcome, ProviderOutcomeTracker, unansweredProviders,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/provider-outcome';

describe('provider outcomes — a timeout is not a "no match"', () => {
  // Why this exists: every provider result is `T | null`, and a timed-out
  // fetch resolved to the same null as "nothing found". Destructive steps
  // downstream then treated an outage as proof that data did not exist.
  it('reports ok whenever a value was produced, even if a verify step failed', () => {
    expect(deriveProviderOutcome({ enabled: true, hasValue: true, timedOut: true, errored: true })).toBe('ok');
  });

  it('tells no_match, timeout and error apart when there is no value', () => {
    expect(deriveProviderOutcome({ enabled: true, hasValue: false, timedOut: false, errored: false })).toBe('no_match');
    expect(deriveProviderOutcome({ enabled: true, hasValue: false, timedOut: true, errored: false })).toBe('timeout');
    expect(deriveProviderOutcome({ enabled: true, hasValue: false, timedOut: true, errored: true })).toBe('error');
  });

  it('reports disabled providers as disabled', () => {
    expect(deriveProviderOutcome({ enabled: false, hasValue: false, timedOut: false, errored: false })).toBe('disabled');
  });

  it('builds outcomes for every provider and lists the unanswered ones', () => {
    const tracker = new ProviderOutcomeTracker();
    tracker.markTimeout('mangadex');
    tracker.markError('kitsu');
    tracker.markTimeout('anilist'); // verify timed out, but the first-wave value survived
    const outcomes = tracker.build(new Set(['anilist', 'mangadex', 'kitsu', 'wikipedia']), {
      anilist: { id: 1 }, mangadex: null, kitsu: null, wikipedia: null, mal: null,
    });
    expect(outcomes).toEqual({
      anilist: 'ok', mangadex: 'timeout', kitsu: 'error', wikipedia: 'no_match', mal: 'disabled',
    });
    expect(unansweredProviders(outcomes).sort()).toEqual(['kitsu', 'mangadex']);
  });

  it('treats a missing outcome map as nothing known', () => {
    expect(unansweredProviders(undefined)).toEqual([]);
  });
});
