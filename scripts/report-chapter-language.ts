/**
 * @quality-check-skip
 *
 * Audit — and optionally requeue — chapters downloaded in the wrong language.
 *
 * Context: the MangaDex release adapter used to treat `mangadex.preferredLanguage`
 * as a soft preference. When MangaDex had no upload in the preferred language
 * (common for licensed series, where the publisher issues English takedowns but
 * other languages survive) it silently downloaded whatever translation existed.
 * The adapter is now strict by default, but chapters already on disk are not
 * retroactively fixed by that change.
 *
 * Run `backfill-chapter-language.ts --apply` FIRST — this script reports on
 * `Chapter.language`, which is null on every row bound before the fix.
 *
 * Report mode (default) prints a per-manga breakdown of completed chapters whose
 * language doesn't match the preferred one. Nothing is written.
 *
 * Remediation (`--reset --apply`) marks those chapters PENDING and clears
 * `mangadexId` / `language` so the next dispatch re-resolves them from a source
 * that can supply the preferred language.
 *
 * Files on disk are NEVER deleted. `filePath` is cleared only with the explicit
 * `--clear-paths` flag; without it the row keeps pointing at the existing file,
 * so a failed re-download leaves the reader no worse off. Removing the actual
 * archives is left to the caller — this script will not delete user data.
 *
 * Deliberately hermetic (own PrismaClient, no `@/server/db`) — see the header of
 * backfill-chapter-language.ts for why.
 *
 * Usage:
 *   bun run scripts/report-chapter-language.ts
 *   bun run scripts/report-chapter-language.ts --manga 105
 *   bun run scripts/report-chapter-language.ts --reset --apply
 *   bun run scripts/report-chapter-language.ts --reset --apply --clear-paths --manga 105
 */
import { isPreferredLanguage } from '@/server/services/mangadex/language-match';

import { createStandalonePrisma } from './lib/standalone-prisma';

const prisma = createStandalonePrisma();

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');
const CLEAR_PATHS = process.argv.includes('--clear-paths');
const MANGA_ARG_INDEX = process.argv.indexOf('--manga');
const MANGA_ID =
  MANGA_ARG_INDEX >= 0 ? Number.parseInt(process.argv[MANGA_ARG_INDEX + 1] ?? '', 10) : null;

/** Mirrors DEFAULT_MANGADEX_CONFIG.preferredLanguage. */
const DEFAULT_PREFERRED_LANGUAGE = 'en';
const PREFERRED_LANGUAGE_KEY = 'mangadex.preferredLanguage';

interface AuditRow {
  id: number;
  mangaId: number;
  chapterNumber: number | null;
  language: string | null;
  Manga: { title: string };
}

interface MangaBucket {
  title: string;
  wrong: AuditRow[];
  byLanguage: Map<string, number>;
}

function log(message: string, data?: Record<string, unknown>): void {
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  process.stdout.write(`[report-chapter-language] ${message}${suffix}\n`);
}

/**
 * Read `mangadex.preferredLanguage` straight from Config. Deliberately not via
 * mangadexConfigService — that module pulls in `@/server/db` and its realtime
 * side effects. Per-user overrides are ignored on purpose: this is a
 * library-wide audit, not a per-user view.
 */
async function loadPreferredLanguage(): Promise<string> {
  const row = await prisma.config.findFirst({
    where: { key: PREFERRED_LANGUAGE_KEY },
    select: { value: true },
  });
  const value = row?.value?.trim();
  return value && value.length > 0 ? value : DEFAULT_PREFERRED_LANGUAGE;
}

async function loadCompletedBoundChapters(): Promise<AuditRow[]> {
  return prisma.chapter.findMany({
    where: {
      mangadexId: { not: null },
      downloadStatus: 'COMPLETED',
      ...(MANGA_ID !== null && Number.isFinite(MANGA_ID) ? { mangaId: MANGA_ID } : {}),
    },
    select: {
      id: true,
      mangaId: true,
      chapterNumber: true,
      language: true,
      Manga: { select: { title: true } },
    },
  });
}

function bucketWrongLanguage(
  rows: readonly AuditRow[],
  preferred: string,
): { buckets: Map<number, MangaBucket>; unknownCount: number } {
  const buckets = new Map<number, MangaBucket>();
  let unknownCount = 0;
  for (const r of rows) {
    if (r.language === null) {
      unknownCount++;
      continue;
    }
    if (isPreferredLanguage(r.language, preferred)) continue;
    let bucket = buckets.get(r.mangaId);
    if (!bucket) {
      bucket = { title: r.Manga.title, wrong: [], byLanguage: new Map() };
      buckets.set(r.mangaId, bucket);
    }
    bucket.wrong.push(r);
    bucket.byLanguage.set(r.language, (bucket.byLanguage.get(r.language) ?? 0) + 1);
  }
  return { buckets, unknownCount };
}

function formatLanguages(byLanguage: ReadonlyMap<string, number>): string {
  return [...byLanguage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang, n]) => `${lang}=${n}`)
    .join(' ');
}

/**
 * Mark the wrong-language chapters PENDING and drop their MangaDex binding so
 * the dispatcher re-resolves them. `filePath` is preserved unless --clear-paths
 * was passed; the archive on disk is never touched either way.
 */
async function resetChapters(ids: readonly number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const result = await prisma.chapter.updateMany({
    where: { id: { in: [...ids] } },
    data: {
      downloadStatus: 'PENDING',
      mangadexId: null,
      language: null,
      ...(CLEAR_PATHS ? { filePath: null } : {}),
    },
  });
  return result.count;
}

async function main(): Promise<void> {
  const preferred = await loadPreferredLanguage();
  const rows = await loadCompletedBoundChapters();
  const { buckets, unknownCount } = bucketWrongLanguage(rows, preferred);
  const totalWrong = [...buckets.values()].reduce((n, b) => n + b.wrong.length, 0);

  log('summary', {
    preferredLanguage: preferred,
    scope: MANGA_ID ?? 'all',
    completedMangaDexChapters: rows.length,
    wrongLanguage: totalWrong,
    unknownLanguage: unknownCount,
    affectedSeries: buckets.size,
  });

  if (unknownCount > 0) {
    log('WARNING: rows with a null language were skipped — run backfill-chapter-language.ts --apply first', {
      unknownCount,
    });
  }

  const ordered = [...buckets.entries()].sort((a, b) => b[1].wrong.length - a[1].wrong.length);
  for (const [mangaId, bucket] of ordered) {
    log('affected series', {
      mangaId,
      title: bucket.title,
      wrongCount: bucket.wrong.length,
      languages: formatLanguages(bucket.byLanguage),
    });
  }

  if (!RESET) {
    log('report only — pass --reset --apply to requeue these chapters');
    return;
  }
  if (!APPLY) {
    log('DRY RUN — --reset given without --apply; nothing written', {
      wouldReset: totalWrong,
      wouldClearPaths: CLEAR_PATHS,
    });
    return;
  }

  const ids = ordered.flatMap(([, b]) => b.wrong.map(r => r.id));
  const count = await resetChapters(ids);
  log('reset complete — chapters requeued for re-dispatch', {
    reset: count,
    clearedPaths: CLEAR_PATHS,
    note: 'archives on disk were NOT deleted',
  });
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
