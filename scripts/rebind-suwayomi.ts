/**
 * @quality-check-skip
 *
 * Re-bind Suwayomi plugin pointers for one or every manga when Suwayomi's
 * local datastore has been wiped (container recreated without persistent
 * volume, breaking upgrade, manual reset). Kaizoku still holds the old
 * internal `Manga.suwayomiPluginConfig.mangaId` + `Chapter.suwayomiChapterId`
 * values, which point at nothing on the Suwayomi side, so every
 * `suwayomi_download` job fails with `No pages returned from Suwayomi`.
 *
 * Flow per manga:
 *   1. Read suwayomiPluginConfig.
 *   2. Probe Suwayomi for cfg.mangaId. Healthy = manga exists AND has ≥1
 *      chapter cached. Stale = lookup returns null.
 *   3. If stale (and --apply): NULL Chapter.suwayomiChapterId, then run the
 *      matcher (single-source if cfg.sourceId is set, otherwise across all
 *      installed sources), then sync chapter IDs.
 *
 * Dry-run by default — pass `--apply` to mutate.
 *
 * Usage:
 *   bun run scripts/rebind-suwayomi.ts <mangaId>
 *   bun run scripts/rebind-suwayomi.ts <mangaId> --apply
 *   bun run scripts/rebind-suwayomi.ts --all
 *   bun run scripts/rebind-suwayomi.ts --all --apply
 */
import { prisma } from '@/server/db';
import type { Prisma } from '@prisma/client';

import { getSuwayomiGraphQLClient } from '@/server/services/suwayomi/graphql/client';
import {
  matchMangaAcrossAllSuwayomiSources,
  matchMangaOnSuwayomi,
  readSuwayomiPluginConfig,
  type SuwayomiPluginConfig,
} from '@/server/services/suwayomi/manga-matcher';
import { syncSuwayomiChapters } from '@/server/services/suwayomi/chapter-sync';

interface BoundManga {
  id: number;
  title: string;
  suwayomiPluginConfig: unknown;
}

interface ProbeResult {
  status: 'ok' | 'stale' | 'no-binding' | 'unreachable';
  reason: string;
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const all = args.includes('--all');
const mangaIdArg = args.find((a) => /^\d+$/.test(a));

if (!mangaIdArg && !all) {
  process.stdout.write('Usage: rebind-suwayomi.ts <mangaId> [--apply]  |  --all [--apply]\n');
  process.exit(1);
}

async function loadTargets(): Promise<BoundManga[]> {
  if (mangaIdArg) {
    const m = await prisma.manga.findUnique({
      where: { id: parseInt(mangaIdArg, 10) },
      select: { id: true, title: true, suwayomiPluginConfig: true },
    });
    return m ? [m] : [];
  }
  return prisma.manga.findMany({
    where: { NOT: { suwayomiPluginConfig: { equals: Prisma.JsonNull } } },
    select: { id: true, title: true, suwayomiPluginConfig: true },
    orderBy: { id: 'asc' },
  });
}

async function probe(cfg: SuwayomiPluginConfig): Promise<ProbeResult> {
  if (typeof cfg.mangaId !== 'number') {
    return { status: 'no-binding', reason: 'No suwayomiPluginConfig.mangaId set' };
  }
  try {
    const client = getSuwayomiGraphQLClient();
    const m = await client.getManga(cfg.mangaId);
    if (m === null) return { status: 'stale', reason: `Suwayomi manga#${cfg.mangaId} not found` };
    const chs = await client.getChapters(cfg.mangaId);
    if (chs.length === 0) {
      return { status: 'stale', reason: `Suwayomi manga#${cfg.mangaId} exists but has 0 chapters` };
    }
    return { status: 'ok', reason: `${chs.length} chapters cached on Suwayomi` };
  } catch (err) {
    return { status: 'unreachable', reason: err instanceof Error ? err.message : String(err) };
  }
}

async function rebindOne(target: BoundManga, cfg: SuwayomiPluginConfig): Promise<void> {
  const cleared = await prisma.chapter.updateMany({
    where: { mangaId: target.id, NOT: { suwayomiChapterId: null } },
    data: { suwayomiChapterId: null },
  });
  process.stdout.write(`  cleared ${cleared.count} stale Chapter.suwayomiChapterId rows\n`);

  const stripped = { ...cfg };
  delete stripped.mangaId;
  delete stripped.slug;
  delete stripped.lastMatchedAt;
  delete stripped.matchConfidence;
  delete stripped.totalChapters;
  delete stripped.unmatchedChapters;
  delete stripped.lastSyncedAt;
  await prisma.manga.update({
    where: { id: target.id },
    data: { suwayomiPluginConfig: stripped as unknown as Prisma.InputJsonValue },
  });

  const matchResult = cfg.sourceId
    ? await matchMangaOnSuwayomi({ mangaId: target.id, sourceId: cfg.sourceId, persist: true })
    : await matchMangaAcrossAllSuwayomiSources(target.id);
  process.stdout.write(`  match: ${matchResult.matched ? '✓' : '✗'} ${matchResult.reason}\n`);
  if (!matchResult.matched) return;

  const sync = await syncSuwayomiChapters(target.id);
  process.stdout.write(
    `  sync: ${sync.matched}/${sync.suwayomiTotal} chapters bound (${sync.unmatched} unmatched, ${sync.suwayomiOnly} Suwayomi-only)\n`,
  );
}

async function main(): Promise<void> {
  const targets = await loadTargets();
  process.stdout.write(`=== ${apply ? 'APPLY' : 'DRY-RUN'}: ${targets.length} manga to scan ===\n\n`);

  const summary = { ok: 0, stale: 0, noBinding: 0, unreachable: 0, rebound: 0, failed: 0 };

  for (const t of targets) {
    const cfg = readSuwayomiPluginConfig(t.suwayomiPluginConfig);
    // eslint-disable-next-line no-await-in-loop -- intentional sequential probe to avoid hammering Suwayomi
    const result = await probe(cfg);
    process.stdout.write(`#${t.id} "${t.title}" → ${result.status}: ${result.reason}\n`);

    if (result.status === 'ok') { summary.ok++; continue; }
    if (result.status === 'no-binding') { summary.noBinding++; continue; }
    if (result.status === 'unreachable') { summary.unreachable++; continue; }

    summary.stale++;
    if (!apply) continue;
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential rebind to keep Suwayomi load steady
      await rebindOne(t, cfg);
      summary.rebound++;
    } catch (err) {
      summary.failed++;
      process.stdout.write(`  ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  process.stdout.write(
    `\nSummary: ok=${summary.ok} stale=${summary.stale} no-binding=${summary.noBinding} unreachable=${summary.unreachable}`,
  );
  if (apply) process.stdout.write(` rebound=${summary.rebound} failed=${summary.failed}`);
  process.stdout.write('\n');
  if (!apply && summary.stale > 0) {
    process.stdout.write('(dry-run — re-run with --apply to rebind the stale entries.)\n');
  }
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (err: unknown) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
