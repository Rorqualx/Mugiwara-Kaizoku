/**
 * @jest-environment node
 *
 * file-scanner.parseChapterFileName tests
 *
 * Locks in the disambiguation between volume-style filenames
 * ("Akira 01.cbz" = volume) and webtoon-chapter-style filenames
 * ("Lookism 001.cbz" = chapter). The bug fix: bare trailing numbers
 * with 3+ digits are chapters, not volumes (manga volumes rarely
 * exceed 99). Regression target: pre-fix, "Lookism 001.cbz" got
 * parsed as Volume 1, causing pack-import to create synthetic
 * Volume rows + leave the real chapter rows unlinked.
 */

import { parseChapterFileName } from '@/server/services/packImport/file-scanner';

describe('parseChapterFileName — explicit markers', () => {
  it('v01 marker → volume', () => {
    expect(parseChapterFileName('Naruto v01 (Digital).cbz', '.cbz'))
      .toEqual({ volumeNumber: 1, chapterNumber: null });
  });

  it('Vol.5 marker → volume', () => {
    expect(parseChapterFileName('Bleach Vol.5.cbz', '.cbz'))
      .toEqual({ volumeNumber: 5, chapterNumber: null });
  });

  it('c001 marker → chapter', () => {
    expect(parseChapterFileName('Series c001.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 1 });
  });

  it('Chapter 42 marker → chapter', () => {
    expect(parseChapterFileName('Manga Chapter 42.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  it('dash-separated → chapter', () => {
    expect(parseChapterFileName('Title - 042 (2024).cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });
});

describe('parseChapterFileName — bare number heuristic (the Lookism fix)', () => {
  it('bare 1-2 digit → volume (legacy convention preserved)', () => {
    expect(parseChapterFileName('Akira 01.cbz', '.cbz'))
      .toEqual({ volumeNumber: 1, chapterNumber: null });
  });

  it('bare 2 digit → volume', () => {
    expect(parseChapterFileName('Berserk 12.cbz', '.cbz'))
      .toEqual({ volumeNumber: 12, chapterNumber: null });
  });

  it('bare 3 digit zero-padded → chapter (Lookism case)', () => {
    expect(parseChapterFileName('Lookism 001.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 1 });
  });

  it('bare 3 digit → chapter (Tower of God case)', () => {
    expect(parseChapterFileName('Tower of God 542.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 542 });
  });

  it('bare 4 digit zero-padded → chapter', () => {
    expect(parseChapterFileName('Long-running 0042.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  it('parenthesized 1-3 digit → volume (paren convention preserved)', () => {
    expect(parseChapterFileName('Berserk (1).pdf', '.pdf'))
      .toEqual({ volumeNumber: 1, chapterNumber: null });
  });

  it('parenthesized 4 digit year → not parsed (no false volume)', () => {
    expect(parseChapterFileName('Title (2024).cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: null });
  });
});

describe('parseChapterFileName — iter-IB decimal chapters', () => {
  it('bare 3-digit decimal → chapter', () => {
    expect(parseChapterFileName('Manga 100.5.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 100.5 });
  });

  it('c-prefix decimal → chapter', () => {
    expect(parseChapterFileName('Series c0042.5.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42.5 });
  });

  it('Chapter prefix decimal → chapter', () => {
    expect(parseChapterFileName('Title Chapter 100.5.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 100.5 });
  });
});

describe('parseChapterFileName — iter-ID dual-marker chapter wins', () => {
  it('v01 + c001-010 → chapter wins, volume null', () => {
    expect(parseChapterFileName('[Asura] Manga v01 c001-010.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 1 });
  });

  it('v02 + Chapter 042 → chapter wins, volume null', () => {
    expect(parseChapterFileName('Series v02 Chapter 042.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });
});

describe('parseChapterFileName — iter-IE volume range', () => {
  it('Vol.1-3 → volume 1, no chapter', () => {
    expect(parseChapterFileName('Bleach Vol.1-3.cbz', '.cbz'))
      .toEqual({ volumeNumber: 1, chapterNumber: null });
  });

  it('v01-v20 → volume 1, no chapter', () => {
    expect(parseChapterFileName('Naruto v01-v20 (Digital).cbz', '.cbz'))
      .toEqual({ volumeNumber: 1, chapterNumber: null });
  });
});

describe('parseChapterFileName — iter-IG French Tome', () => {
  it('Tome 1 → volume 1', () => {
    expect(parseChapterFileName('Manga Tome 1.cbz', '.cbz'))
      .toEqual({ volumeNumber: 1, chapterNumber: null });
  });

  it('Tome 36 → volume 36', () => {
    expect(parseChapterFileName('Series Tome 36.cbz', '.cbz'))
      .toEqual({ volumeNumber: 36, chapterNumber: null });
  });
});

describe('parseChapterFileName — iter-IO1 chapter range', () => {
  // Chapter-range packs ship a single archive covering many chapters,
  // named `c<start>-<end>` / `c<start>-c<end>`. The leading chapter
  // wins (mirrors iter-IE volume-range semantic). Pre-IO1 the dash
  // heuristic captured the range END (838) instead of the START (1).

  it('c1-838 (One Piece colored pack) → chapter 1', () => {
    expect(parseChapterFileName('One Piece Manga Colored c1-838.7z', '.7z'))
      .toEqual({ volumeNumber: null, chapterNumber: 1 });
  });

  it('c001-100 (zero-padded both sides) → chapter 1', () => {
    expect(parseChapterFileName('Series c001-100.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 1 });
  });

  it('c1-c100 (c-prefix both sides) → chapter 1', () => {
    expect(parseChapterFileName('Title c1-c100.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 1 });
  });

  it('c042-c100 (non-1 start) → chapter 42', () => {
    expect(parseChapterFileName('Manga c042-c100.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  it('c001-200 with trailing metadata → chapter 1', () => {
    expect(parseChapterFileName('Series c001-200 (Digital).cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 1 });
  });

  it('regression: c001 alone (no range) still → chapter 1', () => {
    expect(parseChapterFileName('Series c001.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 1 });
  });
});

describe('parseChapterFileName — iter-IL manhua bare-digit', () => {
  // Modern CN manhua (Battle Through the Heavens, Tales of Demons,
  // Apotheosis) ships chapter-only despite their AniList entries
  // sometimes lacking the "Long Strip" tag — countryOfOrigin='CN'
  // alone gives `construct: 'manhua'`. For these, bare 1-2 digit
  // filenames mean chapters not volumes. Explicit `Vol N` prefix
  // still wins (covers traditional print manhua like Soul Land).

  it('bare 2 digit + manhua construct → chapter (not volume)', () => {
    expect(parseChapterFileName('Battle Through Heavens 12.cbz', '.cbz', 'manhua'))
      .toEqual({ volumeNumber: null, chapterNumber: 12 });
  });

  it('bare 1 digit + manhua construct → chapter', () => {
    expect(parseChapterFileName('Tales of Demons 7.cbz', '.cbz', 'manhua'))
      .toEqual({ volumeNumber: null, chapterNumber: 7 });
  });

  it('bare 2 digit + manhua + Vol prefix → vol-prefix still wins', () => {
    expect(parseChapterFileName('Soul Land Vol 12.cbz', '.cbz', 'manhua'))
      .toEqual({ volumeNumber: 12, chapterNumber: null });
  });

  it('bare 3 digit + manhua → chapter (no change from legacy)', () => {
    expect(parseChapterFileName('Apotheosis 042.cbz', '.cbz', 'manhua'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  // Regression guards — legacy behavior preserved when construct is
  // anything other than 'manhua'.

  it('bare 2 digit + manga construct → volume (legacy preserved)', () => {
    expect(parseChapterFileName('Akira 12.cbz', '.cbz', 'manga'))
      .toEqual({ volumeNumber: 12, chapterNumber: null });
  });

  it('bare 2 digit + no construct → volume (legacy preserved)', () => {
    expect(parseChapterFileName('Akira 12.cbz', '.cbz'))
      .toEqual({ volumeNumber: 12, chapterNumber: null });
  });

  it('bare 2 digit + manhwa construct → volume (traditional print)', () => {
    expect(parseChapterFileName('Series 12.cbz', '.cbz', 'manhwa'))
      .toEqual({ volumeNumber: 12, chapterNumber: null });
  });

  it('bare 2 digit + unknown construct → volume (legacy fallback)', () => {
    expect(parseChapterFileName('Series 12.cbz', '.cbz', 'unknown'))
      .toEqual({ volumeNumber: 12, chapterNumber: null });
  });
});

describe('parseChapterFileName — iter-IK episode/season', () => {
  // Webtoon/manhwa aggregator naming uses Episode/EP/S01E instead of
  // chapter markers. These must resolve to chapters regardless of digit
  // count — a 2-digit episode is still a chapter, NEVER a volume.

  it('EP 42 → chapter 42 (not volume 42)', () => {
    expect(parseChapterFileName('Solo Leveling EP 42.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  it('Episode 42 → chapter 42', () => {
    expect(parseChapterFileName('Solo Leveling Episode 42.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  it('Ep.42 (dot, no space) → chapter 42', () => {
    expect(parseChapterFileName('Solo Leveling Ep.42.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  it('EP42 (no space) → chapter 42', () => {
    expect(parseChapterFileName('Solo Leveling EP42.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  it('Episode 105.5 → chapter 105.5 (decimal preserved)', () => {
    expect(parseChapterFileName('Series Episode 105.5.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 105.5 });
  });

  it('S01E042 → chapter 42', () => {
    expect(parseChapterFileName('Tower of God S01E042.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  it('s1e42 (lowercase, no padding) → chapter 42', () => {
    expect(parseChapterFileName('Tower of God s1e42.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 42 });
  });

  it('S02E15 alone → chapter 15', () => {
    expect(parseChapterFileName('S02E15.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 15 });
  });

  // Regression guards: \bep word-boundary must not match internal `ep`
  // in words like Sleep, Step, Help, tape.

  it('does NOT match internal "ep" in "Sleep 42"', () => {
    // "Sleep 42" → bare 2-digit → volume per legacy convention
    expect(parseChapterFileName('Sleep 42.cbz', '.cbz'))
      .toEqual({ volumeNumber: 42, chapterNumber: null });
  });

  it('does NOT match internal "ep" in "Step 100"', () => {
    // "Step 100" → bare 3-digit → chapter per webtoon convention
    expect(parseChapterFileName('Step 100.cbz', '.cbz'))
      .toEqual({ volumeNumber: null, chapterNumber: 100 });
  });
});
