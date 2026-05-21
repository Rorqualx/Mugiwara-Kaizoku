/**
 * Smoke test: applyPerVolumeRenumbering against research fixtures.
 *
 * Loads the Wikipedia chapter JSON for 20th Century Boys (249 entries, per-volume
 * numbering) and verifies the renumbering helper produces contiguous global
 * numbers 1..N with titles preserved. Also sanity-checks Berserk fixture.
 *
 * Usage: bun run scripts/tests/smoke-per-volume-renumber.ts
 *
 * @quality-check-skip
 */

import * as fs from 'fs';
import * as path from 'path';

import type { WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';

const print = (msg: string): void => { process.stdout.write(msg + '\n'); };

// Copy of helper under test — isolated to avoid importing the whole extractor chain.
function applyPerVolumeRenumbering(chapters: WikipediaChapter[]): boolean {
  if (chapters.length === 0) return false;
  const uniqueNumbers = new Set(chapters.map(c => c.number));
  const hasVolumes = chapters.some(c => c.volumeNumber !== undefined);
  if (chapters.length <= uniqueNumbers.size * 2 || !hasVolumes) return false;

  const sorted = [...chapters].sort((a, b) => {
    const va = a.volumeNumber ?? 0;
    const vb = b.volumeNumber ?? 0;
    if (va !== vb) return va - vb;
    const na = typeof a.number === 'number' ? a.number : parseFloat(String(a.number));
    const nb = typeof b.number === 'number' ? b.number : parseFloat(String(b.number));
    return na - nb;
  });
  for (let i = 0; i < sorted.length; i++) {
    const ch = sorted[i];
    if (ch) ch.number = i + 1;
  }
  chapters.length = 0;
  chapters.push(...sorted);
  return true;
}

interface FixtureEntry {
  number: number;
  title?: string;
  volume?: number;
  releaseDate?: string;
}

function loadFixture(slug: string): WikipediaChapter[] {
  const p = path.resolve(`docs/research/parser-accuracy/${slug}/wikipedia-chapters.json`);
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as FixtureEntry[];
  return raw.map(e => ({
    number: e.number,
    title: e.title,
    volumeNumber: e.volume,
    releaseDate: e.releaseDate,
  }));
}

function testFixture(slug: string, expectRenumber: boolean): void {
  const chapters = loadFixture(slug);
  const before = chapters.length;
  const firstTitle = chapters[0]?.title ?? '(none)';
  const uniqueBefore = new Set(chapters.map(c => c.number)).size;

  const applied = applyPerVolumeRenumbering(chapters);
  const uniqueAfter = new Set(chapters.map(c => c.number)).size;
  const titledAfter = chapters.filter(c => c.title && c.title.trim().length > 0).length;

  print(`\n[${slug}]`);
  print(`  entries:           ${before}`);
  print(`  unique # before:   ${uniqueBefore}`);
  print(`  unique # after:    ${uniqueAfter}`);
  print(`  titled entries:    ${titledAfter}`);
  print(`  first title:       "${firstTitle}"`);
  print(`  renumbered:        ${applied} (expected: ${expectRenumber})`);

  const ok = applied === expectRenumber
    && (!applied || uniqueAfter === before)
    && titledAfter === before;
  print(`  → ${ok ? 'OK' : 'FAIL'}`);
  if (!ok) process.exitCode = 1;
}

testFixture('20th-century-boys', true);
testFixture('berserk', false);  // Berserk fixture is sparse (non-contiguous) — doesn't trigger
