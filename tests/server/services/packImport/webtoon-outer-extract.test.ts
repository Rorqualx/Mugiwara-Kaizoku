/**
 * @jest-environment node
 *
 * webtoon-outer-extract tests — build synthetic outer/inner archives
 * in a hermetic tmp dir, run extraction, verify inner files land in
 * the sibling -extracted dir.
 *
 * Covers both extraction paths:
 *   - iter-IJ2: .cbz / .zip outers via JSZip
 *   - iter-IJ3: .rar / .cbr / .7z / .cb7 outers via `unar`
 *
 * iter-IJ3 tests are skipped when `unar` is not on PATH so the suite
 * stays green on developer machines without libarchive installed.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  extractWebtoonOuterArchive, deriveExtractDir,
} from '@/server/services/packImport/webtoon-outer-extract';

const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0xc0,
  0xc0, 0x00, 0x00, 0x00, 0x05, 0x00, 0x01, 0x5e, 0xf3, 0x2a, 0x8a, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

let tmpDir: string;

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

function makeWebtoonPack(targetPath: string, innerNames: string[]): void {
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webtoon-staging-'));
  try {
    for (const name of innerNames) {
      makeCbz(path.join(stagingDir, name), [{ name: 'page-001.png', data: TINY_PNG }]);
    }
    const args = innerNames.map(n => `"${n}"`).join(' ');
    execSync(`cd "${stagingDir}" && zip -q "${targetPath}" ${args}`);
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

/**
 * Probe for `unar` once at suite load. iter-IJ3 tests are conditional
 * on the binary being available so the suite stays green on dev hosts
 * without it.
 */
function hasUnar(): boolean {
  try {
    execSync('unar -v', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Build a real .7z archive of inner CBZ files using 7z (or 7zz).
 * Returns true if creation succeeded — false lets the caller soft-skip
 * the test when no 7z-creation binary is on PATH.
 */
function make7zOuterOfInners(targetPath: string, innerNames: string[]): boolean {
  let creator: '7z' | '7zz' | null = null;
  try {
    execSync('7z 2>/dev/null', { stdio: 'ignore' });
    creator = '7z';
  } catch {
    try {
      execSync('7zz 2>/dev/null', { stdio: 'ignore' });
      creator = '7zz';
    } catch {
      return false;
    }
  }
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), '7z-staging-'));
  try {
    for (const name of innerNames) {
      makeCbz(path.join(stagingDir, name), [{ name: 'page-001.png', data: TINY_PNG }]);
    }
    const cmd = innerNames.map(n => `"${n}"`).join(' ');
    execSync(`cd "${stagingDir}" && ${creator} a "${targetPath}" ${cmd}`, { stdio: 'ignore' });
    return fs.existsSync(targetPath);
  } catch {
    return false;
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webtoon-extract-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('deriveExtractDir', () => {
  it('appends -extracted suffix and strips extension', () => {
    expect(deriveExtractDir('/lib/manga/Volumes/Lookism-pack.cbz'))
      .toBe('/lib/manga/Volumes/Lookism-pack-extracted');
  });

  it('handles .zip extension', () => {
    expect(deriveExtractDir('/lib/x/outer.zip')).toBe('/lib/x/outer-extracted');
  });

  it('handles dots in the base name', () => {
    expect(deriveExtractDir('/lib/Series (2024) (Digital).cbz'))
      .toBe('/lib/Series (2024) (Digital)-extracted');
  });
});

describe('extractWebtoonOuterArchive', () => {
  it('extracts 5 inner CBZs from a chapter-archives outer pack', async () => {
    const outerPath = path.join(tmpDir, 'webtoon-pack.cbz');
    makeWebtoonPack(outerPath, [
      'Lookism 001.cbz', 'Lookism 002.cbz', 'Lookism 003.cbz',
      'Lookism 004.cbz', 'Lookism 005.cbz',
    ]);

    const result = await extractWebtoonOuterArchive(outerPath);
    expect(result.ok).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.outputDir).toBe(path.join(tmpDir, 'webtoon-pack-extracted'));
    expect(result.innerFiles).toHaveLength(5);
    for (const name of ['Lookism 001.cbz', 'Lookism 002.cbz', 'Lookism 005.cbz']) {
      expect(result.innerFiles.some(f => f.endsWith(name))).toBe(true);
      expect(fs.existsSync(path.join(result.outputDir, name))).toBe(true);
    }
    expect(fs.existsSync(outerPath)).toBe(true);
  });

  it('idempotent — re-extract returns reused:true without re-writing files', async () => {
    const outerPath = path.join(tmpDir, 'pack.cbz');
    makeWebtoonPack(outerPath, ['inner-001.cbz', 'inner-002.cbz']);

    const first = await extractWebtoonOuterArchive(outerPath);
    expect(first.ok).toBe(true);
    expect(first.reused).toBe(false);

    const second = await extractWebtoonOuterArchive(outerPath);
    expect(second.ok).toBe(true);
    expect(second.reused).toBe(true);
    expect(second.innerFiles).toHaveLength(2);
  });

  it('refuses to extract image-pack shape (outer is a single chapter of pages)', async () => {
    const outerPath = path.join(tmpDir, 'image-pack.cbz');
    makeCbz(outerPath, Array.from({ length: 5 }, (_, i) => ({
      name: `page-${String(i + 1).padStart(3, '0')}.png`, data: TINY_PNG,
    })));

    const result = await extractWebtoonOuterArchive(outerPath);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('wrong shape');
    expect(result.innerFiles).toHaveLength(0);
  });

  it('refuses truly unsupported outer extension (.tar)', async () => {
    const outerPath = path.join(tmpDir, 'pack.tar');
    fs.writeFileSync(outerPath, 'fake');
    const result = await extractWebtoonOuterArchive(outerPath);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('unsupported outer format');
  });

  it('preserves the outer archive after successful extraction', async () => {
    const outerPath = path.join(tmpDir, 'preserve-me.cbz');
    makeWebtoonPack(outerPath, ['inner-001.cbz', 'inner-002.cbz']);

    const result = await extractWebtoonOuterArchive(outerPath);
    expect(result.ok).toBe(true);
    expect(fs.existsSync(outerPath)).toBe(true);
    const outerStat = fs.statSync(outerPath);
    expect(outerStat.size).toBeGreaterThan(0);
  });

  it('flattens nested directory prefix in the inner names', async () => {
    // Outer zip with inner files under a subdirectory — common
    // packaging when the original archive was made via `zip -r`.
    const outerPath = path.join(tmpDir, 'nested-pack.cbz');
    const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nested-staging-'));
    try {
      fs.mkdirSync(path.join(stagingDir, 'sub'));
      makeCbz(path.join(stagingDir, 'sub', 'A.cbz'), [{ name: 'p.png', data: TINY_PNG }]);
      makeCbz(path.join(stagingDir, 'sub', 'B.cbz'), [{ name: 'p.png', data: TINY_PNG }]);
      execSync(`cd "${stagingDir}" && zip -qr "${outerPath}" sub/`);
    } finally {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }

    const result = await extractWebtoonOuterArchive(outerPath);
    expect(result.ok).toBe(true);
    expect(result.innerFiles).toHaveLength(2);
    for (const f of result.innerFiles) {
      // Leaf names only — no `sub/` prefix
      expect(path.dirname(f)).toBe(result.outputDir);
    }
  });
});

describe('extractWebtoonOuterArchive — iter-IJ3 unar paths', () => {
  it('reports failure cleanly when the .rar payload is bogus', async () => {
    // A fake .rar file — unar will reject it. The path is still
    // recognized as a supported outer ext, so the error must NOT be
    // "unsupported outer format" (regression guard for iter-IJ2).
    const outerPath = path.join(tmpDir, 'bogus.rar');
    fs.writeFileSync(outerPath, 'this-is-not-a-rar-archive');
    const result = await extractWebtoonOuterArchive(outerPath);
    expect(result.ok).toBe(false);
    expect(result.error).not.toContain('unsupported outer format');
    expect(result.innerFiles).toHaveLength(0);
  });

  const describe7z = hasUnar() ? describe : describe.skip;
  describe7z('with unar available', () => {
    it('extracts 3 inner CBZs from a real .7z outer (if 7z-creation tool available)', async () => {
      const outerPath = path.join(tmpDir, 'pack.7z');
      const created = make7zOuterOfInners(outerPath, [
        'Series 001.cbz', 'Series 002.cbz', 'Series 003.cbz',
      ]);
      if (!created) {
        // 7z creation binary unavailable on this host — soft-skip
        return;
      }

      const peek = await extractWebtoonOuterArchive(outerPath);
      expect(peek.ok).toBe(true);
      expect(peek.innerFiles).toHaveLength(3);
      for (const name of ['Series 001.cbz', 'Series 002.cbz', 'Series 003.cbz']) {
        expect(peek.innerFiles.some(f => f.endsWith(name))).toBe(true);
      }
      expect(fs.existsSync(outerPath)).toBe(true);
    });

    it('is idempotent across unar extractions (reused dir wins)', async () => {
      const outerPath = path.join(tmpDir, 'idem.7z');
      const created = make7zOuterOfInners(outerPath, ['x-001.cbz', 'x-002.cbz']);
      if (!created) return;

      const first = await extractWebtoonOuterArchive(outerPath);
      expect(first.ok).toBe(true);
      expect(first.reused).toBe(false);
      const second = await extractWebtoonOuterArchive(outerPath);
      expect(second.ok).toBe(true);
      expect(second.reused).toBe(true);
    });
  });
});
