/**
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';

import type { VolumeRangeProposal } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation';
import { dropDifferentEditionComicVine } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-volume-cross-validation/edition-mismatch';

function run(source: VolumeRangeProposal['source'], ends: number[]): VolumeRangeProposal[] {
  let start = 1;
  return ends.map((end, i) => {
    const p: VolumeRangeProposal = {
      volumeNumber: i + 1, chapterStart: start, chapterEnd: end, source,
      confidence: source === 'comicvine' ? 0.95 : 0.9, extractionMethod: 'explicit-range',
    };
    start = end + 1;
    return p;
  });
}

describe('dropDifferentEditionComicVine', () => {
  // Why this exists: refreshing Steel Ball Run in production replaced its 24
  // tankobon volumes with ComicVine's 9 two-in-one hardcovers for volumes 1–9
  // (volume 1 = chapters 1–11) and left volumes 10–24 with made-up ranges.
  const tankobon24 = run('mangadex', [5, 11, 17, 23, 27, 30, 33, 36, 39, 42, 45, 48, 51, 55, 59, 63, 68, 72, 76, 80, 84, 88, 91, 95]);
  const hardcover9 = run('comicvine', [11, 23, 30, 36, 42, 48, 55, 63, 72]);

  it('drops ComicVine when its volumes reach much further than the same volumes elsewhere', () => {
    const kept = dropDifferentEditionComicVine([...hardcover9, ...tankobon24]);
    expect(kept).toHaveLength(24);
    expect(kept.every(p => p.source === 'mangadex')).toBe(true);
  });

  it('keeps ComicVine when it is the same edition, complete', () => {
    const cv = run('comicvine', [9, 19, 29, 39, 48, 58, 68, 79, 89, 100, 111, 121, 132, 143]);
    const wp = run('wikipedia', [9, 19, 29, 39, 48, 58, 68, 79, 89, 100, 111, 121, 132, 143]);
    expect(dropDifferentEditionComicVine([...cv, ...wp])).toHaveLength(28);
  });

  it('keeps ComicVine when it only lags behind the same edition', () => {
    const cv = run('comicvine', [7, 16, 25, 34, 43, 52, 62]);
    const md = run('mangadex', [7, 16, 25, 34, 43, 52, 62, 71, 80, 89, 98, 107]);
    expect(dropDifferentEditionComicVine([...cv, ...md])).toHaveLength(19);
  });

  it('keeps ComicVine when no other source has more volumes to compare against', () => {
    expect(dropDifferentEditionComicVine(hardcover9)).toHaveLength(9);
    expect(dropDifferentEditionComicVine([...hardcover9, ...run('wikipedia', [11, 23, 30])])).toHaveLength(12);
  });
});
