/**
 * @jest-environment node
 *
 * Provider chapters past a finished series' agreed final chapter.
 *
 * Bug protected: refreshing JoJo Part 4 (174 chapters) stored 66 monitored,
 * file-less chapters 284-434 from MangaDex's whole-franchise numbering; they
 * carry a page count, so the phantom prune kept them.
 */
import { describe, it, expect } from '@jest/globals';

import {
  agreedFinalChapter,
  splitOverflowPastFinal,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence/final-chapter-overflow';
import type { ChapterConsensus } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/chapter-consensus-resolver';
import type { ProviderChapter } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';

const consensus = (count: number, confidence: string): ChapterConsensus =>
  ({ count, confidence, sources: ['anilist', 'kitsu'], raw: [] }) as unknown as ChapterConsensus;

const run = (from: number, to: number, title?: (n: number) => string): ProviderChapter[] =>
  Array.from({ length: to - from + 1 }, (_, i) => (title
    ? { chapterNumber: from + i, title: title(from + i), pages: 12 }
    : { chapterNumber: from + i, pages: 12 }));

describe('agreedFinalChapter', () => {
  it('is the count of a finished series when the consensus agrees with the scalar', () => {
    expect(agreedFinalChapter('COMPLETED', 174, consensus(174, 'medium'))).toBe(174);
    expect(agreedFinalChapter('FINISHED', 141, consensus(139, 'high'))).toBe(141);
  });

  it('is null for a running series, a low-confidence or disputed count, or no consensus, so nothing is refused', () => {
    expect(agreedFinalChapter('ONGOING', 174, consensus(174, 'high'))).toBeNull();
    expect(agreedFinalChapter('COMPLETED', 174, consensus(174, 'low'))).toBeNull();
    expect(agreedFinalChapter('COMPLETED', 1, consensus(368, 'high'))).toBeNull();
    expect(agreedFinalChapter('COMPLETED', 174, undefined)).toBeNull();
  });
});

describe('splitOverflowPastFinal', () => {
  it('refuses the whole-franchise run 266-439 of a 174-chapter finished series and keeps 1-174', () => {
    const { kept, refused } = splitOverflowPastFinal([...run(1, 174), ...run(266, 439, n => `Chapter ${n}`)], 174);
    expect(kept).toHaveLength(174);
    expect(refused).toHaveLength(174);
    expect(refused[0]?.chapterNumber).toBe(266);
  });

  it('keeps a titled chapter past the final chapter (a real late chapter) and an epilogue within two', () => {
    const late: ProviderChapter[] = [{ chapterNumber: 380, title: 'Eclipse of the Moon' }, { chapterNumber: 176 }];
    const { kept, refused } = splitOverflowPastFinal([...run(1, 174), ...late], 174);
    expect(refused).toHaveLength(0);
    expect(kept).toHaveLength(176);
  });

  it('keeps decimal chapters past the final chapter', () => {
    const { refused } = splitOverflowPastFinal([...run(1, 174), { chapterNumber: 200.5 }], 174);
    expect(refused).toHaveLength(0);
  });

  it('refuses nothing when the list does not cover the main run (the scalar, not the list, is then suspect)', () => {
    const { kept, refused } = splitOverflowPastFinal([...run(1, 20), ...run(266, 439)], 174);
    expect(refused).toHaveLength(0);
    expect(kept).toHaveLength(194);
  });

  it('refuses nothing without an agreed final chapter', () => {
    expect(splitOverflowPastFinal(run(1, 500), null).refused).toHaveLength(0);
  });
});
