/**
 * @jest-environment node
 */
import { describe, it, expect } from '@jest/globals';

import type { ComicVineIssue } from '@/server/services/comicvine/service';
import { parseComicVineDescriptions } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/comicvine-description-parser';
import { findShiftedNumbering } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/comicvine-shifted-numbering';
import { mapComicVineIssuesToVolumes } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-provider-fetch/comicvine-volume-mapper';

import bleach from './fixtures/bleach-comicvine-volumes-59-61.json';

// Why this exists: ComicVine's Bleach volume 60 lists "Chapter 532" to
// "Chapter 541: The Sword Five" for the real chapters 531-540, so volumes 60
// and 61 both claimed chapter 541 and 541 took volume 60's title. The fixture
// is ComicVine's own descriptions for volumes 59-61.
const issues = bleach as unknown as ComicVineIssue[];

describe('findShiftedNumbering', () => {
  it('flags a volume missing one chapter before it and sharing one with the next', () => {
    const shifts = findShiftedNumbering([
      { volume: 59, start: 521, end: 530 },
      { volume: 60, start: 532, end: 541 },
      { volume: 61, start: 541, end: 550 },
    ]);
    expect([...shifts]).toEqual([[60, -1]]);
  });

  it('flags a volume sharing one with the previous and missing one after it', () => {
    const shifts = findShiftedNumbering([
      { volume: 1, start: 1, end: 9 },
      { volume: 2, start: 9, end: 17 },
      { volume: 3, start: 19, end: 27 },
    ]);
    expect([...shifts]).toEqual([[2, 1]]);
  });

  it('leaves a volume alone when only one end is off', () => {
    expect(findShiftedNumbering([
      { volume: 1, start: 1, end: 9 },
      { volume: 2, start: 11, end: 19 },
      { volume: 3, start: 20, end: 28 },
    ]).size).toBe(0);
    expect(findShiftedNumbering([
      { volume: 1, start: 1, end: 9 },
      { volume: 2, start: 10, end: 20 },
      { volume: 3, start: 20, end: 28 },
    ]).size).toBe(0);
  });

  it('does not judge the first or last volume', () => {
    expect(findShiftedNumbering([
      { volume: 1, start: 2, end: 10 },
      { volume: 2, start: 10, end: 18 },
    ]).size).toBe(0);
  });
});

describe('Bleach volume 60 from ComicVine', () => {
  it('gets the range 531-540, leaving 541 to volume 61', () => {
    const volumes = mapComicVineIssuesToVolumes(issues);
    expect(volumes.map(v => [v['volumeNumber'], v['startChapter'], v['endChapter']])).toEqual([
      ['59', '521', '530'],
      ['60', '531', '540'],
      ['61', '541', '550'],
    ]);
  });

  it('puts chapters 531-540 in volume 60 with their real titles', () => {
    const { chapters } = parseComicVineDescriptions({ manga: { volumes: issues.map(i => ({ ...i, volumeNumber: i.issue_number })) } });
    const byNumber = new Map(chapters.map(c => [c.number, c]));
    expect(byNumber.get(531)).toMatchObject({ volume: 60, title: expect.stringContaining('Op. 4') });
    expect(byNumber.get(540)).toMatchObject({ volume: 60, title: 'The Sword Five' });
    expect(byNumber.get(541)).toMatchObject({ volume: 61, title: 'THE BLADE AND ME 2' });
  });
});
