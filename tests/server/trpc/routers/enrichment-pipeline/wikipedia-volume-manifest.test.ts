/**
 * @jest-environment node
 *
 * How the pipeline uses Wikipedia's volume list.
 *
 *  - DARLING in the FRANXX: the article yields volumes 1, 1, 2…8 (a second
 *    table repeats volume 1). Counted by length that was 9; the consensus
 *    voted a ninth volume into an eight-volume series, the safety net created
 *    it, and the previous run's "Volume 9 (54-60)" was refilled onto it.
 *  - Battle Angel Alita: the franchise list page's other series must not stay
 *    in the chapter list once the series' own table is found.
 */
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/server/services/wikipedia/wikipedia/api-client', () => ({ fetchWithRetry: jest.fn() }));

import { resolveExpectedVolumeCount } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/consensus-resolver';
import { wikipediaVolumeCount } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/witness-counts';
import { applyGraphicNovelManifest, candidatePages } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/wikipedia-fallback/graphic-novel-manifest';

import type { GraphicNovelManifest } from '@/server/services/wikipedia/graphic-novel-list/manifest';
import type { WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';
import type { UnifiedProviderResults } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';

const franxxVolumes = [1, 1, 2, 3, 4, 5, 6, 7, 8].map(number => ({ number, chapters: [] }));

describe('Wikipedia volume count', () => {
  it('counts distinct volume numbers, not list entries', () => {
    expect(wikipediaVolumeCount(franxxVolumes)).toBe(8);
    expect(wikipediaVolumeCount([{ number: 0 }, { number: 2.5 }])).toBe(0);
    expect(wikipediaVolumeCount(undefined)).toBe(0);
  });

  it('DARLING in the FRANXX: AniList 8 and Wikipedia 1,1,2…8 agree on 8', () => {
    const result = {
      enrichmentResult: { appliedMatch: { metadata: { volumes: 8 } } },
      anilistCounts: { volumes: 8 },
      wikipediaResult: { data: { title: 'Darling in the Franxx', volumeList: franxxVolumes }, chapterList: [] },
    } as unknown as UnifiedProviderResults;
    expect(resolveExpectedVolumeCount(result).count).toBe(8);
  });
});

function vol(number: number, from: number, to: number): GraphicNovelManifest['volumes'][number] {
  const chapters = Array.from({ length: to - from + 1 }, (_, i) => ({ number: from + i }));
  return { number, chapters, unnumbered: [], title: `Vol ${number}`, releaseDate: 'January 1, 1991' };
}

describe('applyGraphicNovelManifest', () => {
  const extracted: WikipediaMangaData = {
    title: 'Battle Angel Alita',
    chapters: 123,
    volumeList: [{ number: 1, chapters: [] }, { number: 1, chapters: [] }, { number: 2, chapters: [{ number: 1 }] }],
    chapterList: Array.from({ length: 123 }, (_, i) => ({ number: i + 1, title: `Extracted ${i + 1}` })),
  } as WikipediaMangaData;

  it('a shared page: volumes and chapters are the series\' own, other series\' chapters dropped', () => {
    const manifest: GraphicNovelManifest = { volumes: [vol(1, 1, 6), vol(2, 7, 11), vol(3, 12, 17)], headings: ['Battle Angel Alita'], sharedPage: true };
    const out = applyGraphicNovelManifest(extracted, manifest);
    expect(out.volumeList?.map(v => [v.number, v.chapters.length])).toEqual([[1, 6], [2, 5], [3, 6]]);
    expect(out.chapterList).toHaveLength(17);
    expect(out.chapterList?.[6]).toEqual({ number: 7, volumeNumber: 2 });
    expect(out.chapters).toBe(17);
    expect(out.volumeList?.[0]).toMatchObject({ title: 'Vol 1', originalReleaseDate: 'January 1, 1991' });
  });

  it('a single-series page keeps chapters past the last volume (not yet collected) and known titles', () => {
    const manifest: GraphicNovelManifest = { volumes: [vol(1, 1, 6), vol(2, 7, 11), vol(3, 12, 17)], headings: [], sharedPage: false };
    const out = applyGraphicNovelManifest(extracted, manifest);
    expect(out.chapterList).toHaveLength(123);
    expect(out.chapterList?.[0]).toEqual({ number: 1, title: 'Extracted 1', volumeNumber: 1 });
    expect(out.chapterList?.[17]).toEqual({ number: 18, title: 'Extracted 18' });
    expect(out.chapters).toBe(123);
  });

  it('keeps each uncollected chapter once when the extracted list repeats it (Sakamoto Days 256-277 twice)', () => {
    const doubled = { ...extracted, chapterList: [...(extracted.chapterList ?? []), ...(extracted.chapterList ?? [])] };
    const manifest: GraphicNovelManifest = { volumes: [vol(1, 1, 6), vol(2, 7, 11), vol(3, 12, 17)], headings: [], sharedPage: false };
    expect(applyGraphicNovelManifest(doubled, manifest).chapterList).toHaveLength(123);
  });

  it('a finished series\' last volume takes its closing unnumbered entries as the next chapters (Alita: Final Fight, Epilogue = 52, 53)', () => {
    const last = { ...vol(3, 12, 17), unnumbered: ['Bonus', 'Final Fight "Conquest"', 'Epilogue'], trailingUnnumbered: 2 };
    const manifest: GraphicNovelManifest = { volumes: [vol(1, 1, 6), vol(2, 7, 11), last], headings: [], sharedPage: true };
    const finished = applyGraphicNovelManifest({ ...extracted, status: 'COMPLETED' }, manifest);
    expect(finished.volumeList?.[2]?.chapters.slice(-2)).toEqual([
      { number: 18, title: 'Conquest', volumeNumber: 3 },
      { number: 19, title: 'Epilogue', volumeNumber: 3 },
    ]);
    const ongoing = applyGraphicNovelManifest({ ...extracted, status: 'ONGOING' }, manifest);
    expect(ongoing.volumeList?.[2]?.chapters).toHaveLength(6);
  });

  it('tries the list page, then the article', () => {
    expect(candidatePages({ title: 'Erased (manga)' } as WikipediaMangaData)).toEqual(['List of Erased (manga) chapters', 'Erased (manga)']);
    expect(candidatePages({
      title: 'Battle Angel Alita', volumeListUrl: 'https://en.wikipedia.org/wiki/List_of_Battle_Angel_Alita_chapters',
    } as WikipediaMangaData)).toEqual(['List of Battle Angel Alita chapters', 'Battle Angel Alita']);
  });
});
