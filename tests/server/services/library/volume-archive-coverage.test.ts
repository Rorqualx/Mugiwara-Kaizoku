/**
 * @jest-environment node
 *
 * Volume-archive coverage — pure logic tests.
 *
 * Guards the durable fix for the Akira class of bug: a whole-volume archive
 * (file-backed, COMPLETED, chapterNumber=null) covers every numbered chapter in
 * its volume. Range/manifest fixes that re-home chapters must mark those covered
 * chapters COMPLETED (linkArchiveCoveredChapters), and the dispatcher must never
 * re-download an archive-covered volume.
 */
import { describe, it, expect } from '@jest/globals';

import {
  volumesWithFileBackedArchive,
  selectChaptersToLink,
  filterUncoveredCandidates,
  type CoverageRow,
} from '@/server/services/library/volume-archive-coverage';

// --- builders -------------------------------------------------------------
let nextId = 1;
const archive = (volume: number, over: Partial<CoverageRow> = {}): CoverageRow => ({
  id: nextId++, chapterNumber: null, volume, downloadStatus: 'COMPLETED',
  filePath: `/lib/V${String(volume).padStart(2, '0')}.cbr`, fileName: `V${volume}.cbr`,
  fileFormat: 'cbr', size: 1000, pageCount: 300, ...over,
});
const chap = (volume: number | null, chapterNumber: number, over: Partial<CoverageRow> = {}): CoverageRow => ({
  id: nextId++, chapterNumber, volume, downloadStatus: 'PENDING', filePath: null, ...over,
});

describe('volumesWithFileBackedArchive', () => {
  it('includes a volume with a file-backed COMPLETED archive', () => {
    const rows = [archive(1), chap(1, 1), chap(1, 2)];
    expect([...volumesWithFileBackedArchive(rows)]).toEqual([1]);
  });

  it('excludes a file-less (orphan/per-chapter) archive row', () => {
    const rows = [archive(2, { filePath: null }), chap(2, 10)];
    expect(volumesWithFileBackedArchive(rows).size).toBe(0);
  });

  it('excludes a non-COMPLETED archive row', () => {
    const rows = [archive(3, { downloadStatus: 'PENDING' })];
    expect(volumesWithFileBackedArchive(rows).size).toBe(0);
  });

  it('ignores the unassigned bucket (volume -1)', () => {
    const rows = [archive(-1)];
    expect(volumesWithFileBackedArchive(rows).size).toBe(0);
  });
});

describe('selectChaptersToLink', () => {
  it('links every fileless numbered chapter in an archive-covered volume (Akira vol 2-6 case)', () => {
    const rows = [archive(2), chap(2, 19), chap(2, 20), chap(2, 21)];
    const links = selectChaptersToLink(rows);
    expect(links.map(l => l.chapterId).sort()).toEqual(rows.filter(r => r.chapterNumber !== null).map(r => r.id).sort());
    expect(links.every(l => l.filePath === '/lib/V02.cbr' && l.pageCount === 300)).toBe(true);
  });

  it('leaves chapters with their own individual file untouched (Akira vol 1: ch 1-10 have files)', () => {
    const own1 = chap(1, 1, { downloadStatus: 'COMPLETED', filePath: '/lib/Chapter 0001.cbz' });
    const own2 = chap(1, 2, { downloadStatus: 'COMPLETED', filePath: '/lib/Chapter 0002.cbz' });
    const bare = chap(1, 11);
    const links = selectChaptersToLink([archive(1), own1, own2, bare]);
    expect(links.map(l => l.chapterId)).toEqual([bare.id]);
  });

  it('does nothing for a per-chapter import with a file-less archive (Kaiju case)', () => {
    const rows = [
      archive(5, { filePath: null }),
      chap(5, 50, { downloadStatus: 'COMPLETED', filePath: '/lib/c50.cbz' }),
      chap(5, 51, { downloadStatus: 'COMPLETED', filePath: '/lib/c51.cbz' }),
    ];
    expect(selectChaptersToLink(rows)).toEqual([]);
  });

  it('does nothing when the volume has no archive', () => {
    expect(selectChaptersToLink([chap(7, 70), chap(7, 71)])).toEqual([]);
  });

  it('is idempotent: chapters already pointing at the archive are not re-linked', () => {
    const linked = chap(2, 19, { downloadStatus: 'COMPLETED', filePath: '/lib/V02.cbr' });
    expect(selectChaptersToLink([archive(2), linked])).toEqual([]);
  });

  it('never links the archive row itself', () => {
    const a = archive(2);
    const links = selectChaptersToLink([a, chap(2, 19)]);
    expect(links.some(l => l.chapterId === a.id)).toBe(false);
  });

  it('ignores unassigned-bucket chapters even if a stray -1 archive exists', () => {
    expect(selectChaptersToLink([archive(-1), chap(-1, 64)])).toEqual([]);
  });

  it('handles a full Akira shape (vols 1-6, mixed) end to end', () => {
    const rows: CoverageRow[] = [];
    for (let v = 1; v <= 6; v++) rows.push(archive(v));
    for (let c = 1; c <= 10; c++) rows.push(chap(1, c, { downloadStatus: 'COMPLETED', filePath: `/lib/Chapter ${c}.cbz` }));
    for (let c = 11; c <= 120; c++) rows.push(chap(c <= 18 ? 1 : c <= 33 ? 2 : c <= 48 ? 3 : c <= 71 ? 4 : c <= 96 ? 5 : 6, c));
    const links = selectChaptersToLink(rows);
    expect(links).toHaveLength(110); // 120 numbered - 10 with own files
  });
});

describe('filterUncoveredCandidates', () => {
  it('drops candidates in archive-covered volumes, keeps the rest', () => {
    const candidates = [{ id: 1, volume: 2 }, { id: 2, volume: 7 }, { id: 3, volume: -1 }];
    const out = filterUncoveredCandidates(candidates, new Set([2]));
    expect(out.map(c => c.id)).toEqual([2, 3]);
  });

  it('keeps everything when no volume is covered', () => {
    const candidates = [{ id: 1, volume: 1 }, { id: 2, volume: 2 }];
    expect(filterUncoveredCandidates(candidates, new Set())).toHaveLength(2);
  });
});
