/**
 * @quality-check-skip
 *
 * Backfill `Chapter.language` from MangaDex for rows that already carry a
 * `Chapter.mangadexId`.
 *
 * Why this exists: the MangaDex release adapter used to persist the resolved
 * chapter UUID *without* its `translatedLanguage`. The release dispatcher's
 * Phase 2b gate (`computeExcludedSources` in releaseDispatcher/dispatch.ts) is
 * fail-open on a null language, so every such row was unguarded — and because
 * the adapter also accepted "any language" when the preferred one was missing,
 * libraries filled up with es-la / ca / vi chapters.
 *
 * The adapter now writes `language` on every new binding. This script fills in
 * the historical rows so the gate becomes exact for them too, and so
 * `report-chapter-language.ts` can report on the damage.
 *
 * Deliberately hermetic: it opens its own PrismaClient and talks to the
 * MangaDex REST API over plain `fetch` rather than importing `@/server/db` or
 * the shared client factory. Those pull in the realtime emitter, which starts
 * WebSocket/presence/rate-limit timers — the process then never exits, and the
 * shared connection pool contends with the cleanup intervals.
 *
 * Strategy: group rows by manga and walk each series' chapter feed once (all
 * languages, paginated) into a uuid → translatedLanguage map. Rows whose manga
 * has no MangaDex binding, or whose UUID is absent from the feed, fall back to
 * a capped number of per-chapter lookups.
 *
 * Idempotent: only touches rows where `language IS NULL`. Safe to re-run; a
 * UUID MangaDex no longer resolves is recorded as `unknown` so it isn't
 * retried forever.
 *
 * Dry-run by default — pass `--apply` to write.
 *
 * Usage:
 *   bun run scripts/backfill-chapter-language.ts
 *   bun run scripts/backfill-chapter-language.ts --apply
 *   bun run scripts/backfill-chapter-language.ts --apply --manga 105
 */
import { createStandalonePrisma } from './lib/standalone-prisma';

const prisma = createStandalonePrisma();

const APPLY = process.argv.includes('--apply');
const MANGA_ARG_INDEX = process.argv.indexOf('--manga');
const MANGA_ID =
  MANGA_ARG_INDEX >= 0 ? Number.parseInt(process.argv[MANGA_ARG_INDEX + 1] ?? '', 10) : null;

const API_BASE = 'https://api.mangadex.org';
const USER_AGENT = 'MugiwaraKaizoku/1.0 (https://github.com/Rorqualx/Mugiwara-Kaizoku)';
const PAGE_LIMIT = 100;
const MAX_PAGES = 80;
/** MangaDex allows ~5 req/s; stay well inside it. */
const PAUSE_MS = 250;
/** Sentinel for UUIDs MangaDex no longer resolves (deleted/merged uploads). */
const UNKNOWN_LANGUAGE = 'unknown';
/** Cap per-chapter fallback lookups so a badly-bound series can't run for hours. */
const MAX_SINGLE_LOOKUPS = 300;

interface ChapterRow {
  id: number;
  mangaId: number;
  mangadexId: string;
}

interface FeedEntry {
  id: string;
  attributes?: { translatedLanguage?: string | null };
}

function log(message: string, data?: Record<string, unknown>): void {
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  process.stdout.write(`[backfill-chapter-language] ${message}${suffix}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getJson(url: string): Promise<unknown> {
  const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.json();
}

async function loadCandidateRows(): Promise<ChapterRow[]> {
  const rows = await prisma.chapter.findMany({
    where: {
      mangadexId: { not: null },
      language: null,
      ...(MANGA_ID !== null && Number.isFinite(MANGA_ID) ? { mangaId: MANGA_ID } : {}),
    },
    select: { id: true, mangaId: true, mangadexId: true },
  });
  return rows.filter((r): r is ChapterRow => typeof r.mangadexId === 'string');
}

/** Read a manga's bound MangaDex series UUID, or null when unbound. */
async function loadSeriesId(mangaId: number): Promise<string | null> {
  const m = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  const pm = m?.providerMetadata as { mangadex?: { providerId?: unknown } } | null;
  const id = pm?.mangadex?.providerId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Walk a series' chapter feed (all languages) into a uuid → language map. */
async function buildSeriesLanguageMap(seriesId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `${API_BASE}/manga/${seriesId}/feed?limit=${PAGE_LIMIT}&offset=${offset}` +
      `&order%5Bchapter%5D=asc`;
    // eslint-disable-next-line no-await-in-loop -- pagination is inherently sequential
    const json = (await getJson(url)) as { data?: FeedEntry[]; total?: number };
    const batch = Array.isArray(json.data) ? json.data : [];
    for (const ch of batch) {
      const lang = ch.attributes?.translatedLanguage;
      if (typeof lang === 'string' && lang.length > 0) out.set(ch.id, lang);
    }
    const total = json.total ?? 0;
    if (batch.length < PAGE_LIMIT || offset + batch.length >= total) break;
    offset += PAGE_LIMIT;
    // eslint-disable-next-line no-await-in-loop -- deliberate pacing
    await sleep(PAUSE_MS);
  }
  return out;
}

/** Last-resort single-chapter lookup for UUIDs missing from the series feed. */
async function lookupSingleLanguage(uuid: string): Promise<string | null> {
  try {
    const json = (await getJson(`${API_BASE}/chapter/${uuid}`)) as {
      data?: { attributes?: { translatedLanguage?: string | null } };
    };
    const lang = json.data?.attributes?.translatedLanguage;
    return typeof lang === 'string' && lang.length > 0 ? lang : null;
  } catch {
    return null;
  }
}

function groupByManga(rows: readonly ChapterRow[]): Map<number, ChapterRow[]> {
  const out = new Map<number, ChapterRow[]>();
  for (const r of rows) {
    const bucket = out.get(r.mangaId);
    if (bucket) bucket.push(r);
    else out.set(r.mangaId, [r]);
  }
  return out;
}

interface Totals {
  resolved: number;
  unresolved: number;
  singleLookups: number;
  byLanguage: Map<string, number>;
}

/** Resolve one manga's rows to {chapterRowId, language} updates. */
async function resolveMangaRows(
  mangaId: number,
  rows: readonly ChapterRow[],
  totals: Totals,
): Promise<Array<{ id: number; language: string }>> {
  const seriesId = await loadSeriesId(mangaId);
  const feedMap = seriesId ? await buildSeriesLanguageMap(seriesId) : new Map<string, string>();

  const updates: Array<{ id: number; language: string }> = [];
  for (const r of rows) {
    let language = feedMap.get(r.mangadexId) ?? null;
    if (language === null && totals.singleLookups < MAX_SINGLE_LOOKUPS) {
      totals.singleLookups++;
      // eslint-disable-next-line no-await-in-loop -- rate-limited fallback path
      language = await lookupSingleLanguage(r.mangadexId);
      // eslint-disable-next-line no-await-in-loop -- deliberate pacing
      await sleep(PAUSE_MS);
    }
    const finalLanguage = language ?? UNKNOWN_LANGUAGE;
    if (finalLanguage === UNKNOWN_LANGUAGE) totals.unresolved++;
    else totals.resolved++;
    totals.byLanguage.set(finalLanguage, (totals.byLanguage.get(finalLanguage) ?? 0) + 1);
    updates.push({ id: r.id, language: finalLanguage });
  }
  return updates;
}

async function applyUpdates(updates: Array<{ id: number; language: string }>): Promise<void> {
  if (updates.length === 0) return;
  await prisma.$transaction(
    updates.map(({ id, language }) =>
      prisma.chapter.update({ where: { id }, data: { language } }),
    ),
  );
}

async function main(): Promise<void> {
  const rows = await loadCandidateRows();
  const grouped = groupByManga(rows);
  log('starting', {
    apply: APPLY,
    mangaId: MANGA_ID ?? 'all',
    rowsNeedingLanguage: rows.length,
    mangaCount: grouped.size,
  });
  if (rows.length === 0) {
    log('nothing to backfill');
    return;
  }

  const totals: Totals = { resolved: 0, unresolved: 0, singleLookups: 0, byLanguage: new Map() };

  for (const [mangaId, mangaRows] of grouped) {
    let updates: Array<{ id: number; language: string }> = [];
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential to respect the API rate limit
      updates = await resolveMangaRows(mangaId, mangaRows, totals);
    } catch (err: unknown) {
      log('manga resolution failed; leaving its rows for a later run', {
        mangaId,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }
    if (APPLY) {
      // eslint-disable-next-line no-await-in-loop -- sequential to bound transaction size
      await applyUpdates(updates);
    }
    log('manga processed', {
      mangaId,
      rows: mangaRows.length,
      resolved: totals.resolved,
      unresolved: totals.unresolved,
      applied: APPLY,
    });
  }

  const sorted = [...totals.byLanguage.entries()].sort((a, b) => b[1] - a[1]);
  log('complete', {
    apply: APPLY,
    total: rows.length,
    resolved: totals.resolved,
    unresolved: totals.unresolved,
    singleLookups: totals.singleLookups,
    distribution: Object.fromEntries(sorted),
  });
  if (!APPLY) log('DRY RUN — no rows written. Re-run with --apply to persist.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err: unknown) => {
    log('failed', { error: err instanceof Error ? err.message : String(err) });
    await prisma.$disconnect();
    process.exit(1);
  });
