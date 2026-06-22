/**
 * Builds the per-manga chapter aggregate the library grid needs, so the server
 * can compute it once (manga.query) instead of shipping every chapter row to
 * the client. Reuses the EXACT client logic (isRealChapter + computeCardTally),
 * so server-computed stats are identical to the old client-side computation.
 *
 * @module components/library/utils/chapter-stats-builder
 */
import { ChapterStatus } from '@prisma/client';

import { computeCardTally } from './card-tally';
import { isRealChapter } from './library-chapter-stats';

import type { CardTally } from './card-tally';

/** Chapter fields the aggregate reads (server selects these). */
export interface StatChapter {
  index: number;
  chapterNumber?: number | null;
  isRead?: boolean | null;
  downloadStatus?: string | null;
  volume?: number | null;
  filePath?: string | null;
  monitored?: boolean | null;
  updatedAt?: Date | string | null;
}

/** Small recent-chapters preview returned alongside the aggregate (Detailed/Responsive views). */
export interface RecentChapterPreview {
  id: number;
  chapterNumber: number | null;
  title: string | null;
  isRead: boolean;
  downloadStatus: string;
}

/** Precomputed per-manga chapter aggregate (replaces the full Chapter array in list views). */
export interface MangaChapterStats {
  /** Real (non-volume-file) chapter count. */
  realChapterCount: number;
  /** Real chapters with downloadStatus COMPLETED. */
  downloadedCount: number;
  /** Real chapters marked read. */
  readCount: number;
  /** Any real chapter in ERROR. */
  hasErrors: boolean;
  /** Highest real chapter number, as a string (matches getLatestChapterNumber). */
  latestChapterNumber: string | null;
  /** Newest updatedAt among read chapters (ISO), for last-read sorting. */
  lastReadAt: string | null;
  /** Any chapter monitored. */
  isMonitored: boolean;
  /** Whole-volume-aware card download tally. */
  tally: CardTally;
}

export function buildChapterStats(chapters: StatChapter[]): MangaChapterStats {
  const real = chapters.filter(isRealChapter);

  let downloadedCount = 0;
  let readCount = 0;
  let hasErrors = false;
  let latestNum: number | null = null;
  for (const c of real) {
    if (c.downloadStatus === ChapterStatus.COMPLETED) downloadedCount++;
    if (c.isRead === true) readCount++;
    if (c.downloadStatus === ChapterStatus.ERROR) hasErrors = true;
    if (c.chapterNumber !== null && c.chapterNumber !== undefined) {
      if (latestNum === null || c.chapterNumber > latestNum) latestNum = c.chapterNumber;
    }
  }

  let lastReadMs: number | null = null;
  let isMonitored = false;
  for (const c of chapters) {
    if (c.monitored === true) isMonitored = true;
    if (c.isRead === true && c.updatedAt) {
      const ms = new Date(c.updatedAt).getTime();
      if (!Number.isNaN(ms) && (lastReadMs === null || ms > lastReadMs)) lastReadMs = ms;
    }
  }

  return {
    realChapterCount: real.length,
    downloadedCount,
    readCount,
    hasErrors,
    latestChapterNumber: latestNum !== null ? String(latestNum) : null,
    lastReadAt: lastReadMs !== null ? new Date(lastReadMs).toISOString() : null,
    isMonitored,
    tally: computeCardTally(chapters),
  };
}
