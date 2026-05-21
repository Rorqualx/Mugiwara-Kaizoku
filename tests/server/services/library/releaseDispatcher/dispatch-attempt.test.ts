/**
 * @jest-environment node
 *
 * iter-EX tests for `loadFailedSourcesForManga` — verifies the read-side
 * guard map is keyed by chapterId and only includes failures within the
 * lookback window. Mocks prisma.chapterDispatchAttempt.findMany.
 */

const findManyMock = jest.fn();

jest.mock('@/server/db', () => ({
  prisma: {
    chapterDispatchAttempt: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

jest.mock('@/server/services/realtime/RealtimeEventEmitter', () => ({
  realtimeEmitter: { emitSystemEvent: jest.fn() },
}));

import { loadFailedSourcesForManga } from '@/server/services/library/releaseDispatcher/dispatch-attempt';

beforeEach(() => {
  findManyMock.mockReset();
});

describe('loadFailedSourcesForManga', () => {
  it('returns empty map when no prior failures', async () => {
    findManyMock.mockResolvedValue([]);
    const map = await loadFailedSourcesForManga(2561);
    expect(map.size).toBe(0);
  });

  it('groups source set per chapterId', async () => {
    findManyMock.mockResolvedValue([
      { chapterId: 641119, source: 'mangadex' },
      { chapterId: 641119, source: 'suwayomi' },
      { chapterId: 641121, source: 'prowlarr' },
    ]);
    const map = await loadFailedSourcesForManga(2561);
    expect(map.get(641119)).toEqual(new Set(['mangadex', 'suwayomi']));
    expect(map.get(641121)).toEqual(new Set(['prowlarr']));
    expect(map.has(999999)).toBe(false);
  });

  it('passes a 7-day cutoff and "failed" outcome filter', async () => {
    findManyMock.mockResolvedValue([]);
    await loadFailedSourcesForManga(2561);
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        mangaId: 2561,
        outcome: 'failed',
        createdAt: expect.objectContaining({ gte: expect.any(Date) }),
      }),
    }));
    const args = findManyMock.mock.calls[0]?.[0] as { where: { createdAt: { gte: Date } } };
    const cutoff = args.where.createdAt.gte;
    const ageMs = Date.now() - cutoff.getTime();
    // Within 1 minute of "7 days ago"
    expect(ageMs).toBeGreaterThan(7 * 24 * 60 * 60 * 1000 - 60_000);
    expect(ageMs).toBeLessThan(7 * 24 * 60 * 60 * 1000 + 60_000);
  });

  it('deduplicates repeated (chapter, source) pairs', async () => {
    findManyMock.mockResolvedValue([
      { chapterId: 641119, source: 'mangadex' },
      { chapterId: 641119, source: 'mangadex' },
      { chapterId: 641119, source: 'mangadex' },
    ]);
    const map = await loadFailedSourcesForManga(2561);
    expect(map.get(641119)?.size).toBe(1);
  });
});
