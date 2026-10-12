/**
 * @jest-environment node
 *
 * Volume cap: exact for a finished series, 1.1x for a running one.
 *
 * Bug protected: with a 1.1x cap on a finished series, reconciliation and the
 * daily sweep rebuilt a placeholder "Volume 75" for 74-volume Bleach, the
 * phantom prune deleted it on the next refresh, and its chapters lost their
 * volume each time (29 titles held 34 such volumes).
 */
import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@/server/db', () => ({ prisma: { $queryRaw: jest.fn() } }));

import { volumeCapFor } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/db-volume-cap';

const base = { endDate: null, country: 'JP', format: 'MANGA' };

describe('volumeCapFor', () => {
  it('caps a finished 74-volume series at exactly 74, with or without a caller hint', () => {
    expect(volumeCapFor({ ...base, volumes: 74, status: 'COMPLETED' })).toEqual({ cap: 74, source: 'metadata' });
    expect(volumeCapFor({ ...base, volumes: 74, status: 'COMPLETED' }, 74).cap).toBe(74);
  });

  it('treats a series with an end date as finished even when its status still says ongoing', () => {
    expect(volumeCapFor({ ...base, volumes: 41, status: 'ONGOING', endDate: new Date('2021-09-10') }).cap).toBe(41);
  });

  it('does not let a low hint cut a finished series below its stored count (Tokyo Ghoul: hint 8, stored 14)', () => {
    expect(volumeCapFor({ ...base, volumes: 14, status: 'COMPLETED' }, 8)).toEqual({ cap: 14, source: 'metadata' });
  });

  it('keeps the 1.1x allowance for a running series, so the next volume can be created', () => {
    expect(volumeCapFor({ ...base, volumes: 74, status: 'ONGOING' }).cap).toBe(82);
    expect(volumeCapFor({ ...base, volumes: 74, status: 'HIATUS' }, 20).cap).toBe(22);
  });

  it('has no cap without a count, one volume for a Korean webtoon without volumes, and the hint alone when the title is unknown', () => {
    expect(volumeCapFor({ ...base, volumes: null, status: 'ONGOING' }).cap).toBe(Infinity);
    expect(volumeCapFor({ ...base, volumes: 0, status: 'ONGOING', country: 'KR', format: 'MANHWA' })).toEqual({ cap: 1, source: 'kr-webtoon' });
    expect(volumeCapFor(null, 20)).toEqual({ cap: 22, source: 'caller' });
    expect(volumeCapFor(null)).toEqual({ cap: Infinity, source: 'none' });
  });
});
