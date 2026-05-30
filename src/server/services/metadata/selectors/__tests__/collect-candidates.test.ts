import { collectCandidates, type ProviderClaim } from '../collect-candidates';

describe('collectCandidates', () => {
  it('pivots per-provider claim records into per-field arrays', () => {
    const claims: ProviderClaim[] = [
      { provider: 'anilist',  matchConfidence: 0.95, fields: { chapters: 100, status: 'RELEASING' } },
      { provider: 'mangadex', matchConfidence: 0.92, fields: { chapters: 102, status: 'completed' } },
      { provider: 'mal',      matchConfidence: 0.90, fields: { chapters: 100, status: 'Finished' } },
    ];
    const byField = collectCandidates(claims);
    expect(byField.get('chapters')).toHaveLength(3);
    expect(byField.get('status')).toHaveLength(3);
  });

  it('aliases legacy keys (chapterCount → chapters, coverImage → cover)', () => {
    const claims: ProviderClaim[] = [
      { provider: 'kitsu', matchConfidence: 0.6, fields: { chapterCount: 50, coverImage: 'https://kitsu.io/cover.jpg' } },
    ];
    const byField = collectCandidates(claims);
    expect(byField.get('chapters')).toHaveLength(1);
    expect(byField.get('chapters')?.[0]?.value).toBe(50);
    expect(byField.get('cover')).toHaveLength(1);
  });

  it('drops null / undefined values without panicking', () => {
    const claims: ProviderClaim[] = [
      { provider: 'anilist', matchConfidence: 0.95, fields: { chapters: 100, summary: null, bannerImage: undefined } },
    ];
    const byField = collectCandidates(claims);
    expect(byField.get('chapters')).toBeDefined();
    expect(byField.get('summary')).toBeUndefined();
    expect(byField.get('bannerImage')).toBeUndefined();
  });

  it('drops unknown keys not registered in the field-type registry', () => {
    const claims: ProviderClaim[] = [
      { provider: 'mangadex', matchConfidence: 0.95, fields: { mangadexMeta: { status: 'completed' }, themes: ['Action'] } },
    ];
    const byField = collectCandidates(claims);
    expect(byField.get('themes')).toBeDefined();
    // mangadexMeta isn't a MetadataField — should not appear.
    expect([...byField.keys()].find(k => String(k) === 'mangadexMeta')).toBeUndefined();
  });
});
