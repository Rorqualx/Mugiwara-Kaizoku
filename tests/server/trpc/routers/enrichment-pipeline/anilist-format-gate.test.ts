/** @jest-environment node */
import { describe, it, expect } from '@jest/globals';

import type { AniListMangaResult } from '@/server/services/anilist/service';
import {
  isNovelMediaType,
  NOVEL_FORMAT_PENALTY,
  pickBestTitleMatch,
  pickBestTitleMatchWithScore,
} from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/anilist-match';

function candidate(id: number, title: string, format: string, popularity = 100): AniListMangaResult {
  return { id, title: { romaji: title, english: title }, format, popularity } as AniListMangaResult;
}

// Blood Lad: AniList lists the light novel (92948) and the manga (51614) under
// the same title; the novel was bound for a manga-type library title.
const NOVEL = candidate(92948, 'Blood Lad', 'NOVEL', 9000);
const MANGA = candidate(51614, 'Blood Lad', 'MANGA', 100);

describe('AniList picker format gate', () => {
  it('prefers the MANGA entry over an identically titled NOVEL for a manga-type title', () => {
    // Without the gate the tie goes to popularity, i.e. to the novel here.
    expect(pickBestTitleMatch([NOVEL, MANGA], 'Blood Lad')?.id).toBe(92948);
    expect(pickBestTitleMatch([NOVEL, MANGA], 'Blood Lad', { demoteNovels: true })?.id).toBe(51614);
    expect(pickBestTitleMatch([MANGA, NOVEL], 'Blood Lad', { demoteNovels: true })?.id).toBe(51614);
  });

  it('still binds a NOVEL when it is the only candidate (demote, not exclude)', () => {
    expect(pickBestTitleMatch([NOVEL], 'Blood Lad', { demoteNovels: true })?.id).toBe(92948);
  });

  it('applies no penalty when the library title is itself a novel', () => {
    expect(isNovelMediaType('NOVEL')).toBe(true);
    expect(isNovelMediaType('LIGHT_NOVEL')).toBe(true);
    expect(pickBestTitleMatch([NOVEL, MANGA], 'Blood Lad', { demoteNovels: !isNovelMediaType('NOVEL') })?.id).toBe(92948);
  });

  it('treats today\'s media types (and a missing one) as not-a-novel', () => {
    expect(isNovelMediaType('MANGA')).toBe(false);
    expect(isNovelMediaType('COMICBOOK')).toBe(false);
    expect(isNovelMediaType(null)).toBe(false);
    expect(isNovelMediaType(undefined)).toBe(false);
  });

  it('leaves ONE_SHOT candidates alone', () => {
    const oneShot = candidate(1, 'Blood Lad', 'ONE_SHOT', 9000);
    expect(pickBestTitleMatch([oneShot, MANGA], 'Blood Lad', { demoteNovels: true })?.id).toBe(1);
  });

  it('lets an exact-title NOVEL beat a loosely related MANGA', () => {
    // The penalty is a demotion: 1.00 × 0.8 still outranks a weak manga match.
    const spinoff = candidate(2, 'Blood Lad Brat: Staz no Bouken', 'MANGA');
    expect(NOVEL_FORMAT_PENALTY).toBe(0.8);
    expect(pickBestTitleMatch([NOVEL, spinoff], 'Blood Lad', { demoteNovels: true })?.id).toBe(92948);
  });

  it('reports the raw title score, not the demoted one', () => {
    const picked = pickBestTitleMatchWithScore([NOVEL], 'Blood Lad', { demoteNovels: true });
    expect(picked?.result.id).toBe(92948);
    expect(picked?.score).toBe(1);
  });
});
