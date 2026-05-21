/**
 * Helper: maintain exactly N fastSample entries.
 *
 * Reads the latest verification report and:
 *   1. UNMARKS fastSample on entries that failed verification (excluded list)
 *   2. MARKS the next unique-by-title entries (skipping the excluded list)
 *      until fastSample count reaches the target
 *
 * This is a feedback loop: re-running it after each `verify-comicvine-corpus.ts
 * --write` round drops failed entries and tries fresh ones.
 *
 * Usage:
 *   bun scripts/comicvine/mark-fast-sample-100.ts            # dry-run
 *   bun scripts/comicvine/mark-fast-sample-100.ts --write    # apply
 */

import * as fs from 'fs';
import * as path from 'path';

import { COMICVINE_TEST_CORPUS } from './test-comicvine-corpus';

const TARGET_FAST_SAMPLE_COUNT = 100;
const CORPUS_PATH = path.resolve(process.cwd(), 'scripts/comicvine/test-comicvine-corpus.ts');
const VERIFY_REPORT_PATH = path.resolve(
  process.cwd(),
  'docs/research/comicvine-accuracy/corpus-verification-report.json',
);
/** Persistent cumulative blacklist of titles known to fail verification — never picked again */
const BLACKLIST_PATH = path.resolve(
  process.cwd(),
  'docs/research/comicvine-accuracy/corpus-blacklist.json',
);

/** Statuses considered "verified" — these entries should KEEP their fastSample mark */
const VERIFIED_STATUSES = new Set([
  'already-verified',
  'api-confirmed',
  'discovered-via-publisher',
]);

interface VerifyEntryRecord {
  title: string;
  status: string;
}

interface VerifyReport {
  entries?: VerifyEntryRecord[];
}

/**
 * Load the cumulative blacklist of titles that have failed verification at
 * least once. Grows across rounds so re-runs don't pick the same broken titles.
 */
function loadBlacklist(): Set<string> {
  if (!fs.existsSync(BLACKLIST_PATH)) return new Set<string>();
  try {
    const data = JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf-8')) as { titles?: string[] };
    return new Set((data.titles ?? []).map((t) => t.trim().toLowerCase()));
  } catch (err) {
    print(`  [WARN] Could not parse blacklist: ${String(err)}`);
    return new Set<string>();
  }
}

function saveBlacklist(blacklist: Set<string>): void {
  const sorted = [...blacklist].sort();
  fs.writeFileSync(
    BLACKLIST_PATH,
    JSON.stringify({ titles: sorted, updatedAt: new Date().toISOString() }, null, 2),
  );
}

/** Read the verification report file. Returns null if missing/unparseable. */
function readVerifyReport(): VerifyReport | null {
  if (!fs.existsSync(VERIFY_REPORT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(VERIFY_REPORT_PATH, 'utf-8')) as VerifyReport;
  } catch (err) {
    print(`  [WARN] Could not parse verification report: ${String(err)}`);
    return null;
  }
}

/** Add any failed entries from the report into the cumulative blacklist. */
function mergeFailedEntriesIntoBlacklist(report: VerifyReport, cumulative: Set<string>): number {
  let newCount = 0;
  for (const entry of report.entries ?? []) {
    if (VERIFIED_STATUSES.has(entry.status)) continue;
    const key = entry.title.trim().toLowerCase();
    if (cumulative.has(key)) continue;
    cumulative.add(key);
    newCount++;
  }
  return newCount;
}

/**
 * Merge the latest verification report's failures into the cumulative
 * blacklist and return the merged exclude set.
 */
function loadFailedTitlesFromReport(): Set<string> {
  const cumulative = loadBlacklist();
  const report = readVerifyReport();
  if (!report) return cumulative;
  const newCount = mergeFailedEntriesIntoBlacklist(report, cumulative);
  if (newCount > 0) {
    print(`  Added ${newCount} new failed titles to blacklist (cumulative size: ${cumulative.size})`);
  }
  saveBlacklist(cumulative);
  return cumulative;
}

const print = (msg: string): void => { process.stdout.write(msg + '\n'); };

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTitleRegex(title: string): RegExp {
  // Allow apostrophes to be backslash-escaped (corpus uses 'JoJo\'s ...')
  const escaped = escapeForRegex(title).replace(/'/g, "\\\\?'");
  return new RegExp(`title:\\s*['"\`]${escaped}['"\`]`, 'g');
}

interface ObjectLiteralBounds { openBrace: number; closeBrace: number }

function findObjectLiteralBounds(source: string, title: string): ObjectLiteralBounds | null {
  const titleMarker = buildTitleRegex(title);
  const match = titleMarker.exec(source);
  if (!match) return null;
  let openBrace = match.index;
  while (openBrace > 0 && source[openBrace] !== '{') openBrace--;
  let depth = 0;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return { openBrace, closeBrace: i };
  }
  return null;
}

function literalAlreadyHasFastSample(literal: string): boolean {
  return /fastSample\s*:\s*true/.test(literal);
}

function insertFastSample(literal: string): string {
  // Insert before the closing brace, copying the indentation of an existing field
  const fieldIndentMatch = literal.match(/\n([ \t]+)\w/);
  const fieldIndent = fieldIndentMatch?.[1] ?? '    ';
  const closeMatch = literal.match(/(\n[ \t]*)\}\s*$/);
  if (!closeMatch) return literal;
  const insertion = `\n${fieldIndent}fastSample: true,`;
  const insertionPoint = literal.length - closeMatch[0].length;
  return literal.slice(0, insertionPoint) + insertion + literal.slice(insertionPoint);
}

interface PickedTitle {
  title: string;
  alreadyFastSample: boolean;
}

function pickFirstUniqueTitles(targetCount: number, exclude: Set<string>): PickedTitle[] {
  const seen = new Set<string>();
  const picked: PickedTitle[] = [];
  for (const entry of COMICVINE_TEST_CORPUS) {
    const titleKey = entry.title.trim().toLowerCase();
    if (seen.has(titleKey)) continue;
    if (exclude.has(titleKey)) continue;
    seen.add(titleKey);
    picked.push({ title: entry.title.trim(), alreadyFastSample: entry.fastSample === true });
    if (picked.length >= targetCount) break;
  }
  return picked;
}

/** Remove `fastSample: true` from a literal so the entry stops being picked */
function removeFastSample(literal: string): string {
  return literal
    .replace(/\n[ \t]*fastSample\s*:\s*true,?/g, '')
    .replace(/fastSample\s*:\s*true,?\s*/g, '');
}

function applyFastSampleUnmarks(toUnmark: string[]): { unmarked: number; missing: string[] } {
  if (toUnmark.length === 0) return { unmarked: 0, missing: [] };
  let source = fs.readFileSync(CORPUS_PATH, 'utf-8');
  let unmarked = 0;
  const missing: string[] = [];
  for (const title of toUnmark) {
    const bounds = findObjectLiteralBounds(source, title);
    if (!bounds) { missing.push(title); continue; }
    const literal = source.slice(bounds.openBrace, bounds.closeBrace + 1);
    if (!/fastSample\s*:\s*true/.test(literal)) continue;
    const newLiteral = removeFastSample(literal);
    source = source.slice(0, bounds.openBrace) + newLiteral + source.slice(bounds.closeBrace + 1);
    unmarked++;
  }
  fs.writeFileSync(CORPUS_PATH, source);
  return { unmarked, missing };
}

function applyFastSampleMarks(toMark: string[]): { updated: number; skipped: number; missing: string[] } {
  let source = fs.readFileSync(CORPUS_PATH, 'utf-8');
  let updated = 0;
  let skipped = 0;
  const missing: string[] = [];

  for (const title of toMark) {
    const bounds = findObjectLiteralBounds(source, title);
    if (!bounds) { missing.push(title); skipped++; continue; }
    const literal = source.slice(bounds.openBrace, bounds.closeBrace + 1);
    if (literalAlreadyHasFastSample(literal)) { skipped++; continue; }
    const newLiteral = insertFastSample(literal);
    source = source.slice(0, bounds.openBrace) + newLiteral + source.slice(bounds.closeBrace + 1);
    updated++;
  }

  fs.writeFileSync(CORPUS_PATH, source);
  return { updated, skipped, missing };
}

function main(): void {
  const write = process.argv.includes('--write');

  // Step 1: load failed-from-verifier titles to exclude
  const failedTitles = loadFailedTitlesFromReport();
  print(`Loaded ${failedTitles.size} failed-verification titles to exclude`);

  // Step 2: identify currently-fastSample entries that are in the failed list — unmark them
  const toUnmark = COMICVINE_TEST_CORPUS
    .filter((e) => e.fastSample === true && failedTitles.has(e.title.trim().toLowerCase()))
    .map((e) => e.title.trim());
  print(`  ${toUnmark.length} currently-fastSample entries are in the failed list`);

  // Step 3: pick fresh entries up to target count, EXCLUDING the failed list
  const picked = pickFirstUniqueTitles(TARGET_FAST_SAMPLE_COUNT, failedTitles);
  const alreadyMarkedKeep = picked.filter((p) => p.alreadyFastSample);
  const toMark = picked.filter((p) => !p.alreadyFastSample);

  print(`Picked ${picked.length} unique non-failed titles from corpus`);
  print(`  Already fastSample (keep): ${alreadyMarkedKeep.length}`);
  print(`  Newly to mark: ${toMark.length}`);
  print(`  To unmark (failed): ${toUnmark.length}`);
  print('');
  print('New titles to mark (first 30):');
  toMark.slice(0, 30).forEach((p, i) => print(`  ${i + 1}. ${p.title}`));
  if (toMark.length > 30) print(`  ... and ${toMark.length - 30} more`);
  if (toUnmark.length > 0) {
    print('');
    print('Titles to unmark (failed verification):');
    toUnmark.forEach((t) => print(`  - ${t}`));
  }

  if (!write) {
    print('');
    print('Dry-run only. Re-run with --write to apply.');
    return;
  }

  print('');
  print('Applying...');
  const unmarkResult = applyFastSampleUnmarks(toUnmark);
  print(`  Unmarked: ${unmarkResult.unmarked} entries`);
  if (unmarkResult.missing.length > 0) {
    print(`  [WARN] ${unmarkResult.missing.length} could not be located for unmark`);
  }
  const { updated, skipped, missing } = applyFastSampleMarks(toMark.map((p) => p.title));
  print(`  Marked: ${updated} entries`);
  print(`  Skipped: ${skipped}`);
  if (missing.length > 0) {
    print('  Missing (could not locate in source):');
    missing.forEach((t) => print(`    - ${t}`));
  }
}

main();
