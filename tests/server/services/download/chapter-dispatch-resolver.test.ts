/**
 * @jest-environment node
 *
 * iter-EX tests for `resolveChapterDispatchAttempts` — verifies the
 * dispatched → completed / failed / orphan transitions per the chapter's
 * eventual state. Mocks prisma for both tables.
 */

import { resolveChapterDispatchAttempts } from '@/server/services/download/download-monitor/chapter-dispatch-resolver';

type AttemptRow = {
  id: bigint; chapterId: number; mangaId: number; source: string;
  outcome: string; createdAt: Date; resolvedAt: Date | null;
  releaseTitle: string | null; indexer: string | null;
  failureReason: string | null; jobId: bigint | null;
};
type ChapterRow = { id: number; downloadStatus: string; updatedAt: Date };

interface MockState {
  attempts: AttemptRow[];
  chapters: ChapterRow[];
  updates: Array<{ id: bigint; data: { outcome: string; resolvedAt: Date } }>;
}

function makePrisma(state: MockState): unknown {
  return {
    chapterDispatchAttempt: {
      findMany: async (args: { where: { outcome: string; createdAt: { lt: Date } }; take: number }): Promise<AttemptRow[]> => {
        return state.attempts
          .filter(a => a.outcome === args.where.outcome && a.createdAt < args.where.createdAt.lt)
          .slice(0, args.take);
      },
      update: async (args: { where: { id: bigint }; data: { outcome: string; resolvedAt: Date } }): Promise<AttemptRow> => {
        state.updates.push({ id: args.where.id, data: args.data });
        const row = state.attempts.find(a => a.id === args.where.id);
        if (row) { row.outcome = args.data.outcome; row.resolvedAt = args.data.resolvedAt; }
        return row as AttemptRow;
      },
    },
    chapter: {
      findMany: async (args: { where: { id: { in: number[] } } }): Promise<ChapterRow[]> => {
        return state.chapters.filter(c => args.where.id.in.includes(c.id));
      },
    },
  };
}

function makeAttempt(id: bigint, chapterId: number, ageMs: number, overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id, chapterId, mangaId: 2561, source: 'mangadex', outcome: 'dispatched',
    createdAt: new Date(Date.now() - ageMs), resolvedAt: null,
    releaseTitle: null, indexer: null, failureReason: null, jobId: null,
    ...overrides,
  };
}

describe('resolveChapterDispatchAttempts', () => {
  const GRACE_MS = 11 * 60 * 1000; // > 10min grace
  const ORPHAN_AGE_MS = 25 * 60 * 60 * 1000; // > 24h orphan cutoff

  it('marks completed when chapter is COMPLETED post-attempt', async () => {
    const state: MockState = {
      attempts: [makeAttempt(1n, 100, GRACE_MS)],
      chapters: [{ id: 100, downloadStatus: 'COMPLETED', updatedAt: new Date() }],
      updates: [],
    };
    const stats = await resolveChapterDispatchAttempts(makePrisma(state) as never);
    expect(stats.resolved).toBe(1);
    expect(stats.orphaned).toBe(0);
    expect(state.updates[0]?.data.outcome).toBe('completed');
  });

  it('marks failed when chapter went back to PENDING post-attempt (soft-fail)', async () => {
    const state: MockState = {
      attempts: [makeAttempt(2n, 200, GRACE_MS)],
      chapters: [{ id: 200, downloadStatus: 'PENDING', updatedAt: new Date() }],
      updates: [],
    };
    const stats = await resolveChapterDispatchAttempts(makePrisma(state) as never);
    expect(stats.resolved).toBe(1);
    expect(state.updates[0]?.data.outcome).toBe('failed');
  });

  it('marks failed for legacy ERROR chapters regardless of updatedAt', async () => {
    const state: MockState = {
      attempts: [makeAttempt(3n, 300, GRACE_MS)],
      chapters: [{ id: 300, downloadStatus: 'ERROR', updatedAt: new Date(Date.now() - GRACE_MS * 2) }],
      updates: [],
    };
    const stats = await resolveChapterDispatchAttempts(makePrisma(state) as never);
    expect(state.updates[0]?.data.outcome).toBe('failed');
    expect(stats.resolved).toBe(1);
  });

  it('leaves DOWNLOADING attempts in flight (not resolved, not orphaned)', async () => {
    const state: MockState = {
      attempts: [makeAttempt(4n, 400, GRACE_MS)],
      chapters: [{ id: 400, downloadStatus: 'DOWNLOADING', updatedAt: new Date() }],
      updates: [],
    };
    const stats = await resolveChapterDispatchAttempts(makePrisma(state) as never);
    expect(stats.resolved).toBe(0);
    expect(stats.orphaned).toBe(0);
    expect(state.updates).toHaveLength(0);
  });

  it('marks orphan when DOWNLOADING attempt is past 24h cutoff', async () => {
    const state: MockState = {
      attempts: [makeAttempt(5n, 500, ORPHAN_AGE_MS)],
      chapters: [{ id: 500, downloadStatus: 'DOWNLOADING', updatedAt: new Date() }],
      updates: [],
    };
    const stats = await resolveChapterDispatchAttempts(makePrisma(state) as never);
    expect(stats.orphaned).toBe(1);
    expect(state.updates[0]?.data.outcome).toBe('orphan');
  });

  it('marks orphan when chapter row is gone past 24h cutoff', async () => {
    const state: MockState = {
      attempts: [makeAttempt(6n, 999, ORPHAN_AGE_MS)],
      chapters: [],
      updates: [],
    };
    const stats = await resolveChapterDispatchAttempts(makePrisma(state) as never);
    expect(stats.orphaned).toBe(1);
  });

  it('ignores attempts younger than the 10-min grace', async () => {
    const state: MockState = {
      attempts: [makeAttempt(7n, 700, 5 * 60 * 1000)],
      chapters: [{ id: 700, downloadStatus: 'COMPLETED', updatedAt: new Date() }],
      updates: [],
    };
    const stats = await resolveChapterDispatchAttempts(makePrisma(state) as never);
    expect(stats.scanned).toBe(0);
    expect(state.updates).toHaveLength(0);
  });
});
