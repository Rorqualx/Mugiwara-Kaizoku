/**
 * @jest-environment node
 *
 * A finished series' chapter scalar is a COUNT. Bleach reads 706 on AniList
 * and Kitsu (686 numbered chapters + 20 side stories and extras); used as the
 * highest chapter number it created stubs 687-706 and a phantom volume on
 * every refresh. These tests guard the upper bound taken from providers that
 * state the highest numbered chapter.
 */
import {
  boundByCorroboratedFinal,
  collectFinalChapterWitnesses,
  corroborateFinalChapter,
  highestWrittenChapter,
} from '../corroborated-final-chapter';
import { resolveTrustedFinalChapter } from '../phase-data-assembly';

import type { UnifiedProviderResults } from '../types';

interface Shape {
  metadata?: Record<string, unknown>;
  mangadex?: { status: string; lastChapter: string };
  /** Wikipedia's computed total (highest listed chapter). */
  wikipediaOwn?: number;
  /** Rows actually extracted; defaults to the total. */
  wikipediaListed?: number;
  mangaupdates?: { completed: boolean; latestChapter: number };
}

function results(shape: Shape): UnifiedProviderResults {
  const listed = shape.wikipediaListed ?? shape.wikipediaOwn ?? 0;
  return {
    enrichmentResult: {
      appliedMatch: { metadata: shape.metadata ?? {} },
      enrichedData: { manga: { mangadexMeta: shape.mangadex } },
    },
    wikipediaResult: shape.wikipediaOwn === undefined ? null : {
      data: { chapters: shape.wikipediaOwn },
      chapterList: Array.from({ length: listed }, (_, i) => ({ number: i + 1 })),
      ownChapterCount: listed,
    },
    mangaupdatesResult: shape.mangaupdates ?? null,
  } as unknown as UnifiedProviderResults;
}

describe('collectFinalChapterWitnesses', () => {
  it('reads MangaDex lastChapter only once MangaDex marks the series completed', () => {
    const done = collectFinalChapterWitnesses(results({ mangadex: { status: 'completed', lastChapter: '686' } }));
    expect(done).toEqual([{ source: 'mangadex', chapter: 686 }]);
    const running = collectFinalChapterWitnesses(results({ mangadex: { status: 'ongoing', lastChapter: '120' } }));
    expect(running).toEqual([]);
  });

  it('ignores a Wikipedia count whose chapter list the cross-series gate emptied', () => {
    expect(collectFinalChapterWitnesses(results({ wikipediaOwn: 83, wikipediaListed: 0 }))).toEqual([]);
  });

  it("Bleach: Wikipedia's witness is its highest listed chapter (686), not the 667 rows that parsed", () => {
    expect(collectFinalChapterWitnesses(results({ wikipediaOwn: 686, wikipediaListed: 667 })))
      .toEqual([{ source: 'wikipedia', chapter: 686 }]);
  });

  it('takes MangaUpdates latest chapter only for a completed series', () => {
    expect(collectFinalChapterWitnesses(results({ mangaupdates: { completed: false, latestChapter: 147 } }))).toEqual([]);
    expect(collectFinalChapterWitnesses(results({ mangaupdates: { completed: true, latestChapter: 139 } })))
      .toEqual([{ source: 'mangaupdates', chapter: 139 }]);
  });
});

describe('highestWrittenChapter — ComicVine volume descriptions', () => {
  it('does not read the first four digits of a longer number as a chapter ("Chapters 12345" is not 1234)', () => {
    expect(highestWrittenChapter(['Chapters 12345 sold', 'Chapter 12. Title'])).toBe(12);
  });

  it('reads the number as written, where the parser numbers such lines by position', () => {
    expect(highestWrittenChapter([
      'Chapter 663: GOD OF THUNDER 4',
      '<li>Chapter 675. Blood For My Bone</li><li>Chapter 686. Death &amp; Strawberry</li>',
    ])).toBe(686);
  });

  it('takes the upper end of a written range', () => {
    expect(highestWrittenChapter(['Contains Chapters 24 - 46'])).toBe(46);
  });

  it('ignores negative chapter labels and text without chapter numbers', () => {
    expect(highestWrittenChapter(['Chapter -108: Turn Back the Pendulum', 'The final volume.'])).toBe(0);
  });
});

describe('corroborateFinalChapter', () => {
  it('needs two providers: one witness bounds nothing', () => {
    expect(corroborateFinalChapter([{ source: 'mangadex', chapter: 686 }])).toBeNull();
  });

  it('accepts witnesses one apart (a "Chapter 0", a missed last row) and reports the higher', () => {
    const c = corroborateFinalChapter([
      { source: 'wikipedia', chapter: 685 },
      { source: 'mangadex', chapter: 686 },
    ]);
    expect(c).toEqual({ chapter: 686, sources: ['mangadex', 'wikipedia'] });
  });

  it('lists the provider that reported the agreed number first, whatever the collection order (the first source becomes the stored provenance)', () => {
    const c = corroborateFinalChapter([
      { source: 'mangadex', chapter: 685 },
      { source: 'comicvine', chapter: 685 },
      { source: 'wikipedia', chapter: 686 },
    ]);
    expect(c).toEqual({ chapter: 686, sources: ['wikipedia', 'mangadex', 'comicvine'] });
  });

  it('does not let two sources that both stop early outvote a complete pair', () => {
    const c = corroborateFinalChapter([
      { source: 'comicvine', chapter: 97 },
      { source: 'wikipedia', chapter: 97 },
      { source: 'mangadex', chapter: 179 },
      { source: 'mangaupdates', chapter: 179 },
    ]);
    expect(c?.chapter).toBe(179);
  });

  it('returns null when the witnesses disagree', () => {
    expect(corroborateFinalChapter([
      { source: 'mangadex', chapter: 686 },
      { source: 'wikipedia', chapter: 667 },
    ])).toBeNull();
  });
});

describe('boundByCorroboratedFinal', () => {
  const agreed = (chapter: number): { chapter: number; sources: string[] } => ({ chapter, sources: ['mangadex', 'comicvine'] });

  it('lowers Bleach 706 to the corroborated 686', () => {
    expect(boundByCorroboratedFinal(706, agreed(686))).toBe(686);
  });

  it('leaves a scalar within two of the corroborated number alone (Attack on Titan 141 vs 139, Tokyo Ghoul 144 vs 143)', () => {
    expect(boundByCorroboratedFinal(141, agreed(139))).toBe(141);
    expect(boundByCorroboratedFinal(144, agreed(143))).toBe(144);
  });

  it('never raises the scalar', () => {
    expect(boundByCorroboratedFinal(139, agreed(141))).toBe(139);
  });

  it('ignores a corroborated number far below the scalar: that is a shorter edition, not extras', () => {
    expect(boundByCorroboratedFinal(706, agreed(250))).toBe(706);
  });

  it('keeps the scalar when nothing corroborates', () => {
    expect(boundByCorroboratedFinal(706, null)).toBe(706);
  });

  it('keeps a scalar that a witness itself reports as the highest chapter, even when two lower witnesses agree with each other', () => {
    const witnesses = [
      { source: 'mangadex', chapter: 185 },
      { source: 'wikipedia', chapter: 200 },
      { source: 'mangaupdates', chapter: 185 },
    ];
    expect(boundByCorroboratedFinal(200, { chapter: 185, sources: ['mangadex', 'mangaupdates'] }, witnesses)).toBe(200);
    // One apart still counts as the same statement (a "Chapter 0").
    expect(boundByCorroboratedFinal(201, { chapter: 185, sources: ['mangadex', 'mangaupdates'] }, witnesses)).toBe(201);
  });

  it('still lowers Bleach 706 when no witness is near 706', () => {
    const witnesses = [
      { source: 'mangadex', chapter: 686 },
      { source: 'comicvine', chapter: 686 },
      { source: 'mangaupdates', chapter: 250 },
    ];
    expect(boundByCorroboratedFinal(706, agreed(686), witnesses)).toBe(686);
  });
});

describe('resolveTrustedFinalChapter — count versus final chapter', () => {
  it('Bleach: a COMPLETED scalar of 706 is bounded to 686 when MangaDex and Wikipedia agree on 686', () => {
    const r = resolveTrustedFinalChapter(results({
      metadata: { status: 'COMPLETED', chapters: 706, volumes: 74 },
      mangadex: { status: 'completed', lastChapter: '686' },
      wikipediaOwn: 686,
    }));
    expect(r.trusted).toBe(true);
    expect(r.ceiling).toBe(686);
    expect(r.corroboratedFinal).toBe(686);
    expect(r.volumeCeiling).toBe(74);
  });

  it('a finished series whose Wikipedia list ends at the scalar (200) is not lowered to the 185 two other providers stop at', () => {
    const r = resolveTrustedFinalChapter(results({
      metadata: { status: 'COMPLETED', chapters: 200 },
      mangadex: { status: 'completed', lastChapter: '185' },
      mangaupdates: { completed: true, latestChapter: 185 },
      wikipediaOwn: 200,
    }));
    expect(r.ceiling).toBe(200);
  });

  it('keeps 706 when only MangaDex says 686', () => {
    const r = resolveTrustedFinalChapter(results({
      metadata: { status: 'COMPLETED', chapters: 706 },
      mangadex: { status: 'completed', lastChapter: '686' },
    }));
    expect(r.ceiling).toBe(706);
    expect(r.corroboratedFinal).toBeNull();
  });

  it('bounds the stored fallback too, so a stored 706 does not survive the next run', () => {
    const r = resolveTrustedFinalChapter(
      results({ mangadex: { status: 'completed', lastChapter: '686' }, wikipediaOwn: 686 }),
      { endDate: new Date('2016-08-23'), status: 'COMPLETED', chapters: 706 },
    );
    expect(r.ceiling).toBe(686);
  });

  it('an ongoing series stays untrusted whatever the witnesses say', () => {
    const r = resolveTrustedFinalChapter(results({
      metadata: { status: 'ONGOING', chapters: 147 },
      mangadex: { status: 'completed', lastChapter: '100' },
      wikipediaOwn: 100,
    }));
    expect(r.trusted).toBe(false);
    expect(r.ceiling).toBeNull();
  });
});
