import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

import { countPagesInArchive } from '../page-counter';

describe('countPagesInArchive (directory branch)', () => {
  let tmpDir: string;
  let emptyDir: string;
  let mixedDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-counter-test-'));
    // Directory containing 3 jpg images and 1 non-image — should count 3.
    mixedDir = path.join(tmpDir, 'mixed');
    await fs.mkdir(mixedDir);
    await Promise.all([
      fs.writeFile(path.join(mixedDir, 'page01.jpg'), 'x'),
      fs.writeFile(path.join(mixedDir, 'page02.jpg'), 'x'),
      fs.writeFile(path.join(mixedDir, 'page03.jpg'), 'x'),
      fs.writeFile(path.join(mixedDir, 'ComicInfo.xml'), '<x/>'),
    ]);
    // Empty directory — should count 0 without throwing EISDIR.
    emptyDir = path.join(tmpDir, 'empty');
    await fs.mkdir(emptyDir);
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('counts image files in a directory-of-images (no EISDIR)', async () => {
    const pages = await countPagesInArchive(mixedDir);
    expect(pages).toBe(3);
  });

  it('returns 0 for an empty directory rather than failing with EISDIR', async () => {
    const pages = await countPagesInArchive(emptyDir);
    expect(pages).toBe(0);
  });

  it('returns 0 for a missing path', async () => {
    const pages = await countPagesInArchive(path.join(tmpDir, 'does-not-exist'));
    expect(pages).toBe(0);
  });
});
