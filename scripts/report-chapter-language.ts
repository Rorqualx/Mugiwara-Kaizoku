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
 * Archives on disk are only removed with the explicit `--delete-files` flag,
 * which implies `--reset` and is IRREVERSIBLE. Without it the row keeps
 * pointing at the existing file, so a failed re-download leaves the reader no
 * worse off. `--clear-paths` nulls `filePath` without touching disk (leaves
 * orphans — prefer `--delete-files`).
 *
 * Deliberately hermetic (own PrismaClient, no `@/server/db`) — see the header of
 * backfill-chapter-language.ts for why.
 *
 * Usage:
 *   bun run scripts/report-chapter-language.ts
 *   bun run scripts/report-chapter-language.ts --manga 105
 *   bun run scripts/report-chapter-language.ts --reset --apply
 *   bun run scripts/report-chapter-language.ts --reset --delete-files --apply
 */
import { unlink } from 'fs/promises';

import { isPreferredLanguage } from '@/server/services/mangadex/language-match';

import { createStandalonePrisma } from './lib/standalone-prisma';

const prisma = createStandalonePrisma();

const APPLY = process.argv.includes('--apply');
const DELETE_FILES = process.argv.includes('--delete-files');
/** --delete-files implies --reset: a deleted archive must not stay COMPLETED. */
const RESET = process.argv.includes('--reset') || DELETE_FILES;
/** Deleting the file already clears the path; keep them from fighting. */
const CLEAR_PATHS = process.argv.includes('--clear-paths') || DELETE_FILES;
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
  filePath: string | null;
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
      filePath: true,
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

interface DeleteOutcome {
  deleted: number;
  missing: number;
  failed: number;
  bytesFreed: number;
}

/**
 * Unlink the archives for the given rows. IRREVERSIBLE.
 *
 * An already-absent file counts as `missing`, not a failure — the DB row is
 * still stale and must be requeued either way. A row whose `filePath` is null
 * has nothing to delete. Failures are logged individually and do NOT abort the
 * run, but they are counted so the caller can see the archive outlived the row.
 */
async function deleteArchives(rows: readonly AuditRow[]): Promise<DeleteOutcome> {
  const out: DeleteOutcome = { deleted: 0, missing: 0, failed: 0, bytesFreed: 0 };
  for (const r of rows) {
    if (r.filePath === null || r.filePath.length === 0) {
      out.missing++;
      continue;
    }
    try {
      // stat before unlink so we can report reclaimed space; a failure here
      // just means we lose the byte count, not the deletion.
      const { stat } = await import('fs/promises');
      // eslint-disable-next-line no-await-in-loop -- sequential; bounded by wrong-language count
      const size = await stat(r.filePath).then(s => s.size).catch(() => 0);
      // eslint-disable-next-line no-await-in-loop -- sequential unlink
      await unlink(r.filePath);
      out.deleted++;
      out.bytesFreed += size;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'ENOENT') {
        out.missing++;
        continue;
      }
      out.failed++;
      log('WARNING: could not delete archive', {
        chapterId: r.id,
        filePath: r.filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return out;
}

/**
 * Mark the wrong-language chapters PENDING and drop their MangaDex binding so
 * the dispatcher re-resolves them. `filePath` is preserved unless --clear-paths
 * or --delete-files was passed.
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

  const wrongRows = ordered.flatMap(([, b]) => b.wrong);
  const onDisk = wrongRows.filter(r => r.filePath !== null && r.filePath.length > 0).length;

  if (!APPLY) {
    log('DRY RUN — nothing written; re-run with --apply', {
      wouldReset: totalWrong,
      wouldDeleteFiles: DELETE_FILES ? onDisk : 0,
      wouldClearPaths: CLEAR_PATHS,
    });
    if (DELETE_FILES) {
      for (const r of wrongRows.slice(0, 5)) {
        log('  would delete', { chapterId: r.id, language: r.language, filePath: r.filePath });
      }
      if (wrongRows.length > 5) log(`  … and ${wrongRows.length - 5} more`);
    }
    return;
  }

  // Delete first, then requeue. If deletion partially fails the rows are still
  // marked COMPLETED, so a re-run re-attempts the same set rather than leaving
  // PENDING rows pointing at archives that were never removed.
  let deletion: DeleteOutcome | null = null;
  if (DELETE_FILES) {
    deletion = await deleteArchives(wrongRows);
    log('archive deletion complete', {
      ...deletion,
      gibFreed: (deletion.bytesFreed / 1024 ** 3).toFixed(2),
    });
  }

  const count = await resetChapters(wrongRows.map(r => r.id));
  log('reset complete — chapters requeued for re-dispatch', {
    reset: count,
    deletedFiles: deletion?.deleted ?? 0,
    clearedPaths: CLEAR_PATHS,
    ...(deletion === null ? { note: 'archives on disk were NOT deleted' } : {}),
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
