/**
 * @jest-environment node
 *
 * Disk-verification of volume-archive coverage: nullifyMissingArchives must keep
 * archive rows whose file exists and clear the filePath of those whose file is
 * gone (so a phantom archive row never counts as coverage). Uses real temp files.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, afterAll } from '@jest/globals';

import { nullifyMissingArchives } from '@/server/services/library/volume-archive-coverage-fs';
import type { CoverageRow } from '@/server/services/library/volume-archive-coverage';

const dir = mkdtempSync(join(tmpdir(), 'arcfs-'));
const real = join(dir, 'V01.cbr');
const gone = join(dir, 'gone.cbr');
writeFileSync(real, 'x');
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

const row = (o: Partial<CoverageRow>): CoverageRow =>
  ({ id: 1, chapterNumber: null, volume: 1, filePath: null, downloadStatus: 'COMPLETED', ...o });

describe('nullifyMissingArchives', () => {
  it('keeps an archive whose file exists', async () => {
    const out = await nullifyMissingArchives([row({ filePath: real })]);
    expect(out[0]?.filePath).toBe(real);
  });

  it('clears the filePath of an archive whose file is missing', async () => {
    const out = await nullifyMissingArchives([row({ filePath: gone })]);
    expect(out[0]?.filePath).toBeNull();
  });

  it('never touches numbered chapter rows, even with a missing path', async () => {
    const out = await nullifyMissingArchives([row({ chapterNumber: 5, filePath: gone, downloadStatus: 'PENDING' })]);
    expect(out[0]?.filePath).toBe(gone);
  });
});
