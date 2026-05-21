/**
 * @jest-environment node
 *
 * detectConstruct tests — classifies a manga's release construct from
 * AniList metadata signals. Order of precedence matters: "Long Strip"
 * tag (the AniList webtoon indicator) wins over countryOfOrigin so
 * Korean *webtoons* don't get classified as manhwa (which is the
 * traditional print volume-based shape).
 */

import { detectConstruct, isVolumeArtifactConstruct } from '@/server/services/packImport/construct-type';

describe('detectConstruct', () => {
  it('JP + no Long Strip → manga', () => {
    expect(detectConstruct({ countryOfOrigin: 'JP', format: 'MANGA', tags: ['Action', 'Adventure'] })).toBe('manga');
  });

  it('KR + Long Strip tag → webtoon (Long Strip wins over country)', () => {
    expect(detectConstruct({ countryOfOrigin: 'KR', format: 'MANGA', tags: ['Action', 'Long Strip'] })).toBe('webtoon');
  });

  it('KR + no Long Strip → manhwa (traditional print)', () => {
    expect(detectConstruct({ countryOfOrigin: 'KR', format: 'MANGA', tags: ['Drama'] })).toBe('manhwa');
  });

  it('CN + no Long Strip → manhua', () => {
    expect(detectConstruct({ countryOfOrigin: 'CN', format: 'MANGA', tags: ['Wuxia'] })).toBe('manhua');
  });

  it('CN + Long Strip → webtoon (modern Chinese webtoon)', () => {
    expect(detectConstruct({ countryOfOrigin: 'CN', format: 'MANGA', tags: ['Long Strip'] })).toBe('webtoon');
  });

  it('null country + no tags → unknown (legacy fallback)', () => {
    expect(detectConstruct({ countryOfOrigin: null, format: null, tags: [] })).toBe('unknown');
  });

  it('US/EN/other countries → unknown', () => {
    expect(detectConstruct({ countryOfOrigin: 'US', format: 'MANGA', tags: [] })).toBe('unknown');
  });

  it('case-insensitive country code', () => {
    expect(detectConstruct({ countryOfOrigin: 'jp', format: null, tags: [] })).toBe('manga');
  });

  it('case-insensitive Long Strip tag', () => {
    expect(detectConstruct({ countryOfOrigin: 'KR', format: null, tags: ['long strip'] })).toBe('webtoon');
  });

  it('Long Strip substring match (e.g. "Long Strip 90%" voted tag)', () => {
    expect(detectConstruct({ countryOfOrigin: 'KR', format: null, tags: ['Long Strip (Manhwa)'] })).toBe('webtoon');
  });
});

describe('isVolumeArtifactConstruct', () => {
  it('webtoon → true (volume in filename is aggregator artifact)', () => {
    expect(isVolumeArtifactConstruct('webtoon')).toBe(true);
  });

  it('manga → false (real volume releases)', () => {
    expect(isVolumeArtifactConstruct('manga')).toBe(false);
  });

  it('manhwa → false (traditional print volumes)', () => {
    expect(isVolumeArtifactConstruct('manhwa')).toBe(false);
  });

  it('manhua → false (dual-mode; resolved at parser level not here)', () => {
    expect(isVolumeArtifactConstruct('manhua')).toBe(false);
  });

  it('unknown → false (legacy path must not change behavior)', () => {
    expect(isVolumeArtifactConstruct('unknown')).toBe(false);
  });
});
