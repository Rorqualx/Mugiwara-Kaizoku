import { describe, it, expect } from '@jest/globals';

import { plausibleMaxChapter } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/fandom-db-persistence';

/**
 * Regression coverage for the phantom-chapter guard. The Fandom adaptive parser
 * occasionally emits an isolated far-outlier chapter number (a year misread as a
 * chapter, a footnote/reference number) which was created as a PENDING
 * placeholder and surfaced as a permanently-missing chapter. plausibleMaxChapter
 * is the bound that blocks creating those, while never truncating a genuinely
 * long or offset-numbered series.
 */
describe('plausibleMaxChapter — phantom outlier bound', () => {
  const range = (lo: number, hi: number): number[] =>
    Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

  it('drops a single year-like outlier (Black Lagoon: 1..123 + 2008)', () => {
    expect(plausibleMaxChapter([...range(1, 123), 2008])).toBe(123);
  });

  it('drops a single far outlier (Gantz: 1..387 + 978)', () => {
    expect(plausibleMaxChapter([...range(1, 387), 978])).toBe(387);
  });

  it('drops a small isolated cluster after a big gap (ORV: 1..513 + 877..883)', () => {
    expect(plausibleMaxChapter([...range(1, 513), ...range(877, 883)])).toBe(513);
  });

  it('keeps a contiguous long series (One Piece 1..1100)', () => {
    expect(plausibleMaxChapter(range(1, 1100))).toBe(1100);
  });

  it('keeps a substantial run after a gap (real offset numbering, not a phantom)', () => {
    // 1..3 then 500..600 — the tail is the majority, so it is treated as real.
    expect(plausibleMaxChapter([...range(1, 3), ...range(500, 600)])).toBe(600);
  });

  it('keeps small gaps within the dense body (ORV had internal gaps)', () => {
    expect(plausibleMaxChapter([...range(1, 480), 495, 513])).toBe(513);
  });

  it('allows chapter 0 and decimals without dropping', () => {
    expect(plausibleMaxChapter([0, 0.5, 1, 1.5, 2, 3])).toBe(3);
  });

  it('returns Infinity for an empty set (no bound, create everything)', () => {
    expect(plausibleMaxChapter([])).toBe(Infinity);
  });
});
