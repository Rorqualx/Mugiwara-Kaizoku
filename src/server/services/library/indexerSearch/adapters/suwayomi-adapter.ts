/**
 * Suwayomi native-source adapter.
 *
 * Resolves candidates from the manga-level Suwayomi binding
 * (`Manga.suwayomiPluginConfig.mangaId`, populated by the matcher) — not
 * from per-chapter IDs. If the manga is matched, we fetch the Suwayomi
 * chapter list via GraphQL, match each missing local chapter to a
 * Suwayomi chapter by chapter number, and emit a `chapter`-granularity
 * {@link ReleaseCandidate}.
 *
 * Resolved chapter IDs are persisted back onto `Chapter.suwayomiChapterId`
 * so the next search hits the cached mapping instead of re-fetching.
 *
 * Auto-runs the matcher on first search if a sourceId is set but the
 * manga isn't yet matched. The *global* Suwayomi dispatcher toggle
 * (`suwayomi.enabled`, checked by `phaseIndexerSearch.loadEnabledSources`)
 * is the only enable gate — the per-manga panel only carries source
 * binding state, not an on/off switch.
 *
 * Score is fixed at 40 — one rank below MangaDex (50) so the dispatcher's
 * within-source order is consistent when both sources can satisfy the same
 * chapter (MangaDex wins by default, Suwayomi is fallback).
 */
import { JobType } from '@prisma/client';

import { prisma } from '@/server/db';
import { getSuwayomiGraphQLClient } from '@/server/services/suwayomi/graphql/client';
import {
  matchMangaAcrossAllSuwayomiSources,
  matchMangaOnSuwayomi,
  readSuwayomiPluginConfig,
} from '@/server/services/suwayomi/manga-matcher';
import { logger } from '@/utils/logger';

import type { MissingChapterStub } from './mangadex-adapter';
import type { ReleaseCandidate } from '../types';

const log = logger.child('SuwayomiAdapter');

export interface SuwayomiCandidatePayload {
  chapterRowId: number;
  suwayomiChapterId: number;
  chapterNumber: number;
}

/**
 * Resolve the Suwayomi mangaId for this title. Three-step ladder:
 *   1. If `cfg.mangaId` is already set, return it (cached binding).
 *   2. If `cfg.sourceId` is set but no `mangaId` yet, run the single-source
 *      matcher (legacy: user previously hand-picked a source).
 *   3. Otherwise fan out across every installed Suwayomi source in parallel
 *      and pick the highest-confidence match. The winner is persisted onto
 *      `Manga.suwayomiPluginConfig` so subsequent searches short-circuit
 *      to step 1.
 *
 * The global on/off gate is upstream (`phaseIndexerSearch.loadEnabledSources`).
 * Returns null if no source can match the title above the confidence
 * threshold; the caller treats that as "Suwayomi can't help here".
 */
async function ensureSuwayomiMatched(mangaId: number): Promise<number | null> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { suwayomiPluginConfig: true },
    });
    const cfg = readSuwayomiPluginConfig(manga?.suwayomiPluginConfig ?? null);
    if (cfg.mangaId !== undefined) return cfg.mangaId;
    if (cfg.sourceId !== undefined) {
      log.info('Suwayomi: auto-matching unmatched manga (source pinned)', { mangaId, sourceId: cfg.sourceId });
      const result = await matchMangaOnSuwayomi({ mangaId, sourceId: cfg.sourceId });
      return result.matched && result.suwayomiMangaId !== undefined ? result.suwayomiMangaId : null;
    }
    log.info('Suwayomi: auto-discovering source for unbound manga', { mangaId });
    const result = await matchMangaAcrossAllSuwayomiSources(mangaId);
    return result.matched && result.suwayomiMangaId !== undefined ? result.suwayomiMangaId : null;
  } catch (err) {
    log.warn('Suwayomi auto-match failed', {
      mangaId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Fetch the Suwayomi chapter list for a series and build a
 * {chapterNumber → chapterId} map. Multi-page list paginated 200 at a
 * time. Returns an empty map on any failure.
 */
async function fetchChapterIdMap(suwayomiMangaId: number): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  try {
    const client = getSuwayomiGraphQLClient();
    let cursor: string | undefined;
    for (let page = 0; page < 25; page++) {
      // eslint-disable-next-line no-await-in-loop -- pagination
      const resp = await client.getChapters(suwayomiMangaId, 200, cursor);
      for (const ch of resp.chapters) {
        if (!Number.isFinite(ch.chapterNumber) || ch.chapterNumber < 0) continue;
        if (!map.has(ch.chapterNumber)) map.set(ch.chapterNumber, ch.id);
      }
      if (!resp.hasNextPage || resp.chapters.length === 0) break;
      const last = resp.chapters[resp.chapters.length - 1];
      cursor = last ? String(last.id) : undefined;
    }
    log.info('Resolved Suwayomi chapter IDs', {
      suwayomiMangaId,
      idCount: map.size,
    });
  } catch (err: unknown) {
    log.warn('Failed to fetch Suwayomi chapter list (will fall back to stored suwayomiChapterIds)', {
      suwayomiMangaId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return map;
}

/**
 * Persist resolved chapter IDs back to the DB so future searches skip
 * the GraphQL round-trip. Best-effort.
 */
async function persistResolvedIds(
  resolved: Array<{ chapterRowId: number; suwayomiChapterId: number }>,
): Promise<void> {
  if (resolved.length === 0) return;
  try {
    await prisma.$transaction(
      resolved.map(({ chapterRowId, suwayomiChapterId }) =>
        prisma.chapter.update({
          where: { id: chapterRowId },
          data: { suwayomiChapterId: String(suwayomiChapterId) },
        }),
      ),
    );
    log.info('Persisted resolved Suwayomi chapter IDs', { count: resolved.length });
  } catch (err: unknown) {
    log.warn('Failed to persist resolved Suwayomi chapter IDs (search succeeds anyway)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function buildCandidate(
  chapterRowId: number,
  chapterNumber: number,
  suwayomiChapterId: number,
): ReleaseCandidate {
  const payload: SuwayomiCandidatePayload = {
    chapterRowId,
    suwayomiChapterId,
    chapterNumber,
  };
  return {
    source: 'suwayomi',
    granularity: 'chapter',
    coverage: { chapters: [chapterNumber] },
    score: 40,
    label: `Suwayomi chapter ${chapterNumber}`,
    payload,
    enqueueJobType: JobType.suwayomi_download,
  };
}

/**
 * Build candidates for missing chapters using the manga-level Suwayomi
 * binding. Resolves per-chapter IDs at search time when the local row
 * doesn't have one stored, and persists the resolution back to the DB
 * so subsequent searches short-circuit.
 */
export async function searchSuwayomi(
  mangaId: number,
  missingChapters: MissingChapterStub[],
): Promise<ReleaseCandidate[]> {
  const suwayomiMangaId = await ensureSuwayomiMatched(mangaId);
  if (suwayomiMangaId === null) return [];

  const candidates: ReleaseCandidate[] = [];
  const needsResolution: MissingChapterStub[] = [];

  for (const ch of missingChapters) {
    if (ch.chapterNumber === null) continue;
    if (ch.suwayomiChapterId !== null) {
      const swId = parseInt(ch.suwayomiChapterId, 10);
      if (Number.isFinite(swId)) {
        candidates.push(buildCandidate(ch.id, ch.chapterNumber, swId));
        continue;
      }
    }
    needsResolution.push(ch);
  }

  if (needsResolution.length > 0) {
    const idMap = await fetchChapterIdMap(suwayomiMangaId);
    const resolved: Array<{ chapterRowId: number; suwayomiChapterId: number }> = [];
    for (const ch of needsResolution) {
      if (ch.chapterNumber === null) continue;
      const swId = idMap.get(ch.chapterNumber);
      if (swId === undefined) continue;
      candidates.push(buildCandidate(ch.id, ch.chapterNumber, swId));
      resolved.push({ chapterRowId: ch.id, suwayomiChapterId: swId });
    }
    if (resolved.length > 0) {
      await persistResolvedIds(resolved);
    }
  }

  log.info('Suwayomi: candidates built', {
    mangaId,
    suwayomiMangaId,
    missing: missingChapters.length,
    coveredBySuwayomi: candidates.length,
  });
  return candidates;
}
