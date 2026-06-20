/**
 * @jest-environment node
 *
 * Unit coverage for the download-mode preference helpers:
 *   - `loadDownloadMode` — global config read with fallback to `'mix'`
 *     on missing / malformed / unrecognized values.
 *   - `modeBiasDelta` — per-release score delta given a title and mode.
 *   - `applyModeBias` — re-ranks a pre-scored list by applying the delta
 *     and re-sorting; no-op when mode is `'mix'`.
 */

jest.mock('@/server/services/config/user-config-service', () => ({
  getUserConfigValue: jest.fn(),
}));

import { getUserConfigValue } from '@/server/services/config/user-config-service';
import {
  loadDownloadMode,
  DEFAULT_DOWNLOAD_MODE,
  modeBiasDelta,
  applyModeBias,
} from '@/server/services/library/releaseDispatcher/download-mode';
import type { ScoredSearchResult } from '@/types/quickDownload.types';

const mockedGetConfig = getUserConfigValue as jest.MockedFunction<typeof getUserConfigValue>;

function scoredFixture(title: string, score: number): ScoredSearchResult {
  return {
    result: { title } as ScoredSearchResult['result'],
    score,
  };
}

describe('loadDownloadMode', () => {
  beforeEach(() => {
    mockedGetConfig.mockReset();
  });

  it("returns 'mix' when config is unset (default returned by getConfig)", async () => {
    mockedGetConfig.mockResolvedValueOnce('mix');
    await expect(loadDownloadMode()).resolves.toBe('mix');
  });

  it("returns 'prefer-volume' when set to prefer-volume", async () => {
    mockedGetConfig.mockResolvedValueOnce('prefer-volume');
    await expect(loadDownloadMode()).resolves.toBe('prefer-volume');
  });

  it("returns 'prefer-chapter' when set to prefer-chapter", async () => {
    mockedGetConfig.mockResolvedValueOnce('prefer-chapter');
    await expect(loadDownloadMode()).resolves.toBe('prefer-chapter');
  });

  it('falls back to mix on unrecognized value', async () => {
    mockedGetConfig.mockResolvedValueOnce('garbage-value');
    await expect(loadDownloadMode()).resolves.toBe(DEFAULT_DOWNLOAD_MODE);
    expect(DEFAULT_DOWNLOAD_MODE).toBe('mix');
  });

  it('falls back to mix when getConfig rejects', async () => {
    mockedGetConfig.mockRejectedValueOnce(new Error('db down'));
    await expect(loadDownloadMode()).resolves.toBe('mix');
  });

  it('falls back to mix when getConfig returns undefined', async () => {
    mockedGetConfig.mockResolvedValueOnce(undefined);
    await expect(loadDownloadMode()).resolves.toBe('mix');
  });
});

describe('modeBiasDelta', () => {
  it('returns 0 for any title under mix', () => {
    expect(modeBiasDelta('Naruto v01-v72 Complete', 'mix')).toBe(0);
    expect(modeBiasDelta('Naruto c001-c050', 'mix')).toBe(0);
    expect(modeBiasDelta('Naruto Random Release', 'mix')).toBe(0);
  });

  describe('prefer-volume', () => {
    it('rewards volume-shaped titles (+40)', () => {
      expect(modeBiasDelta('Naruto v01-v72 Complete', 'prefer-volume')).toBe(40);
      expect(modeBiasDelta('One Piece Vol 01', 'prefer-volume')).toBe(40);
      expect(modeBiasDelta('Berserk Volume 12', 'prefer-volume')).toBe(40);
      expect(modeBiasDelta('Bleach Complete Collection', 'prefer-volume')).toBe(40);
      expect(modeBiasDelta('Akira Omnibus', 'prefer-volume')).toBe(40);
    });
    it('penalizes chapter-shaped titles (-15)', () => {
      expect(modeBiasDelta('Naruto c001-c050', 'prefer-volume')).toBe(-15);
      expect(modeBiasDelta('Berserk Chapter 364', 'prefer-volume')).toBe(-15);
      expect(modeBiasDelta('Bleach ch.686', 'prefer-volume')).toBe(-15);
    });
    it('returns 0 when both markers are present (ambiguous)', () => {
      expect(modeBiasDelta('Naruto v01 c001', 'prefer-volume')).toBe(0);
    });
    it('returns 0 for titles with neither marker', () => {
      expect(modeBiasDelta('Random Release', 'prefer-volume')).toBe(0);
    });
  });

  describe('prefer-chapter', () => {
    it('rewards chapter-shaped titles (+25)', () => {
      expect(modeBiasDelta('Naruto c001-c050', 'prefer-chapter')).toBe(25);
      expect(modeBiasDelta('Berserk Chapter 364', 'prefer-chapter')).toBe(25);
      expect(modeBiasDelta('Bleach ch.686', 'prefer-chapter')).toBe(25);
    });
    it('penalizes volume-shaped titles (-20)', () => {
      expect(modeBiasDelta('Naruto v01-v72 Complete', 'prefer-chapter')).toBe(-20);
      expect(modeBiasDelta('One Piece Vol 01', 'prefer-chapter')).toBe(-20);
      expect(modeBiasDelta('Akira Omnibus', 'prefer-chapter')).toBe(-20);
    });
    it('returns 0 when both markers are present (ambiguous)', () => {
      expect(modeBiasDelta('Naruto v01 c001', 'prefer-chapter')).toBe(0);
    });
  });
});

describe('applyModeBias', () => {
  const releases: ScoredSearchResult[] = [
    scoredFixture('Naruto c001', 100),
    scoredFixture('Naruto v01-v72 Complete', 70),
    scoredFixture('Other Release', 50),
  ];

  it('is a no-op under mix', () => {
    const out = applyModeBias(releases, 'mix');
    expect(out).toBe(releases);
  });

  it('re-ranks under prefer-volume so volume beats chapter when close enough', () => {
    // chapter 100 - 15 = 85, volume 70 + 40 = 110, other 50 → volume wins
    const out = applyModeBias(releases, 'prefer-volume');
    expect(out[0]?.result.title).toBe('Naruto v01-v72 Complete');
    expect(out[0]?.score).toBe(110);
    expect(out[1]?.result.title).toBe('Naruto c001');
    expect(out[1]?.score).toBe(85);
  });

  it('re-ranks under prefer-chapter so chapter pulls further ahead', () => {
    // chapter 100 + 25 = 125, volume 70 - 20 = 50 → chapter wins by a wider margin
    const out = applyModeBias(releases, 'prefer-chapter');
    expect(out[0]?.result.title).toBe('Naruto c001');
    expect(out[0]?.score).toBe(125);
    // After bias, Other (50) and Volume (50) tie. Sort is stable on score ties.
    expect(out[1]?.score).toBe(50);
    expect(out[2]?.score).toBe(50);
  });

  it('does not mutate the input array', () => {
    const snapshot = JSON.parse(JSON.stringify(releases));
    applyModeBias(releases, 'prefer-volume');
    expect(releases).toEqual(snapshot);
  });

  it('handles an empty array under any mode', () => {
    expect(applyModeBias([], 'mix')).toEqual([]);
    expect(applyModeBias([], 'prefer-volume')).toEqual([]);
    expect(applyModeBias([], 'prefer-chapter')).toEqual([]);
  });
});
