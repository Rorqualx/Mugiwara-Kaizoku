/**
 * Phase: Unified Indexer Search
 *
 * Mirrors the structure of `phase-provider-fetch.ts` (the metadata pipeline's
 * fan-out) but for *release search*: every enabled source runs in parallel
 * via `Promise.allSettled`, each capped at 60s, and the results are flattened
 * into one `ReleaseCandidate[]` for the dispatcher.
 *
 * Source enable flags follow the same `${name}.enabled` config-key convention
 * as the metadata providers (`prowlarr.enabled`, `mangadex.enabled`,
 * `suwayomi.enabled`, `getcomics.enabled`).
 *
 * Adapters:
 * - {@link searchProwlarr}    — torrent / NZB releases (pack)
 * - {@link searchMangaDex}    — native chapter downloads
 * - {@link searchSuwayomi}    — Mihon-extension chapter downloads
 * - {@link searchGetComics}   — placeholder (DDL extractor only)
 *
 * The dispatcher (`releaseDispatcher/dispatch.ts`, Task #25) consumes the
 * returned candidates and applies pack-first ranking.
 */
import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { SearchSource } from '@/server/services/realtime/RealtimeEventEmitter';
import { withTimeoutOrNull } from '@/server/services/shared/with-timeout';
import { logger } from '@/utils/logger';

import { searchGetComics } from './adapters/getcomics-adapter';
import { searchMangaDex } from './adapters/mangadex-adapter';
import { searchProwlarr } from './adapters/prowlarr-adapter';
import { searchSuwayomi } from './adapters/suwayomi-adapter';

import type { MissingChapterStub } from './adapters/mangadex-adapter';
import type { IndexerSearchOptions, ReleaseCandidate, ReleaseScope } from './types';

const log = logger.child('PhaseIndexerSearch');

// 60s was too aggressive: Prowlarr's parallel fan-out across all configured
// indexers occasionally needs 80–95s for short generic queries (e.g. "Asshou"
// → 6 chars → 2 query variants × N indexers, with a slow tracker dragging the
// tail). Killing the phase at 60s threw away the eventually-returned manga
// candidates and surfaced "No matching releases for N chapters" while logs
// showed Prowlarr finishing 20–30s after the orchestrator already gave up.
// 120s covers the observed worst case with margin; the toast updates live
// per source so the wait is transparent rather than silent.
const PROVIDER_TIMEOUT_MS = 120_000;

/**
 * Read source enable flags from each source's authoritative location.
 * Several sources have multiple roles; we read the *download / indexer*
 * flag here, not the metadata-provider one:
 *
 *   - prowlarr:  `prowlarr.enabled`           — single role
 *   - mangadex:  `mangadex.download.enabled`  — separate from the
 *     metadata-provider toggle `mangadex.enabled` (which gates whether
 *     the enrichment pipeline asks MangaDex for series metadata).
 *     Disabling the download role does NOT stop metadata fetching.
 *   - suwayomi:  `suwayomi.enabled`           — single role (Suwayomi is
 *     primarily a chapter-source bridge; no separate metadata role).
 *   - getcomics: `GetComicsSettings.enabled`  — Prisma table the existing
 *     /settings/indexers UI writes to. The legacy `getcomics.enabled`
 *     Config key was disconnected from the user-facing toggle and is
 *     intentionally not read here.
 */
async function loadEnabledSources(): Promise<Set<string>> {
  const SOURCE_FLAG_KEYS: Array<{ id: string; key: string; default: boolean }> = [
    { id: 'prowlarr', key: 'prowlarr.enabled', default: true },
    { id: 'mangadex', key: 'mangadex.download.enabled', default: true },
    { id: 'suwayomi', key: 'suwayomi.enabled', default: true },
  ];
  const enabled = new Set<string>();
  try {
    const { getConfigBoolean } = await import('@/server/utils/configReader');
    const flags = await Promise.all(
      SOURCE_FLAG_KEYS.map(async ({ id, key, default: def }) => {
        const value = await getConfigBoolean(key, def);
        return [id, value] as const;
      }),
    );
    for (const [id, value] of flags) {
      if (value) enabled.add(id);
    }
    // GetComics: read from the Prisma table the existing UI writes to.
    const { prisma: db } = await import('@/server/db');
    const gc = await db.getComicsSettings.findUnique({
      where: { id: 'default' },
      select: { enabled: true },
    });
    if (gc?.enabled === true) enabled.add('getcomics');
    // Suwayomi is config-enabled but the server is often turned off
    // (suwayomi.autoStart=false). Without this gate the adapter still
    // calls into a dead localhost:4567 every search, the GraphQL client
    // swallows the failure as "0 chapters", and we log a [ERROR] Failed
    // to get chapters per attempt for nothing. Probe once + 60s cache.
    if (enabled.has('suwayomi')) {
      const { isSuwayomiReachable } = await import('@/server/services/suwayomi/server-reachable');
      const reachable = await isSuwayomiReachable();
      if (!reachable) {
        log.info('Skipping Suwayomi adapter: server unreachable on localhost:4567');
        enabled.delete('suwayomi');
      }
    }
    return enabled;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.warn('loadEnabledSources failed, defaulting to safe-on set', {
      error: errorMessage,
    });
    void realtimeEmitter.emitNotification({
      title: 'Indexer config load failed',
      message: `Falling back to default sources. Check /settings/indexers. (${errorMessage})`,
      level: 'warning',
    });
    return new Set(SOURCE_FLAG_KEYS.filter(s => s.default).map(s => s.id));
  }
}

interface MangaSearchInput {
  mangaId: number;
  mangaTitle: string;
  /** Romaji / native / synonym titles fed to title-based adapters (Prowlarr, GetComics)
   *  alongside the primary EN title. Capped + deduped by `loadSearchInput`. */
  altTitles: string[];
  missingChapters: MissingChapterStub[];
  /**
   * iter-GC: discriminator that picks which native adapters run.
   * `MANGA` → MangaDex + Suwayomi; `COMICBOOK` → GetComics. Prowlarr
   * runs for both. Defaults to `MANGA` when the column is unenriched.
   */
  mediaType: 'MANGA' | 'COMICBOOK';
}

const ALT_TITLE_CAP = 5;

/** Build an alt-title list from Metadata.synonyms, capped + deduped + excluding the primary. */
function buildAltTitles(
  primary: string,
  synonyms: string[] | undefined,
): string[] {
  const primaryLower = primary.trim().toLowerCase();
  const seen = new Set<string>([primaryLower]);
  const out: string[] = [];
  for (const raw of synonyms ?? []) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(trimmed);
    if (out.length >= ALT_TITLE_CAP) break;
  }
  return out;
}

/**
 * Build the Prisma `where` for the chapters this run should consider, given
 * an optional scope. ALL_MISSING (or no scope) keeps the auto-trigger
 * semantics (`monitored: true`); explicit manual scopes drop that filter
 * because the user is asking directly.
 */
function buildChapterWhere(mangaId: number, scope?: ReleaseScope): Record<string, unknown> {
  const base = { mangaId, downloadStatus: { not: 'COMPLETED' as const } };
  if (!scope || scope.mode === 'ALL_MISSING') {
    return { ...base, monitored: true };
  }
  if ((scope.mode === 'SINGLE' || scope.mode === 'BULK') && scope.chapterIds && scope.chapterIds.length > 0) {
    return { ...base, id: { in: scope.chapterIds } };
  }
  if (scope.mode === 'VOLUME' && scope.volumeNumber !== undefined) {
    return { ...base, volume: scope.volumeNumber };
  }
  log.warn('Invalid scope for indexer search; falling back to ALL_MISSING semantics', { scope });
  return { ...base, monitored: true };
}

/** Look up the manga + missing-chapter stubs for the search. */
async function loadSearchInput(
  mangaId: number,
  scope?: ReleaseScope,
): Promise<MangaSearchInput | null> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: {
      id: true,
      title: true,
      mediaType: true,
      Metadata: { select: { synonyms: true } },
    },
  });
  if (!manga) return null;
  const altTitles = buildAltTitles(manga.title, manga.Metadata?.synonyms);
  const chapters = await prisma.chapter.findMany({
    where: buildChapterWhere(mangaId, scope),
    // `language` feeds the MangaDex adapter's preferred-language gate — without
    // it every stored binding looks unknown-language and the gate can't reject
    // a wrong-language UUID.
    select: {
      id: true, chapterNumber: true, mangadexId: true, suwayomiChapterId: true, language: true,
    },
  });
  return {
    mangaId: manga.id,
    mangaTitle: manga.title,
    altTitles,
    missingChapters: chapters,
    mediaType: manga.mediaType === 'COMICBOOK' ? 'COMICBOOK' : 'MANGA',
  };
}

/**
 * Fan out to every enabled release source, returning one flat `ReleaseCandidate[]`.
 * Errors per-source degrade to empty (the source's adapter is responsible for
 * its own try/catch); the orchestrator never throws.
 */
export async function phaseIndexerSearch(
  mangaId: number,
  options?: IndexerSearchOptions,
): Promise<ReleaseCandidate[]> {
  const scopeMode = options?.scope?.mode ?? 'ALL_MISSING';
  const preferredLanguage = options?.preferredLanguage;

  const input = await loadSearchInput(mangaId, options?.scope);
  if (!input) {
    log.warn('Manga not found for indexer search', { mangaId });
    return [];
  }
  if (input.missingChapters.length === 0) {
    log.info('No chapters in scope; skipping indexer search', { mangaId, scope: scopeMode });
    return [];
  }

  const enabled = await loadEnabledSources();
  log.info('Indexer search starting', {
    mangaId,
    title: input.mangaTitle,
    altTitleCount: input.altTitles.length,
    missingChapters: input.missingChapters.length,
    enabledSources: [...enabled].join(','),
    forceRefresh: options?.forceRefresh ?? false,
    scope: scopeMode,
  });

  const t = PROVIDER_TIMEOUT_MS;

  // iter-GC: native adapters are mediaType-gated. MangaDex + Suwayomi only
  // carry Japanese/Korean serialized work; GetComics is Western comics.
  // Prowlarr carries both — never gated by mediaType.
  const isManga = input.mediaType === 'MANGA';
  const isComic = input.mediaType === 'COMICBOOK';

  const sourceTasks: Array<{ source: SearchSource; task: Promise<ReleaseCandidate[] | null> }> = [];
  if (enabled.has('prowlarr')) sourceTasks.push({ source: 'prowlarr', task: withTimeoutOrNull(searchProwlarr(input.mangaTitle, input.altTitles, input.mangaId), t, 'prowlarr-search') });
  if (isManga && enabled.has('mangadex')) sourceTasks.push({ source: 'mangadex', task: withTimeoutOrNull(searchMangaDex(input.mangaId, input.missingChapters, preferredLanguage), t, 'mangadex-search') });
  if (isManga && enabled.has('suwayomi')) sourceTasks.push({ source: 'suwayomi', task: withTimeoutOrNull(searchSuwayomi(input.mangaId, input.missingChapters), t, 'suwayomi-search') });
  if (isComic && enabled.has('getcomics')) sourceTasks.push({ source: 'getcomics', task: withTimeoutOrNull(searchGetComics(input.mangaTitle), t, 'getcomics-search') });

  const activeSources = sourceTasks.map(s => s.source);
  void realtimeEmitter.emitSearchProgress({
    mangaId, mangaTitle: input.mangaTitle, phase: 'searching',
    sources: activeSources,
    message: activeSources.length > 0 ? `Searching ${activeSources.join(', ')}…` : 'No sources enabled',
  });

  const wrapped = sourceTasks.map(({ source, task }) => task
    .then((value: ReleaseCandidate[] | null): ReleaseCandidate[] => {
      const status: 'ok' | 'timeout' = value === null ? 'timeout' : 'ok';
      const count = value?.length ?? 0;
      void realtimeEmitter.emitSearchProgress({
        mangaId, mangaTitle: input.mangaTitle, phase: 'source-result',
        source, status, resultCount: count,
        message: status === 'timeout' ? `${source}: timeout` : `${source}: ${count} candidates`,
      });
      return value ?? [];
    })
    .catch((err: unknown): ReleaseCandidate[] => {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log.warn('Indexer adapter threw unexpectedly', { source, error: errorMessage });
      void realtimeEmitter.emitSearchProgress({
        mangaId, mangaTitle: input.mangaTitle, phase: 'source-result',
        source, status: 'error', resultCount: 0,
        message: `${source}: error`,
      });
      return [];
    })
  );

  const settled = await Promise.allSettled(wrapped);
  const bySource: Record<string, number> = {};
  const candidates: ReleaseCandidate[] = [];
  settled.forEach((s, i) => {
    const src = sourceTasks[i]?.source ?? 'unknown';
    const arr = s.status === 'fulfilled' ? s.value : [];
    bySource[src] = arr.length;
    candidates.push(...arr);
  });

  log.info('Indexer search complete', {
    mangaId,
    title: input.mangaTitle,
    totalCandidates: candidates.length,
    bySource,
  });

  return candidates;
}
