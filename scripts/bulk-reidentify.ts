/**
 * Bulk reidentify: clear auto-bindings + re-run enrichment for every manga
 * in the library at bounded concurrency.
 *
 * - Walks every Manga row.
 * - For each: `clearAutoBindingsForReidentify` (wipes
 *   providerMetadata.{provider}.providerId for non-pinned bindings) then
 *   `runEnrichmentPipeline` from scratch so the title-matcher decides
 *   each binding fresh.
 * - Concurrency capped at CONCURRENCY (default 3) to spare upstream APIs.
 * - Per-manga 5min hard timeout — if the pipeline hangs (or wedges on a
 *   provider that ignores its 60s per-call cap), we move on.
 * - Checkpoint file under `.reidentify-checkpoint.json` records completed
 *   IDs, so re-running picks up where it left off.
 * - Manual pins from v2-E (provenance entries marked manual:true) survive
 *   reidentify — clearAutoBindingsForReidentify respects the manual
 *   sentinel + the persister's applyManualPinGuards refuses to overwrite.
 *
 * Run: bun scripts/bulk-reidentify.ts [--concurrency=3] [--reset]
 */

import { promises as fs } from 'fs';
import * as path from 'path';

import { prisma } from '@/server/db';
import { runEnrichmentPipeline } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline';
import { clearAutoBindingsForReidentify } from '@/server/trpc/routers/manga/metadataOperations/refresh/clear-auto-bindings';

const CHECKPOINT_PATH = path.resolve(process.cwd(), '.reidentify-checkpoint.json');
const PER_MANGA_TIMEOUT_MS = 5 * 60 * 1000;

interface Checkpoint {
  startedAt: string;
  completedIds: number[];
  failedIds: Array<{ id: number; error: string }>;
}

function parseConcurrency(): number {
  const arg = process.argv.find((a) => a.startsWith('--concurrency='));
  if (!arg) return 3;
  const n = parseInt(arg.slice('--concurrency='.length), 10);
  if (!Number.isFinite(n) || n < 1 || n > 10) {
    process.stderr.write(`invalid --concurrency (must be 1-10), got: ${arg}\n`);
    process.exit(2);
  }
  return n;
}

function shouldReset(): boolean {
  return process.argv.includes('--reset');
}

async function loadCheckpoint(): Promise<Checkpoint> {
  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, 'utf-8');
    return JSON.parse(raw) as Checkpoint;
  } catch {
    return { startedAt: new Date().toISOString(), completedIds: [], failedIds: [] };
  }
}

async function saveCheckpoint(cp: Checkpoint): Promise<void> {
  await fs.writeFile(CHECKPOINT_PATH, JSON.stringify(cp, null, 2));
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms),
    ),
  ]);
}

async function reidentifyOne(id: number, title: string): Promise<void> {
  const cleared = await clearAutoBindingsForReidentify(prisma, id);
  if (cleared.providersCleared.length > 0) {
    process.stdout.write(
      `  cleared [${cleared.providersCleared.join(',')}] (preserved: [${cleared.providersPreserved.join(',') || 'none'}])\n`,
    );
  }
  await runEnrichmentPipeline(id, title, async () => {});
}

async function runLimited<T>(items: readonly T[], limit: number, fn: (item: T, idx: number) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const cursor = { value: 0 };
  const worker = async (): Promise<void> => {
    for (let idx = cursor.value++; idx < items.length; idx = cursor.value++) {
      const item = items[idx];
      if (item === undefined) continue;
      // eslint-disable-next-line no-await-in-loop -- worker drains a shared cursor
      await fn(item, idx);
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

async function main(): Promise<void> {
  const concurrency = parseConcurrency();
  if (shouldReset()) {
    try { await fs.unlink(CHECKPOINT_PATH); } catch { /* no checkpoint to clear */ }
    process.stdout.write('Checkpoint reset.\n');
  }

  const all = await prisma.manga.findMany({
    select: { id: true, title: true },
    orderBy: { id: 'asc' },
  });

  const checkpoint = await loadCheckpoint();
  const doneSet = new Set(checkpoint.completedIds);
  const pending = all.filter((m) => !doneSet.has(m.id));

  process.stdout.write(`\n=== Bulk Reidentify ===\n`);
  process.stdout.write(`Library: ${all.length} manga | already done: ${doneSet.size} | pending: ${pending.length} | concurrency: ${concurrency}\n\n`);

  if (pending.length === 0) {
    process.stdout.write('Nothing to do. Use --reset to clear the checkpoint and start over.\n');
    process.exit(0);
  }

  const startedWall = process.hrtime.bigint();
  let successesThisRun = 0;
  let failuresThisRun = 0;
  const total = pending.length;

  await runLimited(pending, concurrency, async (m, idx) => {
    const n = idx + 1;
    const tag = `[${n}/${total}] manga ${m.id} "${m.title}"`;
    const t0 = process.hrtime.bigint();
    try {
      await withTimeout(reidentifyOne(m.id, m.title), PER_MANGA_TIMEOUT_MS, `manga ${m.id}`);
      const dt = Number(process.hrtime.bigint() - t0) / 1e9;
      successesThisRun++;
      process.stdout.write(`OK  ${tag} (${dt.toFixed(1)}s)\n`);
      checkpoint.completedIds.push(m.id);
      // Save every 5 so a crash doesn't lose much progress, but not so often it slows the loop.
      if (checkpoint.completedIds.length % 5 === 0) await saveCheckpoint(checkpoint);
    } catch (err) {
      failuresThisRun++;
      const reason = err instanceof Error ? err.message : String(err);
      process.stdout.write(`FAIL ${tag}: ${reason}\n`);
      checkpoint.failedIds.push({ id: m.id, error: reason });
      await saveCheckpoint(checkpoint);
    }
  });

  await saveCheckpoint(checkpoint);
  const totalDt = Number(process.hrtime.bigint() - startedWall) / 1e9;

  process.stdout.write(`\n=== Done ===\n`);
  process.stdout.write(`This run: ${successesThisRun} OK, ${failuresThisRun} failed.\n`);
  process.stdout.write(`Cumulative: ${checkpoint.completedIds.length}/${all.length} completed.\n`);
  process.stdout.write(`Wall: ${(totalDt / 60).toFixed(1)} min.\n`);
  process.stdout.write(`Checkpoint: ${CHECKPOINT_PATH}\n`);

  await prisma.$disconnect();
  process.exit(0);
}

void main();
