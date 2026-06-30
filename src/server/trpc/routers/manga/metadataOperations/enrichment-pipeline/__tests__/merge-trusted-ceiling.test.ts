/**
 * @jest-environment node
 *
 * Guards the finished-series trusted-ceiling fusion cap: integer chapters past a
 * known final chapter are dropped when they carry no real metadata, while
 * decimals, in-range chapters, and metadata-rich beyond-scalar chapters survive.
 *
 * Regression target: Attack on Titan (final chapter 139, COMPLETED) gained
 * phantom chapters 140/141 (generic titles) and a re-listed finale 144 — all
 * past the real end — which slid under the old ceil(expected × 1.1) = 153 cap.
 */
import { mergeAllSourceChapters } from '../phase-chapter-reconciliation';

import type { ChapterDataItem } from '../types';

function numbers(items: ChapterDataItem[]): number[] {
  return items.map(i => i.number).sort((a, b) => a - b);
}

describe('mergeAllSourceChapters — trusted ceiling', () => {
  const AOT: ChapterDataItem[] = [
    { number: 138, title: 'A Long Dream' },
    { number: 139, title: 'Toward the Tree on That Hill' },
    { number: 139.5, title: 'Volume 34 Bonus' },               // decimal bonus — keep
    { number: 140 },                                            // generic phantom — drop
    { number: 141 },                                            // generic phantom — drop
    { number: 144, title: 'Final Episode: Toward the Tree on That Hill' }, // re-listed finale — drop
  ];

  it('drops metadata-poor integer overflow past the trusted final chapter', () => {
    const merged = mergeAllSourceChapters(139, 139, AOT);
    expect(numbers(merged)).toEqual([138, 139, 139.5]);
  });

  it('keeps a beyond-ceiling integer that carries real metadata (AniList undercount)', () => {
    const input: ChapterDataItem[] = [
      { number: 139, title: 'Toward the Tree on That Hill' },
      { number: 140, title: 'A Genuine New Chapter', description: 'real content' }, // metadata-rich → keep
    ];
    const merged = mergeAllSourceChapters(139, 139, input);
    expect(numbers(merged)).toEqual([139, 140]);
  });

  it('still drops the finale superset but keeps generic overflow without a trusted ceiling', () => {
    // expected 139, no trusted ceiling -> fusion cap is ceil(139*1.1)=153, so the
    // generic 140/141 survive. The finale superset (144) is still dropped because
    // the duplicate rule keys off expectedChapterCount, not the trusted ceiling.
    const merged = mergeAllSourceChapters(139, null, AOT);
    expect(numbers(merged)).toEqual([138, 139, 139.5, 140, 141]);
  });
});
