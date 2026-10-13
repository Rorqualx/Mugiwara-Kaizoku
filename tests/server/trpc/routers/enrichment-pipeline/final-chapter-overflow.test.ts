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
  withoutOverflowPastFinal,
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

  it('refuses the chapters just past the final chapter when the generic run continues beyond the epilogue allowance', () => {
    // JoJo Part 3: 152 chapters, listed again as 114-265. 153 and 154 are that second numbering, not an epilogue.
    const { kept, refused } = splitOverflowPastFinal([...run(1, 152, n => `Title ${n}`), ...run(153, 265)], 152);
    expect(kept).toHaveLength(152);
    expect(refused.map(c => c.chapterNumber).slice(0, 3)).toEqual([153, 154, 155]);
    expect(refused).toHaveLength(113);
  });

  it('keeps a two-chapter epilogue when a separate generic run starts later', () => {
    const { kept, refused } = splitOverflowPastFinal([...run(1, 176), ...run(266, 439)], 174);
    expect(kept).toHaveLength(176);
    expect(refused).toHaveLength(174);
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

describe('withoutOverflowPastFinal — a cross-checked final chapter has no epilogue slack', () => {
  // Demon Slayer: 207 lowered to the cross-checked 205; MangaDex's Latin-American
  // Spanish upload numbers the extras "206" ("Chapter 206" once its title is dropped).
  const demonSlayer: ProviderChapter[] = [
    ...run(1, 205, n => `Title ${n}`),
    { chapterNumber: 205.2 },
    { chapterNumber: 205.5 },
    { chapterNumber: 206, title: 'Chapter 206' },
  ];

  it('refuses a generic chapter right after a cross-checked final chapter', () => {
    const kept = withoutOverflowPastFinal(88, demonSlayer, { status: 'COMPLETED', scalarChapters: 205, consensus: consensus(204, 'high'), crossCheckedFinal: 205 });
    expect(kept.map(c => c.chapterNumber)).not.toContain(206);
  });

  it('keeps decimal extras and titled chapters after a cross-checked final chapter', () => {
    const titled: ProviderChapter = { chapterNumber: 207, title: 'Rengoku Gaiden' };
    const kept = withoutOverflowPastFinal(88, [...demonSlayer, titled], { status: 'COMPLETED', scalarChapters: 205, consensus: consensus(204, 'high'), crossCheckedFinal: 205 });
    expect(kept.map(c => c.chapterNumber)).toEqual(expect.arrayContaining([205.2, 205.5, 207]));
  });

  it('without a cross-checked final chapter keeps the two-chapter epilogue slack', () => {
    const kept = withoutOverflowPastFinal(88, demonSlayer, { status: 'COMPLETED', scalarChapters: 205, consensus: consensus(204, 'high') });
    expect(kept.map(c => c.chapterNumber)).toContain(206);
  });

  it('a cross-checked final chapter on a running series refuses nothing', () => {
    const kept = withoutOverflowPastFinal(88, demonSlayer, { status: 'RELEASING', scalarChapters: 205, consensus: consensus(204, 'high'), crossCheckedFinal: 205 });
    expect(kept).toHaveLength(demonSlayer.length);
  });
});
