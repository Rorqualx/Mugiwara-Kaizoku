// @ts-nocheck - Test file mocks the archive peek/extract helpers
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPeek = jest.fn();
const mockExtract = jest.fn();

jest.mock('@/server/services/packImport/archive-peek', () => ({
  ...jest.requireActual('@/server/services/packImport/archive-peek'),
  peekArchiveContents: mockPeek,
}));
jest.mock('@/server/services/packImport/webtoon-outer-extract', () => ({
  extractWebtoonOuterArchive: mockExtract,
}));

import { scanSingleArchiveFile } from '@/server/services/packImport/file-scanner';

describe('scanSingleArchiveFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'single-archive-'));
    mockPeek.mockReset();
    mockExtract.mockReset();
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('treats a volume archive full of page images as ONE volume file', async () => {
    const archive = path.join(dir, 'Title v01.cbz');
    await fs.writeFile(archive, 'x'.repeat(10));
    const pages = Array.from({ length: 200 }, (_, i) => `${String(i + 1).padStart(3, '0')}.jpg`);
    mockPeek.mockResolvedValue({ innerFiles: pages, archiveCount: 0, imageCount: 200, ok: true });

    const files = await scanSingleArchiveFile(archive);

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      fileName: 'Title v01.cbz', filePath: archive, size: 10, volumeNumber: 1, isValidChapter: true,
    });
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('unpacks an archive whose contents are chapter archives', async () => {
    const archive = path.join(dir, 'Pack.zip');
    await fs.writeFile(archive, 'outer');
    const inner = ['Title v01.cbz', 'Title v02.cbz'].map((name) => path.join(dir, name));
    await Promise.all(inner.map((p) => fs.writeFile(p, 'inner')));
    mockPeek.mockResolvedValue({
      innerFiles: ['Title v01.cbz', 'Title v02.cbz'], archiveCount: 2, imageCount: 0, ok: true,
    });
    mockExtract.mockResolvedValue({ ok: true, outputDir: dir, innerFiles: inner, reused: false });

    const files = await scanSingleArchiveFile(archive);

    expect(files.map((f) => f.fileName)).toEqual(['Title v01.cbz', 'Title v02.cbz']);
    expect(files.map((f) => f.volumeNumber)).toEqual([1, 2]);
  });

  it('keeps the archive as one file when it cannot be listed or unpacked', async () => {
    const archive = path.join(dir, 'Title v03.cbr');
    await fs.writeFile(archive, 'rar');
    mockPeek.mockResolvedValue({ innerFiles: [], archiveCount: 0, imageCount: 0, ok: false });

    const files = await scanSingleArchiveFile(archive);
    expect(files).toHaveLength(1);
    expect(files[0]?.volumeNumber).toBe(3);

    mockPeek.mockResolvedValue({ innerFiles: ['a.cbz'], archiveCount: 1, imageCount: 0, ok: true });
    mockExtract.mockResolvedValue({ ok: false, outputDir: dir, innerFiles: [], reused: false, error: 'boom' });
    expect(await scanSingleArchiveFile(archive)).toHaveLength(1);
  });

  it('returns nothing for a file that is not an archive', async () => {
    const file = path.join(dir, 'movie.mkv');
    await fs.writeFile(file, 'x');
    expect(await scanSingleArchiveFile(file)).toEqual([]);
    expect(mockPeek).not.toHaveBeenCalled();
  });
});
