/**
 * @jest-environment node
 *
 * Soft-fail helper tests (Part A of the jobs-page manual-import iter):
 *
 *   - `extractChapterIdsFromPayload` — guard against the various malformed
 *     payload shapes Prisma's JsonValue can take, plus the happy path.
 *   - `resetChaptersToPending` — verifies the row-shaped Prisma updateMany
 *     call hits exactly the requested ids and writes PENDING (no broad
 *     sweep, no ERROR).
 */

import { extractChapterIdsFromPayload } from '@/server/services/download/job-payload';
import { resetChaptersToPending } from '@/server/services/download/download-monitor/chapter-manager';

describe('extractChapterIdsFromPayload', () => {
  it('returns [] for null/undefined payloads', () => {
    expect(extractChapterIdsFromPayload(null)).toEqual([]);
  });

  it('returns [] when payload is not an object', () => {
    expect(extractChapterIdsFromPayload('string-payload')).toEqual([]);
    expect(extractChapterIdsFromPayload(42)).toEqual([]);
    expect(extractChapterIdsFromPayload(true)).toEqual([]);
  });

  it('returns [] when payload is an array (top-level)', () => {
    expect(extractChapterIdsFromPayload([1, 2, 3])).toEqual([]);
  });

  it('returns [] when chapterIds is missing', () => {
    expect(extractChapterIdsFromPayload({ mode: 'BULK' })).toEqual([]);
  });

  it('returns [] when chapterIds is not an array', () => {
    expect(extractChapterIdsFromPayload({ chapterIds: 'not-array' })).toEqual([]);
    expect(extractChapterIdsFromPayload({ chapterIds: 42 })).toEqual([]);
  });

  it('filters out non-integer entries', () => {
    // Cast through `unknown` because Prisma's JsonValue rightly rejects
    // `undefined`; we're explicitly testing defensive handling of a
    // malformed payload at runtime.
    const malformed = { chapterIds: [1, 'two', 3, 4.5, null, undefined, NaN, 5] } as unknown;
    expect(extractChapterIdsFromPayload(malformed as never)).toEqual([1, 3, 5]);
  });

  it('returns the happy-path integer set', () => {
    expect(extractChapterIdsFromPayload({
      chapterIds: [10, 20, 30],
      mode: 'BULK',
      indexer: 'Nyaa.si',
    })).toEqual([10, 20, 30]);
  });
});

describe('resetChaptersToPending', () => {
  function makeMockPrisma(state: { calls: unknown[] }): unknown {
    return {
      chapter: {
        updateMany: async (args: unknown) => {
          state.calls.push(args);
          return { count: Array.isArray((args as { where: { id: { in: number[] } } }).where.id.in)
            ? (args as { where: { id: { in: number[] } } }).where.id.in.length
            : 0 };
        },
      },
    };
  }

  it('short-circuits cleanly on empty input', async () => {
    const state = { calls: [] as unknown[] };
    const result = await resetChaptersToPending(makeMockPrisma(state) as never, []);
    expect(result.status).toBe('success');
    expect(state.calls).toHaveLength(0);
  });

  it('writes PENDING to exactly the requested ids', async () => {
    const state = { calls: [] as unknown[] };
    const result = await resetChaptersToPending(makeMockPrisma(state) as never, [101, 102, 103], 42);

    expect(result.status).toBe('success');
    expect(state.calls).toHaveLength(1);
    const call = state.calls[0] as { where: { id: { in: number[] } }; data: { downloadStatus: string } };
    expect(call.where.id.in).toEqual([101, 102, 103]);
    expect(call.data.downloadStatus).toBe('PENDING');
    expect(call.data).not.toHaveProperty('mangaId');
  });

  it('does NOT broadcast a mangaId filter into the where clause', async () => {
    const state = { calls: [] as unknown[] };
    await resetChaptersToPending(makeMockPrisma(state) as never, [7], 99);
    const call = state.calls[0] as { where: Record<string, unknown> };
    // mangaId is only used for the realtime emit; never bleeds into the
    // updateMany filter (would re-introduce the broad-sweep cascade).
    expect(call.where).not.toHaveProperty('mangaId');
    expect(call.where).not.toHaveProperty('downloadStatus');
  });
});
