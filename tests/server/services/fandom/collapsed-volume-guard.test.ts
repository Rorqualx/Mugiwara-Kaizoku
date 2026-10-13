/**
 * @jest-environment node
 *
 * A Fandom parse that files hundreds of chapters under one volume (Sakamoto
 * Days: all 278 chapters under volume 28) must not reach the database as a
 * volume assignment. Chapters are kept; the impossible volume number is not.
 */

import { describe, expect, it } from '@jest/globals';

import {
  dropCollapsedVolumeAssignment,
  findCollapsedVolumes,
  findCollapsedVolumeInMap,
} from '@/server/services/fandom/adaptive/orchestrator/collapsed-volume-guard';
import { supplementVolumesFromPage } from '@/server/services/fandom/adaptive/orchestrator/list-page-target';
import type { StandardParsedData } from '@/server/services/fandom/adaptive/orchestrator/result-converters';

const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('collapsed-volume guard', () => {
  it('rejects one volume holding all 278 chapters and keeps the chapters', () => {
    const data: StandardParsedData = {
      volumes: range(1, 28).map(n => ({ number: n })),
      chapters: range(1, 278).map(n => ({ number: n, title: `Days ${n}`, volume: 28 })),
    };
    expect(dropCollapsedVolumeAssignment(data, 'test')).toEqual([28]);
    expect(data.chapters).toHaveLength(278);
    expect(data.chapters.every(c => c.volume === undefined)).toBe(true);
    expect(data.volumes).toHaveLength(28);
  });

  it('rejects a single volume whose nested chapter list holds 120 chapters', () => {
    const data: StandardParsedData = {
      volumes: [{ number: 1, chapters: range(1, 120).map(n => ({ number: n })) }],
      chapters: [],
    };
    expect(dropCollapsedVolumeAssignment(data, 'test')).toEqual([1]);
    expect(data.volumes[0]?.chapters).toEqual([]);
  });

  it('rejects a parse that repeats all 202 chapters under each of 20 volumes (Call of the Night tabbed page)', () => {
    const data: StandardParsedData = {
      volumes: range(1, 20).map(n => ({ number: n })),
      chapters: range(1, 20).flatMap(v => range(1, 202).map(n => ({ number: n, volume: v }))),
    };
    expect(dropCollapsedVolumeAssignment(data, 'test')).toHaveLength(20);
    expect(data.chapters.some(c => c.volume !== undefined)).toBe(false);
  });

  it('leaves a normal 28-volume layout alone', () => {
    const data: StandardParsedData = {
      volumes: range(1, 28).map(n => ({ number: n })),
      chapters: range(1, 278).map(n => ({ number: n, volume: Math.min(28, Math.ceil(n / 10)) })),
    };
    expect(findCollapsedVolumes(data)).toEqual([]);
    expect(dropCollapsedVolumeAssignment(data, 'test')).toEqual([]);
    expect(data.chapters[0]?.volume).toBe(1);
  });

  it('flags a MediaWiki-fallback chapter→volume map that files 246 of 278 chapters under volume 28', () => {
    const map: Record<number, number> = {};
    for (const n of range(1, 278)) map[n] = n <= 32 ? Math.ceil(n / 8) : 28;
    expect(findCollapsedVolumeInMap(map)).toBe(28);
    expect(findCollapsedVolumeInMap(Object.fromEntries(range(1, 278).map(n => [n, Math.ceil(n / 10)])))).toBeNull();
  });

  it('leaves a short series filed under one volume alone (a 12-chapter one-volume series is real)', () => {
    const data: StandardParsedData = { volumes: [{ number: 1 }], chapters: range(1, 12).map(n => ({ number: n, volume: 1 })) };
    expect(findCollapsedVolumes(data)).toEqual([]);
  });
});

describe('supplementVolumesFromPage', () => {
  it('takes the volume list from a separate volume page and files volume-less chapters by it', async () => {
    const data: StandardParsedData = {
      volumes: [],
      chapters: range(1, 20).map(n => ({ number: n, title: `Chapter ${n}` })),
    };
    const volumePage: StandardParsedData = {
      volumes: [
        { number: 1, title: 'First', chapters: range(1, 10).map(n => ({ number: n })) },
        { number: 2, title: 'Second', chapters: range(11, 20).map(n => ({ number: n })) },
      ],
      chapters: [],
    };
    await supplementVolumesFromPage(data, 'https://x.fandom.com/wiki/List_of_Volumes', () => Promise.resolve(volumePage));
    expect(data.volumes.map(v => v.number)).toEqual([1, 2]);
    expect(data.chapters.find(c => c.number === 15)?.volume).toBe(2);
    expect(data.chapters.find(c => c.number === 15)?.title).toBe('Chapter 15');
  });

  it('keeps the chapter page volumes when the volume page lists no more', async () => {
    const data: StandardParsedData = { volumes: [{ number: 1 }, { number: 2 }], chapters: [{ number: 1, volume: 1 }] };
    await supplementVolumesFromPage(data, 'https://x.fandom.com/wiki/Volumes', () => Promise.resolve({ volumes: [{ number: 1 }], chapters: [] }));
    expect(data.volumes).toHaveLength(2);
  });
});
