/**
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';

import { finishedSeriesFinalChapter } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence/final-chapter-overflow';
import { planPhantomPairs } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence/phantom-pairing';

const archive = (id: number, volume: number, index = id): { id: number; index: number; chapterNumber: null; filePath: string; volume: number } =>
  ({ id, index, chapterNumber: null, filePath: `/library/T/Volumes/V${volume}.cbz`, volume });
const loose = (id: number, chapterNumber: number, volume: number): { id: number; index: number; chapterNumber: number; filePath: string; volume: number } =>
  ({ id, index: id, chapterNumber, filePath: `/library/T/Chapter ${chapterNumber}.cbz`, volume });
const provider = (volume: number, ...numbers: number[]): Array<{ chapterNumber: number; volume: number }> =>
  numbers.map(chapterNumber => ({ chapterNumber, volume }));
const summary = (pairs: ReturnType<typeof planPhantomPairs>): Array<[number, number]> =>
  pairs.map(p => [p.phantom.id, p.providerChapter.chapterNumber]);

describe('planPhantomPairs — a volume archive takes its volume\'s first chapter or nothing', () => {
  // Why this exists: skipping taken numbers let the archive slide to the next
  // free one. In production that labelled Attack on Titan's volume 34 archive
  // "chapter 144" (which then produced a volume 35), Bleach's volume 74
  // archive "chapter 695" and SPY x FAMILY's volume 1 archive "Chapter 5.5".
  it('pairs the archive with the first chapter when the library holds only archives', () => {
    const existing = [archive(1, 1), archive(2, 2)];
    expect(summary(planPhantomPairs(existing, [...provider(1, 1, 2, 3), ...provider(2, 4, 5, 6)]))).toEqual([[1, 1], [2, 4]]);
  });

  it('leaves the archive numberless when the first chapter already has a row', () => {
    const existing = [archive(1, 34), loose(2, 135, 34), loose(3, 136, 34)];
    expect(planPhantomPairs(existing, provider(34, 135, 136, 137, 144))).toEqual([]);
  });

  it('does not slide onto an extra when the regular chapters are taken', () => {
    const existing = [archive(1, 1), loose(2, 1, 1), loose(3, 2, 1)];
    expect(planPhantomPairs(existing, provider(1, 1, 2, 5.5))).toEqual([]);
  });

  it('pairs several archive rows of one volume by position and skips only the taken one', () => {
    const existing = [archive(1, 3, 10), archive(2, 3, 20), loose(3, 21, 3)];
    expect(summary(planPhantomPairs(existing, provider(3, 20, 21, 22)))).toEqual([[1, 20]]);
  });

  it('ignores rows without a file or without a volume, and volumes with no provider chapters', () => {
    const existing = [
      { id: 1, index: 1, chapterNumber: null, filePath: null, volume: 1 },
      { id: 2, index: 2, chapterNumber: null, filePath: '/x.cbz', volume: null },
      archive(3, 9),
    ];
    expect(planPhantomPairs(existing, provider(1, 1, 2))).toEqual([]);
  });
});

describe('planPhantomPairs — a whole-volume archive row is never given a chapter number past the final chapter', () => {
  // Bleach ends at chapter 686. ComicVine's list put volume 74 at 695-706, so
  // the first positional number was free and two `Bleach V74.cbz` rows became
  // file-backed "chapters" 695 and 696, which then justified a volume 75.
  const bleach = [archive(13025, 74, 74_000), archive(48931, 74, 107_500), loose(1, 675, 74), loose(2, 686, 74)];
  const shiftedList = provider(74, 695, 696, 697, 705, 706);

  it('leaves both V74 archive rows numberless when the list runs past 686', () => {
    expect(planPhantomPairs(bleach, shiftedList, 686)).toEqual([]);
  });

  it('numbered them 695 and 696 when no final chapter was given (the bug)', () => {
    expect(summary(planPhantomPairs(bleach, shiftedList))).toEqual([[13025, 695], [48931, 696]]);
  });

  it('still pairs an archive with a chapter at or below the final chapter', () => {
    expect(summary(planPhantomPairs([archive(1, 74)], provider(74, 675, 686), 686))).toEqual([[1, 675]]);
    expect(summary(planPhantomPairs([archive(1, 74)], provider(74, 686), 686))).toEqual([[1, 686]]);
  });
});

describe('finishedSeriesFinalChapter', () => {
  it('is the expected count for a finished series', () => {
    expect(finishedSeriesFinalChapter('COMPLETED', 686)).toBe(686);
    expect(finishedSeriesFinalChapter('cancelled', 12)).toBe(12);
  });

  it('is null for a running series, an unknown status or an unknown count', () => {
    expect(finishedSeriesFinalChapter('ONGOING', 686)).toBeNull();
    expect(finishedSeriesFinalChapter(undefined, 686)).toBeNull();
    expect(finishedSeriesFinalChapter('COMPLETED', 0)).toBeNull();
  });
});
