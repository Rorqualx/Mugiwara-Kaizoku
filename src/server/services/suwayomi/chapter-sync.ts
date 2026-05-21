/**
 * Suwayomi Chapter Sync
 *
 * Populates `Chapter.suwayomiChapterId` for an existing Kaizoku Manga by
 * pulling the chapter list from Suwayomi (via `fetchChapters` / `getChapters`)
 * and matching to local rows by chapterNumber.
 *
 * Cross-source rows: Suwayomi-only chapters (numbers not present in the local
 * Chapter table) create fresh rows with `mangadexId: null` so the dispatcher
 * picks them up as native-source candidates. Reconciler dedup key is
 * `(mangaId, chapterNumber)`.
 */
import { ChapterStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { suwayomiConfigService } from './configService';
import { getSuwayomiGraphQLClient } from './graphql/client';
import { readSuwayomiPluginConfig } from './manga-matcher';

import type { ChapterType } from './graphql/types';

const log = logger.child('SuwayomiChapterSync');

/** Tolerance for Float comparisons between Kaizoku Chapter.chapterNumber
 * (typically clean decimals like 1, 1.5, 2) and Suwayomi's chapterNumber. */
const CHAPTER_NUMBER_EPSILON = 0.01;

export interface ChapterSyncResult {
  mangaId: number;
  suwayomiMangaId: number;
  suwayomiTotal: number;
  matched: number;
  unmatched: number;
  suwayomiOnly: number;
  reason?: string;
}

interface KaizokuChapterStub {
  id: number;
  chapterNumber: number | null;
  suwayomiChapterId: string | null;
}

/** Build a lookup keyed by rounded chapterNumber for O(1) lookups. */
function indexByNumber(rows: KaizokuChapterStub[]): Map<string, KaizokuChapterStub> {
  const map = new Map<string, KaizokuChapterStub>();
  for (const row of rows) {
    if (row.chapterNumber === null) continue;
    const key = row.chapterNumber.toFixed(2);
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

/** Find the Kaizoku chapter row whose chapterNumber matches a Suwayomi
 * chapter within EPSILON. */
function findMatch(
  suwayomi: ChapterType,
  byNumber: Map<string, KaizokuChapterStub>,
): KaizokuChapterStub | null {
  const key = suwayomi.chapterNumber.toFixed(2);
  const direct = byNumber.get(key);
  if (direct) return direct;
  // Fallback: scan for fuzzy match within epsilon
  for (const [, row] of byNumber) {
    if (row.chapterNumber === null) continue;
    if (Math.abs(row.chapterNumber - suwayomi.chapterNumber) <= CHAPTER_NUMBER_EPSILON) {
      return row;
    }
  }
  return null;
}

interface SyncContext {
  kaizokuMangaId: number;
  suwayomiMangaId: number;
}

async function fetchSuwayomiChapters(suwayomiMangaId: number): Promise<ChapterType[]> {
  const config = await suwayomiConfigService.loadConfig();
  const client = getSuwayomiGraphQLClient({
    httpUrl: `http://localhost:${config.port}/api/graphql`,
    wsUrl: `ws://localhost:${config.port}/api/graphql`,
  });
  // First make sure Suwayomi has actually fetched the chapter list from the
  // upstream extension; getChapters returns whatever's cached locally.
  await client.fetchChapters(suwayomiMangaId);
  const result = await client.getChapters(suwayomiMangaId, 1000);
  return result.chapters;
}

/**
 * Insert one Chapter row for a Suwayomi-only chapter. Returns true on success;
 * swallows conflicts (unique index on suwayomiChapterId, race with reconciler)
 * and returns false so the caller can keep going.
 */
async function createSingleSuwayomiChapter(
  ctx: SyncContext,
  sw: ChapterType,
): Promise<boolean> {
  try {
    // Placeholder fileName follows the reconciler convention (c001.cbz);
    // the real path is set later when the dispatcher downloads the chapter.
    const placeholderFileName = `c${Math.round(sw.chapterNumber).toString().padStart(3, '0')}.cbz`;
    await prisma.chapter.create({
      data: {
        mangaId: ctx.kaizokuMangaId,
        suwayomiChapterId: String(sw.id),
        title: sw.name.trim() !== '' ? sw.name : `Chapter ${sw.chapterNumber}`,
        fileName: placeholderFileName,
        chapterNumber: sw.chapterNumber,
        number: sw.chapterNumber,
        index: Math.round(sw.chapterNumber * 1000),
        monitored: true,
        downloadStatus: ChapterStatus.PENDING,
        updatedAt: new Date(),
      },
    });
    return true;
  } catch (err) {
    log.debug('Skipped creating Suwayomi-only chapter row', {
      kaizokuMangaId: ctx.kaizokuMangaId,
      suwayomiChapterId: sw.id,
      chapterNumber: sw.chapterNumber,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Create Chapter rows for Suwayomi chapters that don't match any existing
 * Kaizoku row by chapterNumber. New rows carry `suwayomiChapterId` only
 * (mangadexId stays null) so the dispatcher tags them as native-Suwayomi
 * candidates. Returns the count of rows created.
 */
async function applyChapterCreates(
  ctx: SyncContext,
  suwayomiChapters: ChapterType[],
): Promise<number> {
  if (suwayomiChapters.length === 0) return 0;
  let created = 0;
  for (const sw of suwayomiChapters) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential write to honor unique-index conflicts
    const ok = await createSingleSuwayomiChapter(ctx, sw);
    if (ok) created++;
  }
  if (created > 0) {
    log.info('Created Suwayomi-only Chapter rows', {
      kaizokuMangaId: ctx.kaizokuMangaId,
      suwayomiMangaId: ctx.suwayomiMangaId,
      count: created,
    });
  }
  return created;
}

async function applyChapterUpdates(
  ctx: SyncContext,
  matches: Array<{ kaizokuId: number; suwayomiChapterId: string }>,
): Promise<void> {
  if (matches.length === 0) return;
  // Update one chapter at a time; the unique index on suwayomiChapterId means
  // we can't bulk-write without risk of conflicts when re-syncing.
  for (const m of matches) {
    // eslint-disable-next-line no-await-in-loop -- intentional sequential write
    await prisma.chapter.update({
      where: { id: m.kaizokuId },
      data: { suwayomiChapterId: m.suwayomiChapterId },
    });
  }
  log.info('Suwayomi chapter ids upserted', {
    kaizokuMangaId: ctx.kaizokuMangaId,
    suwayomiMangaId: ctx.suwayomiMangaId,
    count: matches.length,
  });
}

/** Run a chapter sync for one manga. Returns counts and updates the
 * suwayomiPluginConfig with totals + lastSyncedAt. */
export async function syncSuwayomiChapters(mangaId: number): Promise<ChapterSyncResult> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { id: true, suwayomiPluginConfig: true },
  });
  if (!manga) {
    return {
      mangaId, suwayomiMangaId: 0, suwayomiTotal: 0,
      matched: 0, unmatched: 0, suwayomiOnly: 0,
      reason: `Manga ${mangaId} not found`,
    };
  }

  const config = readSuwayomiPluginConfig(manga.suwayomiPluginConfig);
  if (!config.mangaId) {
    return {
      mangaId, suwayomiMangaId: 0, suwayomiTotal: 0,
      matched: 0, unmatched: 0, suwayomiOnly: 0,
      reason: 'No Suwayomi mangaId — run the matcher first',
    };
  }

  const suwayomiMangaId = config.mangaId;
  const suwayomiChapters = await fetchSuwayomiChapters(suwayomiMangaId);
  const kaizokuChapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { id: true, chapterNumber: true, suwayomiChapterId: true },
  });

  const byNumber = indexByNumber(kaizokuChapters);
  const updates: Array<{ kaizokuId: number; suwayomiChapterId: string }> = [];
  const creates: ChapterType[] = [];

  for (const sw of suwayomiChapters) {
    const match = findMatch(sw, byNumber);
    if (!match) {
      creates.push(sw);
      continue;
    }
    const newId = String(sw.id);
    if (match.suwayomiChapterId !== newId) {
      updates.push({ kaizokuId: match.id, suwayomiChapterId: newId });
    }
  }

  await applyChapterUpdates({ kaizokuMangaId: mangaId, suwayomiMangaId }, updates);
  const suwayomiOnly = await applyChapterCreates({ kaizokuMangaId: mangaId, suwayomiMangaId }, creates);

  // After updates, recount how many Kaizoku rows now have a suwayomiChapterId.
  const matched = await prisma.chapter.count({
    where: { mangaId, NOT: { suwayomiChapterId: null } },
  });
  const totalKaizoku = kaizokuChapters.length;
  const unmatched = totalKaizoku - matched;

  await prisma.manga.update({
    where: { id: mangaId },
    data: {
      suwayomiPluginConfig: {
        ...config,
        totalChapters: suwayomiChapters.length,
        unmatchedChapters: unmatched,
        lastSyncedAt: new Date().toISOString(),
      },
    },
  });

  return {
    mangaId,
    suwayomiMangaId,
    suwayomiTotal: suwayomiChapters.length,
    matched,
    unmatched,
    suwayomiOnly,
  };
}
