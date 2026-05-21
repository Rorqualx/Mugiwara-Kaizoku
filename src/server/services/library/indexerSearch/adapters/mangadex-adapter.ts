/**
 * MangaDex native-source adapter.
 *
 * Resolves candidates from the manga-level MangaDex binding
 * (`Manga.providerMetadata.mangadex.providerId`) — not from per-chapter
 * IDs. If the manga is bound, we fetch the MangaDex chapter list, match
 * each missing local chapter to a MangaDex chapter by chapter number,
 * and emit a `chapter`-granularity {@link ReleaseCandidate}.
 *
 * Resolved UUIDs are persisted back onto `Chapter.mangadexId` so the
 * next search hits the cached mapping instead of re-fetching the list.
 *
 * Fallback path (legacy): if a chapter row already has `mangadexId`
 * populated (e.g. by some earlier sync), use it directly without
 * touching the API.
 *
 * Score is fixed mid-rank (50). Native sources don't compete on score
 * within MangaDex; the dispatcher's pack-first ranking selects across
 * sources, then iterates over the missing chapters one-to-one.
 */
import { JobType } from '@prisma/client';

import { prisma } from '@/server/db';
import { getTsMangadexClient } from '@/server/services/mangadex/ts-client-factory';
import { logger } from '@/utils/logger';

import type { ReleaseCandidate } from '../types';

const log = logger.child('MangaDexAdapter');

export interface MissingChapterStub {
  id: number;
  chapterNumber: number | null;
  mangadexId: string | null;
  suwayomiChapterId: string | null;
}

export interface MangaDexCandidatePayload {
  chapterRowId: number;
  mangadexChapterId: string;
  chapterNumber: number;
}

interface ChapterListResponse {
  data?: Array<{
    id: string;
    attributes?: {
      chapter?: string | null;
      externalUrl?: string | null;
      translatedLanguage?: string | null;
    };
  }>;
  total?: number;
}

const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

/** One translation variant for a single chapter number. */
interface ChapterVariant {
  uuid: string;
  language: string;
}

/**
 * Fetch the MangaDex chapter list for a series and build a
 * {chapterNumber → variants[]} map. Multi-language chapters are
 * emitted as multiple variants so the dispatcher can pick the best
 * available (English preferred, then any). Returns an empty map on
 * any failure — callers fall through to whatever per-chapter IDs are
 * already in the DB.
 */
async function fetchChapterUuidMap(seriesId: string): Promise<Map<number, ChapterVariant[]>> {
  const map = new Map<number, ChapterVariant[]>();
  try {
    const client = await getTsMangadexClient();
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      // eslint-disable-next-line no-await-in-loop -- pagination
      const resp = (await client.getMangaChapters(seriesId, {
        limit: PAGE_LIMIT,
        offset,
        order: { chapter: 'asc' },
      })) as ChapterListResponse;
      const batch = Array.isArray(resp.data) ? resp.data : [];
      for (const ch of batch) {
        if (ch.attributes?.externalUrl) continue;
        const num = parseFloat(ch.attributes?.chapter ?? '');
        if (!Number.isFinite(num) || num < 0) continue;
        const language = ch.attributes?.translatedLanguage ?? 'unknown';
        const existing = map.get(num);
        const variant: ChapterVariant = { uuid: ch.id, language };
        if (existing) existing.push(variant);
        else map.set(num, [variant]);
      }
      const total = resp.total ?? 0;
      if (batch.length < PAGE_LIMIT || (offset + batch.length) >= total) break;
      offset += PAGE_LIMIT;
    }
    let totalVariants = 0;
    for (const v of map.values()) totalVariants += v.length;
    log.info('Resolved MangaDex chapter variants', {
      seriesId,
      chapterNumbers: map.size,
      totalVariants,
    });
  } catch (err: unknown) {
    log.warn('Failed to fetch MangaDex chapter list (will fall back to stored mangadexIds)', {
      seriesId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return map;
}

/** Within one chapter number, English wins. Falls back to first-seen. */
function pickPreferredVariant(variants: ChapterVariant[]): ChapterVariant | undefined {
  return variants.find(v => v.language === 'en') ?? variants[0];
}

/** Score MangaDex variant — English preferred, others ranked just below. */
function scoreForLanguage(language: string): number {
  if (language === 'en') return 60;
  return 50;
}

/**
 * Persist resolved chapter UUIDs back to the DB so future searches skip
 * the API round-trip. Best-effort — errors are logged and swallowed; the
 * search succeeds either way.
 */
async function persistResolvedUuids(
  resolved: Array<{ chapterRowId: number; mangadexChapterId: string }>,
): Promise<void> {
  if (resolved.length === 0) return;
  try {
    await prisma.$transaction(
      resolved.map(({ chapterRowId, mangadexChapterId }) =>
        prisma.chapter.update({
          where: { id: chapterRowId },
          data: { mangadexId: mangadexChapterId },
        }),
      ),
    );
    log.info('Persisted resolved MangaDex chapter UUIDs', { count: resolved.length });
  } catch (err: unknown) {
    log.warn('Failed to persist resolved MangaDex chapter UUIDs (search succeeds anyway)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Read the manga's MangaDex providerId out of `providerMetadata.mangadex`.
 * Returns null when no binding exists.
 */
async function loadMangaDexSeriesId(mangaId: number): Promise<string | null> {
  try {
    const m = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { providerMetadata: true },
    });
    const pm = m?.providerMetadata as { mangadex?: { providerId?: unknown } } | null;
    const id = pm?.mangadex?.providerId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch (err: unknown) {
    log.warn('loadMangaDexSeriesId failed', {
      mangaId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function buildCandidate(
  chapterRowId: number,
  chapterNumber: number,
  mangadexChapterId: string,
  language?: string,
): ReleaseCandidate {
  const payload: MangaDexCandidatePayload = {
    chapterRowId,
    mangadexChapterId,
    chapterNumber,
  };
  const lang = language ?? 'unknown';
  return {
    source: 'mangadex',
    granularity: 'chapter',
    coverage: { chapters: [chapterNumber] },
    score: scoreForLanguage(lang),
    label: `MangaDex chapter ${chapterNumber} (${lang})`,
    payload,
    enqueueJobType: JobType.mangadex_download,
  };
}

/**
 * Build candidates for missing chapters. Series-bound resolution flow:
 *
 *   1. For chapters with a stored `mangadexId`, use it directly.
 *   2. For chapters without, look up the series binding and fetch the
 *      MangaDex chapter list once. Match by chapter number.
 *   3. Persist newly-resolved UUIDs back to Chapter rows so the next
 *      search short-circuits straight to step 1.
 *   4. Anything still unresolvable (chapter number not in the MangaDex
 *      list, or no series binding) is silently skipped — other adapters
 *      may still satisfy it.
 */
export async function searchMangaDex(
  mangaId: number,
  missingChapters: MissingChapterStub[],
): Promise<ReleaseCandidate[]> {
  const candidates: ReleaseCandidate[] = [];
  const needsResolution: MissingChapterStub[] = [];

  for (const ch of missingChapters) {
    if (ch.chapterNumber === null) continue;
    if (ch.mangadexId !== null) {
      candidates.push(buildCandidate(ch.id, ch.chapterNumber, ch.mangadexId));
    } else {
      needsResolution.push(ch);
    }
  }

  if (needsResolution.length > 0) {
    const seriesId = await loadMangaDexSeriesId(mangaId);
    if (seriesId !== null) {
      const uuidMap = await fetchChapterUuidMap(seriesId);
      const resolved: Array<{ chapterRowId: number; mangadexChapterId: string }> = [];
      for (const ch of needsResolution) {
        if (ch.chapterNumber === null) continue;
        const variants = uuidMap.get(ch.chapterNumber);
        if (variants === undefined || variants.length === 0) continue;
        // Emit one candidate per language variant (English scored higher).
        // The dispatcher picks the highest-scored variant per chapter, so
        // English wins by default; if MangaDex doesn't have English for
        // this chapter, any other language is still a valid fallback.
        for (const v of variants) {
          candidates.push(buildCandidate(ch.id, ch.chapterNumber, v.uuid, v.language));
        }
        // Cache the preferred (English-first) variant on the chapter row
        // so subsequent searches short-circuit straight to it.
        const cached = pickPreferredVariant(variants);
        if (cached) resolved.push({ chapterRowId: ch.id, mangadexChapterId: cached.uuid });
      }
      if (resolved.length > 0) {
        await persistResolvedUuids(resolved);
      }
    }
  }

  log.info('MangaDex: candidates built', {
    mangaId,
    missing: missingChapters.length,
    coveredByMangaDex: candidates.length,
    resolvedFromSeriesBinding: needsResolution.length > 0 ? candidates.length - (missingChapters.length - needsResolution.length) : 0,
  });
  return candidates;
}
