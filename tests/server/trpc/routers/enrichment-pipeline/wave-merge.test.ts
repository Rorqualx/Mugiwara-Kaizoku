import { describe, it, expect, jest } from '@jest/globals';

import { settledValueOr } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/wave-merge';

describe('settledValueOr — a second-wave step never erases first-wave data', () => {
  // Why this exists: the second wave ran under Promise.all and assigned its
  // results unconditionally. One MangaDex search error rejected the whole
  // provider-fetch phase, and a timed-out MangaDex/MangaUpdates verify (which
  // resolves null) overwrote the good first-wave match.
  const firstWave = { id: 'wave-1' };

  it('keeps the first-wave value when the step rejects, and reports it', () => {
    const onRejected = jest.fn();
    const reason = new Error('search failed');
    const settled: PromiseSettledResult<{ id: string } | null> = { status: 'rejected', reason };
    expect(settledValueOr(settled, firstWave, 'mangadex-verify', onRejected)).toBe(firstWave);
    expect(onRejected).toHaveBeenCalledWith('mangadex-verify', reason);
  });

  it('keeps the first-wave value when the step timed out (resolved null)', () => {
    const settled: PromiseSettledResult<{ id: string } | null> = { status: 'fulfilled', value: null };
    expect(settledValueOr(settled, firstWave, 'mangaupdates-verify')).toBe(firstWave);
  });

  it('takes the second-wave value when the step produced one', () => {
    const verified = { id: 'wave-2' };
    const settled: PromiseSettledResult<{ id: string } | null> = { status: 'fulfilled', value: verified };
    expect(settledValueOr(settled, firstWave, 'mangadex-verify')).toBe(verified);
  });

  it('returns null when neither wave produced a value', () => {
    const settled: PromiseSettledResult<{ id: string } | null> = { status: 'rejected', reason: 'boom' };
    expect(settledValueOr(settled, null, 'comicvine-verify')).toBeNull();
  });
});
