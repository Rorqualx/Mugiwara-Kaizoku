/**
 * @jest-environment node
 *
 * Guards who gets blamed when a stored count is implausibly low.
 *
 * Regression target: the plausibility check rejected the AniList binding on
 * every finding. With a correct AniList binding whose chapter count is null, a
 * stale MangaUpdates count (20 vs a consensus of 120) durably rejected the
 * right AniList id; the next refresh dropped it and filtered it from search.
 */
import { readFieldSupplier, shouldRejectAnchorBinding } from '../plausibility-blame';

describe('shouldRejectAnchorBinding', () => {
  it('rejects the anchor when AniList supplied the flagged count', () => {
    expect(shouldRejectAnchorBinding({ volumes: { provider: 'anilist' } }, 'volumes')).toBe(true);
  });

  it('rejects the anchor when MAL supplied it (MAL is fetched through the AniList binding)', () => {
    expect(shouldRejectAnchorBinding({ chapters: { provider: 'mal' } }, 'chapters')).toBe(true);
  });

  it.each(['mangaupdates', 'kitsu', 'mangadex'])('keeps the anchor when %s supplied the count', provider => {
    expect(shouldRejectAnchorBinding({ chapters: { provider } }, 'chapters')).toBe(false);
  });

  it('looks only at the flagged field', () => {
    const provenance = { chapters: { provider: 'mangaupdates' }, volumes: { provider: 'anilist' } };
    expect(shouldRejectAnchorBinding(provenance, 'chapters')).toBe(false);
    expect(shouldRejectAnchorBinding(provenance, 'volumes')).toBe(true);
  });

  it('keeps the historical behaviour when provenance is unknown', () => {
    expect(shouldRejectAnchorBinding(undefined, 'volumes')).toBe(true);
    expect(shouldRejectAnchorBinding({}, 'volumes')).toBe(true);
  });

  it('reads both the object and the legacy string provenance shapes', () => {
    expect(readFieldSupplier({ chapters: 'mangaupdates' }, 'chapters')).toBe('mangaupdates');
    expect(readFieldSupplier({ chapters: { provider: 'kitsu', confidence: 0.6 } }, 'chapters')).toBe('kitsu');
    expect(readFieldSupplier({ chapters: null }, 'chapters')).toBeNull();
  });
});
