import { MIN_BIND_SCORE, validateBindingFreshness } from '../freshness-check';

describe('validateBindingFreshness', () => {
  it('flags stale bindings below the per-provider threshold', () => {
    const result = validateBindingFreshness({
      mangaId: 42,
      provider: 'anilist',
      currentScore: 0.55,
      boundEntityId: '12345',
      manualPin: false,
    });
    expect(result.stale).toBe(true);
    expect(result.threshold).toBe(MIN_BIND_SCORE.anilist);
  });

  it('accepts bindings at or above threshold', () => {
    const result = validateBindingFreshness({
      mangaId: 42,
      provider: 'anilist',
      currentScore: 0.85,
      boundEntityId: '12345',
      manualPin: false,
    });
    expect(result.stale).toBe(false);
  });

  it('skips the check when the binding is a manual pin', () => {
    const result = validateBindingFreshness({
      mangaId: 42,
      provider: 'comicvine',
      currentScore: 0.10, // wildly below threshold
      boundEntityId: '99999',
      manualPin: true,
    });
    expect(result.stale).toBe(false);
  });

  it('uses provider-specific thresholds', () => {
    expect(MIN_BIND_SCORE.comicvine).toBe(0.55);
    expect(MIN_BIND_SCORE.anilist).toBe(0.70);
    const cvScoreAtAnilistThreshold = 0.60; // above CV threshold, below AL threshold
    expect(validateBindingFreshness({
      mangaId: 42, provider: 'comicvine', currentScore: cvScoreAtAnilistThreshold,
      boundEntityId: null, manualPin: false,
    }).stale).toBe(false);
    expect(validateBindingFreshness({
      mangaId: 42, provider: 'anilist', currentScore: cvScoreAtAnilistThreshold,
      boundEntityId: null, manualPin: false,
    }).stale).toBe(true);
  });
});
