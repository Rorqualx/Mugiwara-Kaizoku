/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from '@jest/globals';

import { plannedChapterNumbers } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-chapter-reconciliation';
import { selectStaleToDelete } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence/deferred-stale-sweep';

jest.mock('@/server/db', () => ({ prisma: {} }));

describe('selectStaleToDelete — the merge\'s stale rows, after reconciliation', () => {
  it('keeps a PENDING placeholder that reconciliation would only insert again (One Piece Colored chapter 1142 was deleted and re-created on every refresh)', () => {
    const wanted = plannedChapterNumbers([{ number: 1140 }, { number: 1141 }, { number: 1142 }], 1133);
    expect(selectStaleToDelete([{ id: 49841, chapterNumber: 1142 }], wanted)).toEqual([]);
  });

  it('still deletes a stale row no source names', () => {
    const wanted = plannedChapterNumbers([{ number: 247 }, { number: 248 }], 248);
    expect(selectStaleToDelete([{ id: 1, chapterNumber: 260 }], wanted)).toEqual([1]);
  });

  it('deletes every stale row when reconciliation had no source data', () => {
    expect(selectStaleToDelete([{ id: 1, chapterNumber: 249 }, { id: 2, chapterNumber: null }], null)).toEqual([1, 2]);
  });

  it('always deletes numberless phantom stubs — reconciliation never creates those', () => {
    expect(selectStaleToDelete([{ id: 2, chapterNumber: null }], new Set([1, 2, 3]))).toEqual([2]);
  });
});

describe('plannedChapterNumbers — the numbers reconciliation keeps a row for', () => {
  it('is 1..expected plus every source number within the reasonable cap', () => {
    const planned = plannedChapterNumbers([{ number: 5 }, { number: 9 }, { number: 0 }, { number: 9999 }], 3);
    expect([...planned].sort((a, b) => a - b)).toEqual([1, 2, 3, 5, 9]);
  });
});
