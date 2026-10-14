/**
 * @jest-environment node
 *
 * The chapter ceiling the volume gate clamps ranges to, and the correction of
 * a chapter scalar that is a count.
 *
 * Regression targets:
 *  - Frieren (ongoing): the cross-series gate disabled Wikipedia but its
 *    `data.chapters` (83) still became the gate ceiling, against a scalar of
 *    147, so volumes 11-14 lost their ranges.
 *  - Tokyo Ghoul:re: Wikipedia reported the parent's 143, the gate clamped to
 *    143 against a final chapter of 179.
 *  - Bleach: the stored scalar 706 is a count; the final chapter is 686.
 */
import { applyCorroboratedFinalChapter, resolveVolumeGateCeiling } from '../phase-volume-cross-validation/volume-gate-ceiling';

import type { UnifiedProviderResults } from '../types';

interface Shape {
  metadata: Record<string, unknown>;
  provenance?: Record<string, string>;
  totalChapters?: number;
  mangadex?: { status: string; lastChapter: string };
  wikipedia?: { chapters: number; listed: number; own?: number };
  mangaupdates?: { completed: boolean; latestChapter: number };
}

function results(shape: Shape): UnifiedProviderResults {
  const wiki = shape.wikipedia;
  return {
    enrichmentResult: {
      appliedMatch: { metadata: shape.metadata, perFieldProvenance: shape.provenance },
      enrichedData: { manga: { mangadexMeta: shape.mangadex, totalChapters: shape.totalChapters } },
    },
    wikipediaResult: wiki ? {
      data: { chapters: wiki.chapters },
      chapterList: Array.from({ length: wiki.listed }, (_, i) => ({ number: i + 1 })),
      ownChapterCount: wiki.own ?? (wiki.listed > 0 ? wiki.chapters : 0),
    } : null,
    mangaupdatesResult: shape.mangaupdates ?? null,
  } as unknown as UnifiedProviderResults;
}

describe('resolveVolumeGateCeiling — ongoing series', () => {
  it('Frieren: a Wikipedia count from an article the cross-series gate disabled is not the ceiling', () => {
    const gate = resolveVolumeGateCeiling(results({
      metadata: { status: 'HIATUS', chapters: 147 },
      wikipedia: { chapters: 83, listed: 0 },
    }));
    expect(gate).toEqual({ expectedChapterCount: 147, trusted: false });
  });

  it('never falls below the chapter scalar when Wikipedia lists fewer chapters', () => {
    const gate = resolveVolumeGateCeiling(results({
      metadata: { status: 'ONGOING', chapters: 147 },
      wikipedia: { chapters: 83, listed: 83 },
    }));
    expect(gate).toEqual({ expectedChapterCount: 147, trusted: false });
  });

  it('ignores an ongoing scalar more than twice Wikipedia\'s list (300 against 100): Wikipedia stays the ceiling', () => {
    const gate = resolveVolumeGateCeiling(results({
      metadata: { status: 'ONGOING', chapters: 300 },
      wikipedia: { chapters: 100, listed: 100 },
    }));
    expect(gate).toEqual({ expectedChapterCount: 100, trusted: false });
  });

  it('still follows Wikipedia when it lists more than a stale scalar', () => {
    const gate = resolveVolumeGateCeiling(results({
      metadata: { status: 'ONGOING', chapters: 100 },
      wikipedia: { chapters: 130, listed: 130 },
    }));
    expect(gate).toEqual({ expectedChapterCount: 130, trusted: false });
  });

  it('has no ceiling when neither Wikipedia nor the scalar gives one', () => {
    const gate = resolveVolumeGateCeiling(results({ metadata: { status: 'ONGOING' } }));
    expect(gate).toEqual({ expectedChapterCount: null, trusted: false });
  });
});

describe('resolveVolumeGateCeiling — finished series', () => {
  it('Attack on Titan: sources list 139, the scalar says 141 — the gate stays at 139', () => {
    const gate = resolveVolumeGateCeiling(results({
      metadata: { status: 'COMPLETED', chapters: 141 },
      mangadex: { status: 'completed', lastChapter: '139' },
      wikipedia: { chapters: 139, listed: 139 },
    }));
    expect(gate).toEqual({ expectedChapterCount: 139, trusted: true });
  });

  it('Tokyo Ghoul:re: a Wikipedia count of 143 does not pull the gate below the corroborated final chapter 179', () => {
    const gate = resolveVolumeGateCeiling(results({
      metadata: { status: 'COMPLETED', chapters: 181 },
      mangadex: { status: 'completed', lastChapter: '179' },
      mangaupdates: { completed: true, latestChapter: 179 },
      wikipedia: { chapters: 143, listed: 141, own: 143 },
    }));
    expect(gate).toEqual({ expectedChapterCount: 179, trusted: true });
  });

  it('Bleach: the gate is the corroborated 686, not the 706 count', () => {
    const gate = resolveVolumeGateCeiling(results({
      metadata: { status: 'COMPLETED', chapters: 706 },
      mangadex: { status: 'completed', lastChapter: '686' },
      wikipedia: { chapters: 686, listed: 667, own: 686 },
    }));
    expect(gate).toEqual({ expectedChapterCount: 686, trusted: true });
  });

  it('Attack on Titan: Before the Fall: Wikipedia\'s own 64 (not its stale data.chapters of 1) rejects a MangaUpdates "final chapter" of 4', () => {
    const gate = resolveVolumeGateCeiling(results({
      metadata: {},
      mangaupdates: { completed: true, latestChapter: 4 },
      wikipedia: { chapters: 1, listed: 64, own: 64 },
    }));
    expect(gate).toEqual({ expectedChapterCount: 64, trusted: false });
  });

  it('with nothing corroborated a lower plausible source count still wins, as before', () => {
    const gate = resolveVolumeGateCeiling(results({
      metadata: { status: 'COMPLETED', chapters: 95 },
      wikipedia: { chapters: 90, listed: 90, own: 90 },
    }));
    expect(gate).toEqual({ expectedChapterCount: 90, trusted: true });
  });
});

describe('applyCorroboratedFinalChapter', () => {
  it('Bleach: replaces the 706 count with 686 and names a provider that reported it', () => {
    const r = results({
      metadata: { status: 'COMPLETED', chapters: 706 },
      provenance: { chapters: 'anilist' },
      totalChapters: 706,
      mangadex: { status: 'completed', lastChapter: '686' },
      wikipedia: { chapters: 686, listed: 667, own: 686 },
    });
    const fix = applyCorroboratedFinalChapter(r);
    expect(fix).toEqual({ from: 706, to: 686, sources: ['mangadex', 'wikipedia'] });
    const applied = r.enrichmentResult.appliedMatch;
    expect((applied?.metadata as Record<string, unknown>)['chapters']).toBe(686);
    expect(applied?.perFieldProvenance?.['chapters']).toBe('mangadex');
    const manga = (r.enrichmentResult.enrichedData as { manga: { totalChapters: number } }).manga;
    expect(manga.totalChapters).toBe(686);
  });

  it('the stored provenance names a provider that reported the stored number (MangaDex 685, Wikipedia 686 stores 686 from wikipedia)', () => {
    const r = results({
      metadata: { status: 'COMPLETED', chapters: 706 },
      provenance: { chapters: 'anilist' },
      mangadex: { status: 'completed', lastChapter: '685' },
      wikipedia: { chapters: 686, listed: 667, own: 686 },
    });
    expect(applyCorroboratedFinalChapter(r)).toEqual({ from: 706, to: 686, sources: ['wikipedia', 'mangadex'] });
    expect(r.enrichmentResult.appliedMatch?.perFieldProvenance?.['chapters']).toBe('wikipedia');
  });

  it('does not rewrite a scalar that Wikipedia itself lists as the final chapter (200) to the 185 MangaDex and MangaUpdates stop at', () => {
    const r = results({
      metadata: { status: 'COMPLETED', chapters: 200 },
      provenance: { chapters: 'anilist' },
      mangadex: { status: 'completed', lastChapter: '185' },
      mangaupdates: { completed: true, latestChapter: 185 },
      wikipedia: { chapters: 200, listed: 200 },
    });
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
    expect((r.enrichmentResult.appliedMatch?.metadata as Record<string, unknown>)['chapters']).toBe(200);
    expect(r.enrichmentResult.appliedMatch?.perFieldProvenance?.['chapters']).toBe('anilist');
    expect(resolveVolumeGateCeiling(r)).toEqual({ expectedChapterCount: 200, trusted: true });
  });

  it('leaves Attack on Titan (141 vs 139) and Tokyo Ghoul (144 vs 143) untouched: within two', () => {
    const aot = results({
      metadata: { status: 'COMPLETED', chapters: 141 },
      mangadex: { status: 'completed', lastChapter: '139' },
      wikipedia: { chapters: 139, listed: 139 },
    });
    expect(applyCorroboratedFinalChapter(aot)).toBeNull();
    expect((aot.enrichmentResult.appliedMatch?.metadata as Record<string, unknown>)['chapters']).toBe(141);
  });

  it('corrects the scalar of a series finished only by the stored signal, so the gate (686) and the stub merge do not read different numbers', () => {
    const r = results({
      metadata: { status: 'ONGOING', chapters: 706 },
      mangadex: { status: 'completed', lastChapter: '686' },
      wikipedia: { chapters: 686, listed: 686 },
    });
    const stored = { endDate: null, status: 'COMPLETED' as const, chapters: 706 };
    expect(resolveVolumeGateCeiling(r, stored).expectedChapterCount).toBe(686);
    expect(applyCorroboratedFinalChapter(r, stored)).toMatchObject({ from: 706, to: 686 });
    expect((r.enrichmentResult.appliedMatch?.metadata as Record<string, unknown>)['chapters']).toBe(686);
  });

  it('does nothing for an ongoing series', () => {
    const r = results({
      metadata: { status: 'ONGOING', chapters: 147 },
      mangadex: { status: 'completed', lastChapter: '120' },
      wikipedia: { chapters: 120, listed: 120 },
    });
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
  });

  it('does nothing without a second provider agreeing', () => {
    const r = results({
      metadata: { status: 'COMPLETED', chapters: 706 },
      mangadex: { status: 'completed', lastChapter: '686' },
    });
    expect(applyCorroboratedFinalChapter(r)).toBeNull();
  });
});
