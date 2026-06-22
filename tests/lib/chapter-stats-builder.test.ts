/**
 * @jest-environment node
 *
 * Per-manga grid aggregate (`buildChapterStats`).
 *
 * Pins the JS *truth* the SQL parity harness validates against. The key
 * subtlety: scalar fields (realChapterCount/downloaded/read/latest) filter with
 * `isRealChapter` (sentinel-band rows excluded), while the volume tally uses
 * `isNumbered` (chapterNumber != null) — so a legacy synthetic chapterNumber
 * >= 100000 is excluded from realChapterCount yet counted in the tally. Both
 * notions must survive any SQL re-implementation.
 */

import { describe, it, expect } from '@jest/globals';

import { buildChapterStats } from '@/components/library/utils/chapter-stats-builder';

import type { StatChapter } from '@/components/library/utils/chapter-stats-builder';

const COMPLETED = 'COMPLETED';
const PENDING = 'PENDING';
const ERROR = 'ERROR';

describe('buildChapterStats', () => {
  it('computes scalar fields over real chapters only and scans all rows for monitored/lastRead', () => {
    const readAt = new Date('2026-06-01T12:00:00.000Z');
    const chapters: StatChapter[] = [
      { index: 1, chapterNumber: 1, isRead: true, downloadStatus: COMPLETED, updatedAt: readAt },
      { index: 2, chapterNumber: 2, isRead: false, downloadStatus: COMPLETED },
      { index: 3, chapterNumber: 3, isRead: false, downloadStatus: ERROR },
      // sentinel volume row: excluded from real scalars, but its monitored flag still counts
      { index: 100001, chapterNumber: null, downloadStatus: COMPLETED, monitored: true },
    ];

    const stats = buildChapterStats(chapters);
    expect(stats.realChapterCount).toBe(3);
    expect(stats.downloadedCount).toBe(2);
    expect(stats.readCount).toBe(1);
    expect(stats.hasErrors).toBe(true);
    expect(stats.latestChapterNumber).toBe('3');
    expect(stats.lastReadAt).toBe(readAt.toISOString());
    expect(stats.isMonitored).toBe(true);
  });

  it('excludes a legacy synthetic chapterNumber >= 100000 from realChapterCount but counts it in the tally', () => {
    const chapters: StatChapter[] = [
      { index: 1, chapterNumber: 1, downloadStatus: COMPLETED, volume: 1 },
      { index: 5, chapterNumber: 100001, downloadStatus: COMPLETED, volume: 1 },
    ];
    const stats = buildChapterStats(chapters);
    expect(stats.realChapterCount).toBe(1);
    expect(stats.tally).toEqual({ downloadedChapters: 2, totalChapters: 2, downloadedVolumes: 1, totalVolumes: 1 });
  });

  it('takes the max real chapterNumber for latest, including decimals', () => {
    const chapters: StatChapter[] = [
      { index: 1, chapterNumber: 49, downloadStatus: COMPLETED },
      { index: 2, chapterNumber: 49.5, downloadStatus: COMPLETED },
      { index: 100002, chapterNumber: null, downloadStatus: COMPLETED },
    ];
    expect(buildChapterStats(chapters).latestChapterNumber).toBe('49.5');
  });

  it('picks the newest updatedAt among read chapters for lastReadAt', () => {
    const older = new Date('2026-01-01T00:00:00.000Z');
    const newer = new Date('2026-06-15T08:30:00.000Z');
    const chapters: StatChapter[] = [
      { index: 1, chapterNumber: 1, isRead: true, downloadStatus: COMPLETED, updatedAt: older },
      { index: 2, chapterNumber: 2, isRead: true, downloadStatus: COMPLETED, updatedAt: newer },
      { index: 3, chapterNumber: 3, isRead: false, downloadStatus: COMPLETED, updatedAt: new Date('2026-12-31T00:00:00.000Z') },
    ];
    expect(buildChapterStats(chapters).lastReadAt).toBe(newer.toISOString());
  });

  it('returns the empty aggregate for a manga with no chapters', () => {
    expect(buildChapterStats([])).toEqual({
      realChapterCount: 0,
      downloadedCount: 0,
      readCount: 0,
      hasErrors: false,
      latestChapterNumber: null,
      lastReadAt: null,
      isMonitored: false,
      tally: { downloadedChapters: 0, totalChapters: 0, downloadedVolumes: 0, totalVolumes: 0 },
    });
  });

  it('has no errors / no monitored / no lastRead when none apply', () => {
    const chapters: StatChapter[] = [
      { index: 1, chapterNumber: 1, isRead: false, downloadStatus: COMPLETED },
      { index: 2, chapterNumber: 2, isRead: false, downloadStatus: PENDING },
    ];
    const stats = buildChapterStats(chapters);
    expect(stats.hasErrors).toBe(false);
    expect(stats.isMonitored).toBe(false);
    expect(stats.lastReadAt).toBeNull();
    expect(stats.readCount).toBe(0);
  });
});
