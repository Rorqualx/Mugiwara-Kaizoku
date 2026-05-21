/**
 * Quick Download Service
 *
 * Thin shim that delegates the real work to the unified release-search
 * pipeline (`src/server/services/library/releaseDispatcher/dispatch.ts`)
 * — same code path the post-enrichment auto-trigger uses, just with an
 * explicit user scope and `bypassRuleCheck`.
 *
 * The 500-line per-chapter Prowlarr orchestrator that lived here previously
 * (chapter-processor / volume-processor / series-search / utils) was
 * Prowlarr-only; the unified pipeline fans out to Prowlarr + MangaDex +
 * Suwayomi + GetComics. Migrating here gives every manual download access
 * to the same source list as the auto-trigger.
 */

import type { ReleaseScope } from '@/server/services/library/indexerSearch/types';
import { runUnifiedReleaseSearch } from '@/server/services/library/releaseDispatcher/dispatch';
import type { DispatchSummary, RunOptions } from '@/server/services/library/releaseDispatcher/dispatch';
import { notifyChapterProgress } from '@/server/services/notifications/notify';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type {
  QuickDownloadInput,
  QuickDownloadResponse,
  QuickDownloadChapterResult,
} from '@/types/quickDownload.types';
import logger from '@/utils/serverLogger';

import type { PrismaClient } from '@prisma/client';

interface ResolvedScope {
  scope: ReleaseScope;
  /** Chapter rows the request targets — used to map dispatch outcomes back to per-chapter results. */
  chapterIds: number[];
}

function resolveSingleScope(chapterId: number | undefined): ResolvedScope {
  if (chapterId === undefined) {
    throw new Error('SINGLE mode requires chapterId');
  }
  return {
    scope: { mode: 'SINGLE', chapterIds: [chapterId] },
    chapterIds: [chapterId],
  };
}

function resolveBulkScope(chapterIds: number[] | undefined): ResolvedScope {
  if (!chapterIds || chapterIds.length === 0) {
    throw new Error('BULK mode requires non-empty chapterIds');
  }
  return {
    scope: { mode: 'BULK', chapterIds },
    chapterIds,
  };
}

async function resolveVolumeScope(
  prisma: PrismaClient,
  mangaId: number,
  volumeNumber: number | undefined,
): Promise<ResolvedScope> {
  if (volumeNumber === undefined) {
    throw new Error('VOLUME mode requires volumeNumber');
  }
  const rows = await prisma.chapter.findMany({
    where: { mangaId, volume: volumeNumber },
    select: { id: true },
  });
  if (rows.length === 0) {
    throw new Error(`No chapters found for volume ${volumeNumber}`);
  }
  return {
    scope: { mode: 'VOLUME', volumeNumber },
    chapterIds: rows.map(r => r.id),
  };
}

/**
 * Quick Download Service
 *
 * Public API preserved for backwards compatibility with the tRPC layer and
 * UI hooks. Internally everything routes through the unified pipeline.
 */
export class QuickDownloadService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Execute a Quick Download for one or more chapters.
   *
   * Translates `QuickDownloadInput` → `RunOptions`, calls
   * `runUnifiedReleaseSearch`, and maps the dispatcher's `DispatchSummary`
   * back to the per-chapter shape the UI expects.
   */
  async executeQuickDownload(
    input: QuickDownloadInput,
    userId?: string,
  ): Promise<QuickDownloadResponse> {
    const { mangaId, mode, criteria } = input;
    logger.info(`[QuickDownload] Starting ${mode} quick download for manga ${mangaId}`);

    const manga = await this.prisma.manga.findUnique({
      where: { id: mangaId },
      select: { id: true, title: true },
    });
    if (!manga) {
      throw new Error(`Manga with ID ${mangaId} not found`);
    }

    const resolved = await this.resolveScope(input);
    if (resolved.chapterIds.length === 0) {
      logger.info(`[QuickDownload] No chapters in scope; nothing to download`);
      return emptyResponse();
    }

    const chapterMeta = userId
      ? await this.prisma.chapter.findMany({
          where: { id: { in: resolved.chapterIds } },
          select: { id: true, chapterNumber: true, index: true },
        })
      : [];
    const chapterMetaById = new Map(chapterMeta.map(c => [c.id, c]));

    void realtimeEmitter.emitSearchProgress({
      mangaId,
      mangaTitle: manga.title,
      phase: 'searching',
      message: `Searching all enabled sources for ${manga.title}...`,
    });

    if (userId) {
      await emitChapterRollingRows({
        userId,
        mangaTitle: manga.title,
        mangaId,
        chapterIds: resolved.chapterIds,
        metaById: chapterMetaById,
        rowFor: () => ({ severity: 'INFO', message: 'Searching all sources…' }),
      });
    }

    try {
      const runOptions: RunOptions = {
        scope: resolved.scope,
        bypassRuleCheck: true,
        ...(criteria !== undefined ? { criteria } : {}),
      };
      const summary = await runUnifiedReleaseSearch(mangaId, runOptions);
      const response = await mapSummaryToResponse(summary, resolved.chapterIds, this.prisma);

      void realtimeEmitter.emitSearchProgress({
        mangaId,
        mangaTitle: manga.title,
        phase: 'complete',
        message: progressMessage(manga.title, response.summary),
        resultCount: response.summary.started,
        startedCount: response.summary.started,
        totalCount: response.summary.total,
      });

      if (userId) {
        const resultById = new Map(response.results.map(r => [r.chapterId, r]));
        await emitChapterRollingRows({
          userId,
          mangaTitle: manga.title,
          mangaId,
          chapterIds: resolved.chapterIds,
          metaById: chapterMetaById,
          rowFor: chapterId => rollingOutcome(resultById.get(chapterId)),
        });
      }

      logger.info(
        `[QuickDownload] Completed: ${response.summary.started}/${response.summary.total} started, ` +
          `${response.summary.failed} failed, ${response.summary.noResults} no results`,
      );
      return response;
    } catch (err: unknown) {
      void realtimeEmitter.emitSearchProgress({
        mangaId,
        mangaTitle: manga.title,
        phase: 'error',
        message: `Search failed for ${manga.title}`,
      });

      if (userId) {
        const errMsg = err instanceof Error ? err.message : String(err);
        await emitChapterRollingRows({
          userId,
          mangaTitle: manga.title,
          mangaId,
          chapterIds: resolved.chapterIds,
          metaById: chapterMetaById,
          rowFor: () => ({ severity: 'ERROR', message: `Search failed: ${errMsg}` }),
        });
      }

      throw err;
    }
  }

  /** Resolve `QuickDownloadInput` into `{ scope, chapterIds }`. */
  private async resolveScope(input: QuickDownloadInput): Promise<ResolvedScope> {
    const { mangaId, chapterId, chapterIds, volumeNumber, mode } = input;
    switch (mode) {
      case 'SINGLE':
        return resolveSingleScope(chapterId);
      case 'BULK':
        return resolveBulkScope(chapterIds);
      case 'VOLUME':
        return resolveVolumeScope(this.prisma, mangaId, volumeNumber);
      default: {
        const exhaustive: never = mode;
        throw new Error(`Unsupported QuickDownload mode: ${String(exhaustive)}`);
      }
    }
  }
}

interface RollingRow {
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
}

/**
 * Format the rolling-row title as `{MangaTitle} — Ch {N}`. Falls back to the
 * chapter index when no canonical chapterNumber is set (omake / volume zero /
 * placeholder rows).
 */
function rollingTitle(
  mangaTitle: string,
  meta: { chapterNumber: number | null; index: number } | undefined,
): string {
  const num = meta?.chapterNumber ?? meta?.index;
  if (num === undefined) return mangaTitle;
  return `${mangaTitle} — Ch ${num}`;
}

/**
 * Translate the per-chapter dispatch result into the rolling row's final
 * severity + message. Severity drives the icon the bell renders.
 */
function rollingOutcome(result: QuickDownloadChapterResult | undefined): RollingRow {
  if (!result) return { severity: 'WARNING', message: 'No outcome recorded' };
  if (result.status === 'STARTED') {
    const src = result.indexer ?? 'source';
    return { severity: 'SUCCESS', message: `Found ${src} — downloading` };
  }
  if (result.status === 'NO_RESULTS') {
    return { severity: 'WARNING', message: 'No source found' };
  }
  return { severity: 'ERROR', message: result.error ?? 'Dispatch failed' };
}

interface RollingRowsBatch {
  userId: string;
  mangaTitle: string;
  mangaId: number;
  chapterIds: number[];
  metaById: Map<number, { chapterNumber: number | null; index: number }>;
  rowFor: (chapterId: number) => RollingRow;
}

/**
 * Fan an upsert across every chapter in scope. `rowFor` lets the caller decide
 * a per-chapter severity + message (e.g. uniform "Searching…" at start,
 * per-chapter outcome at end). Awaited so the DB writes finish before the
 * caller returns — keeps the realtime push and the persisted row consistent.
 */
async function emitChapterRollingRows(batch: RollingRowsBatch): Promise<void> {
  const { userId, mangaTitle, mangaId, chapterIds, metaById, rowFor } = batch;
  await Promise.allSettled(
    chapterIds.map(chapterId => {
      const row = rowFor(chapterId);
      return notifyChapterProgress({
        userId,
        chapterId,
        type: 'NATIVE_DOWNLOAD_PROGRESS',
        severity: row.severity,
        title: rollingTitle(mangaTitle, metaById.get(chapterId)),
        message: row.message,
        relatedMangaId: mangaId,
        actionUrl: `/manga/${mangaId}`,
      });
    }),
  );
}

/**
 * Build a search-progress message that accurately reflects the dispatch
 * outcome. Distinguishes the four real cases:
 *  - all chapters covered  → green, "Started N/N chapters"
 *  - partial coverage      → yellow, "Started X/N — Y had no releases"
 *  - nothing covered       → yellow, "No releases found for any of the N chapters"
 *  - empty scope           → handled by emptyResponse upstream
 */
function progressMessage(
  title: string,
  s: { total: number; started: number; noResults: number; allBlocked: number },
): string {
  if (s.total === 0) return `Nothing in scope for ${title}`;
  if (s.allBlocked > 0 && s.started === 0) return `All ${s.allBlocked} releases blocked for ${title}`;
  if (s.started === s.total) return `Started ${s.started}/${s.total} chapters for ${title}`;
  if (s.started > 0) return `Started ${s.started}/${s.total} — ${s.noResults} had no releases (${title})`;
  return `No releases found for any of the ${s.total} chapters of ${title}`;
}

/** Empty success response — used when there's nothing in scope to dispatch. */
function emptyResponse(): QuickDownloadResponse {
  return {
    success: true,
    results: [],
    summary: { total: 0, started: 0, failed: 0, noResults: 0, allBlocked: 0 },
  };
}

type NativeSource = DispatchSummary['nativeEnqueued'][number]['source'];

/**
 * Synthesize one per-chapter `QuickDownloadChapterResult` from the
 * dispatcher's pack-granularity outcome. The UI only reads
 * status/releaseTitle/indexer; we attribute every requested chapter to the
 * dispatched pack when one was selected.
 *
 * Both lookup keys are chapter NUMBERS (e.g. 27.1, 109) — the dispatcher
 * tracks coverage by chapter number, not Prisma row id. We translate row
 * ids → numbers via `chapterNumberById` before calling.
 */
function buildChapterResult(
  chapterId: number,
  chapterNumber: number | null,
  summary: DispatchSummary,
  prowlarrCovered: Set<number>,
  nativeBySource: Map<number, NativeSource>,
): QuickDownloadChapterResult {
  // Attribute to Prowlarr only when *this* chapter is in the dispatched
  // pack's coverage. Previously this checked `prowlarrCovered.size > 0`,
  // which over-counted: a pack covering 3 of 9 chapters would mark all 9
  // as STARTED.
  if (
    summary.triggeredProwlarr &&
    chapterNumber !== null &&
    prowlarrCovered.has(chapterNumber)
  ) {
    return {
      chapterId,
      status: 'STARTED',
      ...(summary.prowlarrSelected?.releaseTitle !== undefined
        ? { releaseTitle: summary.prowlarrSelected.releaseTitle }
        : {}),
      ...(summary.prowlarrSelected?.indexer !== undefined
        ? { indexer: summary.prowlarrSelected.indexer }
        : {}),
      ...(summary.prowlarrSelected?.score !== undefined
        ? { score: summary.prowlarrSelected.score }
        : {}),
    };
  }
  if (chapterNumber !== null) {
    const nativeSource = nativeBySource.get(chapterNumber);
    if (nativeSource !== undefined) {
      return {
        chapterId,
        status: 'STARTED',
        releaseTitle: `Native (${nativeSource})`,
        indexer: nativeSource,
      };
    }
  }
  return {
    chapterId,
    status: 'NO_RESULTS',
    error: 'No matching releases found across Prowlarr, MangaDex, or Suwayomi',
  };
}

/**
 * Map a `DispatchSummary` to the per-chapter response shape the UI expects.
 * The dispatcher dispatches at pack granularity; the UI displays per-chapter
 * notifications, so we synthesize one result per requested chapter id.
 *
 * The dispatcher reports coverage in chapter NUMBERS, but the UI requests
 * by Prisma row id; we bridge the two namespaces with a one-shot lookup.
 */
async function mapSummaryToResponse(
  summary: DispatchSummary,
  requestedChapterIds: number[],
  prisma: PrismaClient,
): Promise<QuickDownloadResponse> {
  const rows = await prisma.chapter.findMany({
    where: { id: { in: requestedChapterIds } },
    select: { id: true, chapterNumber: true },
  });
  const chapterNumberById = new Map(rows.map(r => [r.id, r.chapterNumber]));

  const prowlarrCovered = new Set(summary.prowlarrCoveredChapters);
  const nativeBySource = new Map<number, NativeSource>(
    summary.nativeEnqueued.map(n => [n.chapterNumber, n.source]),
  );

  const results = requestedChapterIds.map(chapterId =>
    buildChapterResult(
      chapterId,
      chapterNumberById.get(chapterId) ?? null,
      summary,
      prowlarrCovered,
      nativeBySource,
    ),
  );
  const startedCount = results.filter(r => r.status === 'STARTED').length;
  const noResultsCount = results.filter(r => r.status === 'NO_RESULTS').length;
  return {
    success: startedCount > 0,
    results,
    summary: {
      total: results.length,
      started: startedCount,
      failed: 0,
      noResults: noResultsCount,
      allBlocked: 0,
    },
  };
}
