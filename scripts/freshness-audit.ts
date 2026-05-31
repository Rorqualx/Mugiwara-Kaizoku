/**
 * Periodic freshness audit CLI for Fandom + Wikipedia bindings.
 *
 * Wraps `runFandomFreshnessAudit` / `runWikipediaFreshnessAudit` so a cron
 * job (or the operator) can invoke them out-of-band. Each scanned binding
 * whose score has fallen below its provider threshold emits the same
 * `[BindingFreshness]` warn line as the in-pipeline checks for AL/MD/CV/MU/Kitsu.
 *
 * Usage:
 *   bun scripts/freshness-audit.ts                     # both providers
 *   bun scripts/freshness-audit.ts --provider=fandom
 *   bun scripts/freshness-audit.ts --provider=wikipedia
 *
 * Exit code 0 always (the audit reports via logs; non-zero would suggest
 * the audit itself failed, not that bindings are stale).
 */

import { prisma } from '@/server/db';
import {
  runFandomFreshnessAudit,
  runWikipediaFreshnessAudit,
  type FreshnessAuditSummary,
} from '@/server/services/metadata/binding-validators/wiki-freshness-audit';

type ProviderArg = 'fandom' | 'wikipedia' | 'both';

function parseProvider(): ProviderArg {
  const arg = process.argv.find((a) => a.startsWith('--provider='));
  if (!arg) return 'both';
  const value = arg.slice('--provider='.length);
  if (value === 'fandom' || value === 'wikipedia' || value === 'both') return value;
  process.stderr.write(`unknown --provider value: ${value}\n`);
  process.exit(2);
}

function printSummary(s: FreshnessAuditSummary): void {
  process.stdout.write(
    `[${s.provider.padEnd(9)}] scanned=${s.scanned} stale=${s.stale} fresh=${s.fresh} errors=${s.errors}\n`,
  );
}

async function main(): Promise<void> {
  const provider = parseProvider();
  const results: FreshnessAuditSummary[] = [];

  if (provider === 'fandom' || provider === 'both') {
    results.push(await runFandomFreshnessAudit());
  }
  if (provider === 'wikipedia' || provider === 'both') {
    results.push(await runWikipediaFreshnessAudit());
  }

  process.stdout.write('\n=== Freshness Audit Scorecard ===\n');
  for (const r of results) printSummary(r);

  await prisma.$disconnect();
  // db.ts spins up background cleanup intervals (presence, rate-limit) that
  // hold the event loop open after $disconnect. Force-exit so cron/operator
  // runs terminate as expected.
  process.exit(0);
}

void main();
