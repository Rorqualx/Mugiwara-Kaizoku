/**
 * MangaDex native-source adapter.
 *
 * Resolves candidates from the manga-level MangaDex binding
 * (`Manga.providerMetadata.mangadex.providerId`) — not from per-chapter
 * IDs. If the manga is bound, we fetch the MangaDex chapter list, match
 * each missing local chapter to a MangaDex chapter by chapter number,
 * and emit a `chapter`-granularity {@link ReleaseCandidate}.
 *
 * Resolved UUIDs are persisted back onto `Chapter.mangadexId` — together
 * with the `translatedLanguage` on `Chapter.language` — so the next search
 * hits the cached mapping instead of re-fetching the list.
 *
 * ## Language handling
 *
 * `mangadex.preferredLanguage` is a **hard filter** by default. Only
 * translations matching the preferred language family (see
 * {@link isPreferredLanguage}) are eligible for download; anything else is
 * dropped so the chapter falls through to Prowlarr/Suwayomi, which can
 * usually satisfy it in the right language.
 *
 * Setting `mangadex.allowLanguageFallback` re-enables the historical
 * behaviour of accepting any available translation when the preferred one
 * is missing. That default used to be implicitly on and unconfigurable,
 * which is how es-la/ca/vi chapters ended up in English-only libraries:
 * MangaDex frequently has *zero* English uploads for licensed series (the
 * publisher issues takedowns) while other languages remain, so the
 * "any language is better than nothing" fallback fired constantly.
 *
 * Score is fixed mid-rank (50), or 60 for a preferred-language match.
 * Native sources don't compete on score within MangaDex; the dispatcher's
 * pack-first ranking selects across sources, then iterates over the
 * missing chapters one-to-one.
 */
import { JobType } from '@prisma/client';

import { prisma } from '@/server/db';
import { mangadexConfigService } from '@/server/services/mangadex/configService';
import { isPreferredLanguage } from '@/server/services/mangadex/language-match';
import { getTsMangadexClient } from '@/server/services/mangadex/ts-client-factory';
import { logger } from '@/utils/logger';

import type { ReleaseCandidate } from '../types';

const log = logger.child('MangaDexAdapter');

export interface MissingChapterStub {
  id: number;
  chapterNumber: number | null;
  mangadexId: string | null;
  suwayomiChapterId: string | null;
  /** `translatedLanguage` of the already-bound UUID, when known. Null on
   * rows bound before language persistence existed — see the backfill
   * script `scripts/maintenance/backfill-chapter-language.ts`. */
  language?: string | null;
}

export interface MangaDexCandidatePayload {
  chapterRowId: number;
  mangadexChapterId: string;
  chapterNumber: number;
}

interface ChapterListEntry {
  id: string;
  attributes?: {
    chapter?: string | null;
    externalUrl?: string | null;
    translatedLanguage?: string | null;
  };
}

interface ChapterListResponse {
  data?: ChapterListEntry[];
  total?: number;
}

interface MangaDetailResponse {
  data?: {
    attributes?: {
      availableTranslatedLanguages?: Array<string | null> | null;
    };
  };
}

const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

const UNKNOWN_LANGUAGE = 'unknown';

/** Score for a translation that matches the preferred language family. */
const SCORE_PREFERRED = 60;
/** Score for a non-preferred translation (only reachable with fallback on). */
const SCORE_FALLBACK = 50;

/** One translation variant for a single chapter number. */
export interface ChapterVariant {
  uuid: string;
  language: string;
}

/** Download-side language policy for one search run. */
export interface LanguagePolicy {
  preferred: string;
  allowFallback: boolean;
}

interface ResolvedBinding {
  chapterRowId: number;
  mangadexChapterId: string;
  language: string;
}

/**
 * Read the download-side language policy. Falls back to a strict `en`
 * policy on any config error — matching `DEFAULT_MANGADEX_CONFIG` and the
 * metadata pipeline's default.
 */
async function loadLanguagePolicy(preferredOverride?: string): Promise<LanguagePolicy> {
  const override = preferredOverride?.trim();
  try {
    const cfg = await mangadexConfigService.getDownloadConfig();
    const configured = cfg.preferredLanguage.trim();
    const preferred = override && override.length > 0
      ? override
      : (configured.length > 0 ? configured : 'en');
    return { preferred, allowFallback: cfg.allowLanguageFallback };
  } catch (err: unknown) {
    log.warn('Failed to load MangaDex download config; defaulting to strict preferred language', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      preferred: override && override.length > 0 ? override : 'en',
      allowFallback: false,
    };
  }
}

/**
 * Resolve the concrete MangaDex language codes to request for a series.
 *
 * MangaDex mixes bare and regional codes (`en`, `es`, `es-la`, `pt-br`), and
 * the settings UI offers both forms — a user preferring `es` must still match
 * a series that only publishes `es-la`. Rather than guess the regional
 * variants, we read the series' own `availableTranslatedLanguages` and keep
 * those in the preferred family.
 *
 * Returns null when the series detail can't be read, meaning "don't filter
 * server-side" — the caller still applies the client-side family filter.
 */
async function resolveRequestLanguages(
  seriesId: string,
  preferred: string,
): Promise<string[] | null> {
  try {
    const client = await getTsMangadexClient();
    const resp = (await client.getManga(seriesId)) as unknown as MangaDetailResponse;
    const available = resp.data?.attributes?.availableTranslatedLanguages;
    if (!Array.isArray(available)) return null;
    return available.filter(
      (l): l is string => typeof l === 'string' && isPreferredLanguage(l, preferred),
    );
  } catch (err: unknown) {
    log.warn('Failed to read availableTranslatedLanguages; falling back to client-side filter', {
      seriesId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Fold one API page into the {chapterNumber → variants[]} accumulator. */
function absorbChapterBatch(map: Map<number, ChapterVariant[]>, batch: ChapterListEntry[]): void {
  for (const ch of batch) {
    if (ch.attributes?.externalUrl) continue;
    const num = parseFloat(ch.attributes?.chapter ?? '');
    if (!Number.isFinite(num) || num < 0) continue;
    const variant: ChapterVariant = {
      uuid: ch.id,
      language: ch.attributes?.translatedLanguage ?? UNKNOWN_LANGUAGE,
    };
    const existing = map.get(num);
    if (existing) existing.push(variant);
    else map.set(num, [variant]);
  }
}

/**
 * Fetch the MangaDex chapter list for a series and build a
 * {chapterNumber → variants[]} map.
 *
 * `requestLanguages` (when non-null and non-empty) is applied as a
 * server-side `translatedLanguage[]` filter. Beyond correctness this bounds
 * pagination: an unfiltered fetch of a long series across ~10 languages can
 * exceed the MAX_PAGES × PAGE_LIMIT ceiling and silently truncate the tail.
 *
 * Returns an empty map on any failure — callers fall through to whatever
 * per-chapter IDs are already in the DB.
 */
async function fetchChapterUuidMap(
  seriesId: string,
  requestLanguages: string[] | null,
): Promise<Map<number, ChapterVariant[]>> {
  const map = new Map<number, ChapterVariant[]>();
  const langFilter =
    requestLanguages && requestLanguages.length > 0
      ? { translatedLanguage: requestLanguages }
      : {};
  let truncated = false;
  try {
    const client = await getTsMangadexClient();
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      // eslint-disable-next-line no-await-in-loop -- pagination
      const resp = (await client.getMangaChapters(seriesId, {
        limit: PAGE_LIMIT,
        offset,
        order: { chapter: 'asc' },
        ...langFilter,
      })) as ChapterListResponse;
      const batch = Array.isArray(resp.data) ? resp.data : [];
      absorbChapterBatch(map, batch);
      const total = resp.total ?? 0;
      if (batch.length < PAGE_LIMIT || (offset + batch.length) >= total) break;
      offset += PAGE_LIMIT;
      truncated = page === MAX_PAGES - 1;
    }
    log.info('Resolved MangaDex chapter variants', {
      seriesId,
      requestLanguages,
      chapterNumbers: map.size,
    });
  } catch (err: unknown) {
    log.warn('Failed to fetch MangaDex chapter list (will fall back to stored mangadexIds)', {
      seriesId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  if (truncated) {
    log.warn('MangaDex chapter list hit the pagination ceiling; tail may be missing', {
      seriesId,
      ceiling: MAX_PAGES * PAGE_LIMIT,
    });
  }
  return map;
}

/**
 * Apply the language policy to one chapter number's variants.
 *
 * Strict (default): only preferred-family translations survive; if none do,
 * the chapter yields no MangaDex candidate at all and is left to other
 * sources. With fallback enabled, preferred variants are still returned
 * alone when present — fallback only widens the set when there are none.
 */
export function filterVariantsByPolicy(
  variants: readonly ChapterVariant[],
  policy: LanguagePolicy,
): ChapterVariant[] {
  const preferred = variants.filter(v => isPreferredLanguage(v.language, policy.preferred));
  if (preferred.length > 0) return preferred;
  return policy.allowFallback ? [...variants] : [];
}

/** Within the eligible set, a preferred-family variant wins; else first-seen. */
export function pickPreferredVariant(
  variants: readonly ChapterVariant[],
  preferred: string,
): ChapterVariant | undefined {
  return variants.find(v => isPreferredLanguage(v.language, preferred)) ?? variants[0];
}

/** Score MangaDex variant — preferred language ranks above any fallback. */
export function scoreForLanguage(language: string, preferred: string): number {
  return isPreferredLanguage(language, preferred) ? SCORE_PREFERRED : SCORE_FALLBACK;
}

/**
 * Decide whether an already-bound chapter row may still be offered.
 *
 * A row bound before language persistence has `language == null`. We can't
 * prove it's in the right language, but we also can't reject every legacy
 * row without stranding the ~half of the library that is correctly English.
 * Such rows are admitted and counted for observability; the backfill script
 * fills `language` in, after which this gate is exact.
 */
export function storedBindingIsEligible(
  ch: MissingChapterStub,
  policy: LanguagePolicy,
): boolean {
  if (ch.language === null || ch.language === undefined) return true;
  if (isPreferredLanguage(ch.language, policy.preferred)) return true;
  return policy.allowFallback;
}

/**
 * Persist resolved chapter UUIDs back to the DB so future searches skip
 * the API round-trip.
 *
 * The `language` write is what makes the dispatcher's Phase 2b
 * `language_mismatch` gate effective: that gate is fail-open on a null
 * language, so omitting it here (as this function used to) left every
 * freshly-bound row unguarded.
 *
 * Best-effort — errors are logged and swallowed; the search succeeds either way.
 */
async function persistResolvedUuids(resolved: ResolvedBinding[]): Promise<void> {
  if (resolved.length === 0) return;
  try {
    await prisma.$transaction(
      resolved.map(({ chapterRowId, mangadexChapterId, language }) =>
        prisma.chapter.update({
          where: { id: chapterRowId },
          data: { mangadexId: mangadexChapterId, language },
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
  language: string,
  preferred: string,
): ReleaseCandidate {
  const payload: MangaDexCandidatePayload = {
    chapterRowId,
    mangadexChapterId,
    chapterNumber,
  };
  return {
    source: 'mangadex',
    granularity: 'chapter',
    coverage: { chapters: [chapterNumber] },
    score: scoreForLanguage(language, preferred),
    label: `MangaDex chapter ${chapterNumber} (${language})`,
    payload,
    enqueueJobType: JobType.mangadex_download,
  };
}

interface PartitionResult {
  candidates: ReleaseCandidate[];
  needsResolution: MissingChapterStub[];
  skippedStoredByLanguage: number;
  unknownLanguageBindings: number;
}

/**
 * Split the missing chapters into "already bound (emit directly)" and
 * "needs a series-list lookup", applying the language policy to the
 * already-bound rows.
 */
export function partitionStoredBindings(
  missingChapters: readonly MissingChapterStub[],
  policy: LanguagePolicy,
): PartitionResult {
  const out: PartitionResult = {
    candidates: [],
    needsResolution: [],
    skippedStoredByLanguage: 0,
    unknownLanguageBindings: 0,
  };
  for (const ch of missingChapters) {
    if (ch.chapterNumber === null) continue;
    if (ch.mangadexId === null) {
      out.needsResolution.push(ch);
      continue;
    }
    if (!storedBindingIsEligible(ch, policy)) {
      out.skippedStoredByLanguage++;
      continue;
    }
    const lang = ch.language ?? UNKNOWN_LANGUAGE;
    if (lang === UNKNOWN_LANGUAGE) out.unknownLanguageBindings++;
    out.candidates.push(
      buildCandidate(ch.id, ch.chapterNumber, ch.mangadexId, lang, policy.preferred),
    );
  }
  return out;
}

/**
 * Match one unbound chapter against the fetched variant map under the
 * language policy. Returns the candidates to emit plus the binding to cache
 * (null when nothing eligible was found).
 */
export function matchChapterToVariants(
  ch: MissingChapterStub,
  uuidMap: ReadonlyMap<number, ChapterVariant[]>,
  policy: LanguagePolicy,
): { candidates: ReleaseCandidate[]; binding: ResolvedBinding | null } {
  const chapterNumber = ch.chapterNumber;
  if (chapterNumber === null) return { candidates: [], binding: null };
  const variants = uuidMap.get(chapterNumber);
  if (variants === undefined || variants.length === 0) return { candidates: [], binding: null };
  const eligible = filterVariantsByPolicy(variants, policy);
  if (eligible.length === 0) return { candidates: [], binding: null };
  // Emit one candidate per eligible variant (preferred scored higher); the
  // dispatcher picks the highest-scored variant per chapter.
  const candidates = eligible.map(v =>
    buildCandidate(ch.id, chapterNumber, v.uuid, v.language, policy.preferred),
  );
  const cached = pickPreferredVariant(eligible, policy.preferred);
  return {
    candidates,
    binding: cached
      ? { chapterRowId: ch.id, mangadexChapterId: cached.uuid, language: cached.language }
      : null,
  };
}

/**
 * Resolve chapters that have no stored `mangadexId` against the series
 * chapter list, emitting candidates and caching the chosen bindings.
 */
async function resolveUnboundChapters(
  mangaId: number,
  needsResolution: readonly MissingChapterStub[],
  policy: LanguagePolicy,
): Promise<ReleaseCandidate[]> {
  const seriesId = await loadMangaDexSeriesId(mangaId);
  if (seriesId === null) return [];

  const requestLanguages = await resolveRequestLanguages(seriesId, policy.preferred);
  // Strict mode + the series publishes nothing in the preferred family:
  // no chapter fetch can help, so skip the (up to 50-page) round-trip.
  if (!policy.allowFallback && requestLanguages !== null && requestLanguages.length === 0) {
    log.info('MangaDex: series has no translation in the preferred language; skipping', {
      mangaId,
      seriesId,
      preferredLanguage: policy.preferred,
    });
    return [];
  }

  const uuidMap = await fetchChapterUuidMap(
    seriesId,
    policy.allowFallback ? null : requestLanguages,
  );

  const candidates: ReleaseCandidate[] = [];
  const bindings: ResolvedBinding[] = [];
  for (const ch of needsResolution) {
    const { candidates: got, binding } = matchChapterToVariants(ch, uuidMap, policy);
    candidates.push(...got);
    if (binding) bindings.push(binding);
  }
  await persistResolvedUuids(bindings);
  return candidates;
}

/**
 * Build candidates for missing chapters. Series-bound resolution flow:
 *
 *   1. For chapters with a stored `mangadexId`, use it directly — subject to
 *      the language policy when the stored language is known.
 *   2. For chapters without, look up the series binding, resolve which
 *      language codes to request, and fetch the MangaDex chapter list once.
 *      Match by chapter number.
 *   3. Persist newly-resolved UUIDs (and their language) back to Chapter rows
 *      so the next search short-circuits straight to step 1.
 *   4. Anything still unresolvable (chapter number not in the MangaDex list,
 *      no series binding, or no translation in the preferred language) is
 *      silently skipped — other adapters may still satisfy it.
 */
export async function searchMangaDex(
  mangaId: number,
  missingChapters: MissingChapterStub[],
  preferredLanguageOverride?: string,
): Promise<ReleaseCandidate[]> {
  const policy = await loadLanguagePolicy(preferredLanguageOverride);
  const partition = partitionStoredBindings(missingChapters, policy);
  const candidates = [...partition.candidates];

  if (partition.needsResolution.length > 0) {
    candidates.push(...(await resolveUnboundChapters(mangaId, partition.needsResolution, policy)));
  }

  log.info('MangaDex: candidates built', {
    mangaId,
    missing: missingChapters.length,
    preferredLanguage: policy.preferred,
    allowLanguageFallback: policy.allowFallback,
    candidates: candidates.length,
    skippedStoredByLanguage: partition.skippedStoredByLanguage,
    unknownLanguageBindings: partition.unknownLanguageBindings,
  });
  return candidates;
}
