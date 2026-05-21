/**
 * @jest-environment node
 *
 * archive-peek tests using the synthetic webtoon-mock fixture.
 *
 * The fixture is built by the test setup (zip CBZs in a temp dir)
 * rather than relying on the survey fixture directory — keeps tests
 * hermetic and CI-runnable.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { peekArchiveContents, classifyArchiveContents } from '@/server/services/packImport/archive-peek';

// 1x1 transparent PNG, 67 bytes — same payload as the survey fixture.
// eslint-disable-next-line no-control-regex
const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xc0,
  0xc0, 0x00, 0x00, 0x00, 0x05, 0x00, 0x01, 0x5e, 0xf3, 0x2a, 0x8a, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

let tmpDir: string;
let chapterArchivesPath: string;
let imagePackPath: string;
let mixedPackPath: string;

function makeCbz(targetPath: string, files: Array<{ name: string; data: Buffer }>): void {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cbz-staging-'));
  try {
    for (const f of files) fs.writeFileSync(path.join(stagingDir, f.name), f.data);
    const names = files.map(f => `"${f.name}"`).join(' ');
    execSync(`cd "${stagingDir}" && zip -q "${targetPath}" ${names}`);
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-peek-'));

  // chapter-archives shape: outer CBZ containing 5 inner CBZs
  const innerStaging = path.join(tmpDir, 'inner-staging');
  fs.mkdirSync(innerStaging);
  for (let i = 1; i <= 5; i++) {
    const n = String(i).padStart(3, '0');
    makeCbz(path.join(innerStaging, `Lookism ${n}.cbz`), [{ name: 'page-001.png', data: TINY_PNG }]);
  }
  chapterArchivesPath = path.join(tmpDir, 'webtoon-pack.cbz');
  execSync(`cd "${innerStaging}" && zip -q "${chapterArchivesPath}" *.cbz`);

  // image-pack shape: outer CBZ containing only PNG pages
  imagePackPath = path.join(tmpDir, 'image-pack.cbz');
  makeCbz(imagePackPath, [
    { name: 'page-001.png', data: TINY_PNG },
    { name: 'page-002.png', data: TINY_PNG },
    { name: 'page-003.png', data: TINY_PNG },
    { name: 'page-004.png', data: TINY_PNG },
    { name: 'page-005.png', data: TINY_PNG },
  ]);

  // mixed shape: 1 archive + 1 image (intentionally below the 80% threshold)
  const mixedStaging = path.join(tmpDir, 'mixed-staging');
  fs.mkdirSync(mixedStaging);
  fs.writeFileSync(path.join(mixedStaging, 'page.png'), TINY_PNG);
  makeCbz(path.join(mixedStaging, 'inner.cbz'), [{ name: 'p.png', data: TINY_PNG }]);
  mixedPackPath = path.join(tmpDir, 'mixed.cbz');
  execSync(`cd "${mixedStaging}" && zip -q "${mixedPackPath}" page.png inner.cbz`);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('peekArchiveContents', () => {
  it('returns inner file leaf names for chapter-archives outer pack', async () => {
    const peek = await peekArchiveContents(chapterArchivesPath);
    expect(peek.ok).toBe(true);
    expect(peek.innerFiles).toEqual([
      'Lookism 001.cbz', 'Lookism 002.cbz', 'Lookism 003.cbz',
      'Lookism 004.cbz', 'Lookism 005.cbz',
    ]);
    expect(peek.archiveCount).toBe(5);
    expect(peek.imageCount).toBe(0);
  });

  it('counts images for an image-pack outer', async () => {
    const peek = await peekArchiveContents(imagePackPath);
    expect(peek.ok).toBe(true);
    expect(peek.archiveCount).toBe(0);
    expect(peek.imageCount).toBe(5);
  });

  it('returns ok:false for a non-existent path', async () => {
    const peek = await peekArchiveContents('/tmp/this-does-not-exist-12345.cbz');
    expect(peek.ok).toBe(false);
    expect(peek.innerFiles).toEqual([]);
  });
});

describe('classifyArchiveContents', () => {
  it('chapter-archives → "chapter-archives"', async () => {
    const peek = await peekArchiveContents(chapterArchivesPath);
    expect(classifyArchiveContents(peek)).toBe('chapter-archives');
  });

  it('image-pack → "image-pack"', async () => {
    const peek = await peekArchiveContents(imagePackPath);
    expect(classifyArchiveContents(peek)).toBe('image-pack');
  });

  it('mixed (50/50) → "mixed"', async () => {
    const peek = await peekArchiveContents(mixedPackPath);
    expect(classifyArchiveContents(peek)).toBe('mixed');
  });

  it('failed peek (ok:false) → null', () => {
    expect(classifyArchiveContents({ innerFiles: [], archiveCount: 0, imageCount: 0, ok: false })).toBeNull();
  });

  it('empty success → null', () => {
    expect(classifyArchiveContents({ innerFiles: [], archiveCount: 0, imageCount: 0, ok: true })).toBeNull();
  });
});
