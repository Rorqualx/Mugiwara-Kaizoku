/**
 * @jest-environment node
 *
 * Fandom chapters filed under a volume a finished series does not have.
 *
 * Bug protected: refreshing Steel Ball Run (95 chapters, 24 volumes) against
 * the whole-franchise wiki jojo.fandom.com stored 32 monitored, file-less
 * chapters (JoJolion 107-110 under "volume 131", Golden Wind 473-500 under
 * volumes 51-54) and replaced the titles of downloaded chapters 27-30 and
 * 67-70 with JoJolion's. The list held 138 chapters, under the 2x count gate.
 */
import { describe, it, expect } from '@jest/globals';

import {
  finishedVolumeCeiling,
  splitPastVolumeCeiling,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/fandom-volume-ceiling';
import type { ChapterDataItem, VolumeDataItem } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';

const chapters = (from: number, to: number, volume: number | undefined): ChapterDataItem[] =>
  Array.from({ length: to - from + 1 }, (_, i) => (volume === undefined
    ? { number: from + i, title: `Title ${from + i}` }
    : { number: from + i, title: `Title ${from + i}`, volume }));

describe('finishedVolumeCeiling', () => {
  it('is the volume count plus one trailing volume for a finished series', () => {
    expect(finishedVolumeCeiling('FINISHED', 24)).toBe(25);
    expect(finishedVolumeCeiling('COMPLETED', 18)).toBe(19);
    expect(finishedVolumeCeiling('cancelled', 3)).toBe(4);
  });

  it('is null for a running series or an unknown volume count, so nothing is refused', () => {
    expect(finishedVolumeCeiling('RELEASING', 24)).toBeNull();
    expect(finishedVolumeCeiling('FINISHED', null)).toBeNull();
    expect(finishedVolumeCeiling('FINISHED', 0)).toBeNull();
    expect(finishedVolumeCeiling(undefined, 24)).toBeNull();
  });
});

describe('splitPastVolumeCeiling', () => {
  it('refuses a Fandom chapter filed under volume 131 or 51 of a finished 24-volume series', () => {
    const list = [...chapters(107, 110, 131), ...chapters(27, 30, 111), ...chapters(473, 481, 51)];
    const { chapters: kept, refusedChapters } = splitPastVolumeCeiling(list, [], finishedVolumeCeiling('FINISHED', 24));
    expect(kept).toHaveLength(0);
    expect(refusedChapters).toHaveLength(17);
  });

  it('keeps chapters filed under the series\' own volumes, including one trailing volume', () => {
    const list = [...chapters(1, 5, 1), ...chapters(163, 171, 18), ...chapters(172, 174, 19)];
    const { chapters: kept, refusedChapters } = splitPastVolumeCeiling(list, [], finishedVolumeCeiling('FINISHED', 18));
    expect(kept).toHaveLength(17);
    expect(refusedChapters).toHaveLength(0);
  });

  it('keeps a chapter that carries no volume number', () => {
    const { chapters: kept, refusedChapters } = splitPastVolumeCeiling(chapters(1, 10, undefined), [], 25);
    expect(kept).toHaveLength(10);
    expect(refusedChapters).toHaveLength(0);
  });

  it('refuses the whole list, volume-less chapters included, when most of it is filed past the ceiling', () => {
    // jojo.fandom.com "Volume 1" page: 134 chapters under volumes 51-131 plus Part 1's 44 chapters with no volume.
    const list = [...chapters(1, 44, -1), ...chapters(440, 573, 51)];
    const { chapters: kept, volumes, refusedChapters } = splitPastVolumeCeiling(list, [{ number: 1 }, { number: 51 }], 18);
    expect(kept).toHaveLength(0);
    expect(volumes).toHaveLength(0);
    expect(refusedChapters).toHaveLength(178);
  });

  it('refuses only the stray chapters when most of the list is the series\' own', () => {
    const list = [...chapters(1, 95, 12), ...chapters(107, 110, 131)];
    const { chapters: kept, refusedChapters } = splitPastVolumeCeiling(list, [], 25);
    expect(kept).toHaveLength(95);
    expect(refusedChapters.map(c => c.number)).toEqual([107, 108, 109, 110]);
  });

  it('refuses volumes numbered past the ceiling and keeps the rest', () => {
    const volumes: VolumeDataItem[] = [{ number: 24 }, { number: 25 }, { number: 51 }, { number: 131 }];
    const { volumes: kept, refusedVolumes } = splitPastVolumeCeiling([], volumes, 25);
    expect(kept.map(v => v.number)).toEqual([24, 25]);
    expect(refusedVolumes.map(v => v.number)).toEqual([51, 131]);
  });

  it('refuses nothing for a running series', () => {
    const list = chapters(1100, 1110, 110);
    const { chapters: kept, refusedChapters } = splitPastVolumeCeiling(list, [{ number: 110 }], finishedVolumeCeiling('RELEASING', 108));
    expect(kept).toHaveLength(11);
    expect(refusedChapters).toHaveLength(0);
  });
});
