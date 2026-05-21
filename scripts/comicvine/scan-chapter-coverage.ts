/**
 * Chapter-Coverage Scanner
 *
 * Scans all `fastSample: true` corpus entries and checks whether their
 * ComicVine volume's API issue descriptions contain chapter markup
 * (`<h2>Chapter Titles</h2><ul><li>...</li></ul>`).
 *
 * Entries with NO chapter markup on any issue are added to the persistent
 * blacklist (`docs/research/comicvine-accuracy/corpus-blacklist.json`) so
 * the next `mark-fast-sample-100.ts` run will swap them out for entries
 * that DO have chapter coverage.
 *
 * This is the second half of the corpus-quality feedback loop:
 *   verify-comicvine-corpus.ts  →  validates the ComicVine ID is real
 *   scan-chapter-coverage.ts    →  validates the API has chapter data
 *   mark-fast-sample-100.ts     →  swaps failed entries for fresh ones
 *
 * Usage:
 *   bun scripts/comicvine/scan-chapter-coverage.ts            # dry-run
 *   bun scripts/comicvine/scan-chapter-coverage.ts --write    # update blacklist
 */

import * as fs from 'fs';
import * as path from 'path';

import { COMICVINE_TEST_CORPUS, type ComicVineTestManga } from './test-comicvine-corpus';

const print = (msg: string): void => { process.stdout.write(msg + '\n'); };

const BLACKLIST_PATH = path.resolve(
  process.cwd(),
  'docs/research/comicvine-accuracy/corpus-blacklist.json',
);

interface BlacklistFile {
  titles: string[];
  updatedAt?: string;
  note?: string;
}

function loadBlacklist(): { titles: Set<string>; raw: BlacklistFile } {
  const empty: BlacklistFile = { titles: [] };
  if (!fs.existsSync(BLACKLIST_PATH)) {
    return { titles: new Set(), raw: empty };
  }
  try {
    const data = JSON.parse(fs.readFileSync(BLACKLIST_PATH, 'utf-8')) as BlacklistFile;
    return { titles: new Set(data.titles ?? []), raw: data };
  } catch (err) {
    print(`  [WARN] Could not parse blacklist: ${String(err)}`);
    return { titles: new Set(), raw: empty };
  }
}

function saveBlacklist(blacklist: Set<string>, existing: BlacklistFile): void {
  const sorted = [...blacklist].sort();
  const merged: BlacklistFile = {
    titles: sorted,
    updatedAt: new Date().toISOString(),
  };
  if (existing.note) merged.note = existing.note;
  fs.writeFileSync(BLACKLIST_PATH, JSON.stringify(merged, null, 2));
}

function extractIdFromUrl(url: string | undefined | null): number | null {
  if (!url) return null;
  const match = url.match(/4050-(\d+)/);
  if (!match?.[1]) return null;
  const id = parseInt(match[1], 10);
  return Number.isNaN(id) ? null : id;
}

interface ScanResult {
  title: string;
  volumeId: number | null;
  issueCount: number;
  issuesWithChapterMarkup: number;
  hasChapterData: boolean;
  error?: string;
}

async function scanEntry(manga: ComicVineTestManga): Promise<ScanResult> {
  const volumeId = extractIdFromUrl(manga.comicvineUrl);
  const result: ScanResult = {
    title: manga.title,
    volumeId,
    issueCount: 0,
    issuesWithChapterMarkup: 0,
    hasChapterData: false,
  };
  if (volumeId === null) {
    result.error = 'no comicvineUrl';
    return result;
  }
  try {
    const { comicvineService } = await import('@/server/services/comicvine/service');
    const issues = await comicvineService.getAllVolumeIssues(volumeId);
    result.issueCount = issues.length;
    for (const issue of issues) {
      const desc = issue.description ?? '';
      // Match the same patterns the runtime parser looks for
      if (desc.includes('Chapter Titles') || desc.includes('<h2>Chapters</h2>')) {
        result.issuesWithChapterMarkup++;
      }
    }
    result.hasChapterData = result.issuesWithChapterMarkup > 0;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  print('Chapter-Coverage Scanner');
  print('=========================');
  print(`Mode: ${write ? 'WRITE' : 'dry-run'}`);
  print('');

  const fastSample = COMICVINE_TEST_CORPUS.filter((e) => e.fastSample === true);
  print(`Scanning ${fastSample.length} fastSample entries...\n`);

  const results: ScanResult[] = [];
  for (let i = 0; i < fastSample.length; i++) {
    const manga = fastSample[i];
    if (!manga) continue;
    process.stdout.write(`[${i + 1}/${fastSample.length}] ${manga.title}: `);
    // eslint-disable-next-line no-await-in-loop -- sequential for ComicVine rate limit
    const r = await scanEntry(manga);
    results.push(r);
    if (r.error) {
      process.stdout.write(`ERROR (${r.error})\n`);
    } else {
      const flag = r.hasChapterData ? '✓' : '✗';
      process.stdout.write(`${flag} ${r.issuesWithChapterMarkup}/${r.issueCount} issues with markup\n`);
    }
  }

  const noChapterData = results.filter((r) => !r.hasChapterData && !r.error);
  const errored = results.filter((r) => r.error);
  const haveData = results.filter((r) => r.hasChapterData);

  print('');
  print('===== Scan Summary =====');
  print(`  Total scanned:               ${results.length}`);
  print(`  Have chapter data:           ${haveData.length}`);
  print(`  No chapter data (blacklist): ${noChapterData.length}`);
  print(`  Errored:                     ${errored.length}`);
  print('');

  if (noChapterData.length > 0) {
    print('Titles with NO chapter data (will be blacklisted):');
    for (const r of noChapterData) {
      print(`  - ${r.title} (vol ${r.volumeId}, ${r.issueCount} issues)`);
    }
    print('');
  }

  if (!write) {
    print('Dry-run only. Re-run with --write to update the blacklist.');
    return;
  }

  // Merge no-chapter-data titles into the blacklist
  const { titles: blacklist, raw } = loadBlacklist();
  let added = 0;
  for (const r of noChapterData) {
    const key = r.title.trim().toLowerCase();
    if (!blacklist.has(key)) {
      blacklist.add(key);
      added++;
    }
  }
  if (added > 0) {
    saveBlacklist(blacklist, raw);
    print(`Blacklist updated: +${added} (total: ${blacklist.size})`);
    print('');
    print('Re-run mark-fast-sample-100.ts --write to swap out the blacklisted titles.');
  } else {
    print('No new entries to blacklist.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => { console.error('Fatal:', err); process.exit(1); });
