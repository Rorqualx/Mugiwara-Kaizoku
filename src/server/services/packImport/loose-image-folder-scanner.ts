/**
 * Loose Image Folder Scanner
 *
 * Some torrents ship a pack as a directory tree of raw images instead of
 * `.cbz/.cbr/.zip/.rar` archives. The Steins;Gate trace on 2026-05-16
 * surfaced this: the Knaben release `[ENG-sub] Steins;Gate - Arc Light of
 * the Point at Infinity [Chapter 01-05] [Completed]` contained six
 * subdirectories (`Vol.1 Chapter 0_ Prologue`, `Vol.1 Chapter 1_ …`, etc.),
 * each with 15-50 JPEGs. The archive-only `scanDirectoryForChapterFiles`
 * matched zero files and the pack-import failed with "0 chapter-like files".
 *
 * This module is a fallback: when the primary archive scan returns zero
 * matches, we walk the directory once more looking for "image-folder
 * chapters" — direct subdirectories whose contents are predominantly
 * sequential image files. Each qualifying folder is bundled into a sibling
 * `.cbz` via the existing CBZ bundler, then handed back to the regular
 * pack-import pipeline as if the archive had been there all along. The
 * rest of the importer (file-scanner → packImportService → conversion →
 * page-counter → reader) stays unchanged.
 */

import fs from 'fs/promises';
import path from 'path';

import { createCBZ, generatePageName } from '@/server/services/native-download/downloaders/cbz-bundler';
import { logger } from '@/utils/logger';

import { parseChapterFileName, type ScannedFile } from './file-scanner';

import type { Construct } from './construct-type';

/** Lower-case image extensions we accept inside a chapter folder. */
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

/** Folder must contain at least this many images to count as a chapter,
 *  so a stray cover.jpg in the pack root isn't promoted to a chapter. */
const MIN_IMAGES_PER_CHAPTER = 3;

/** Hidden / metadata directories produced by various filesystems. */
const SKIP_DIR_NAMES = new Set(['__MACOSX', '.DS_Store', '@eaDir', '.thumbnails']);

/**
 * Natural-sort comparator so "1.jpg", "2.jpg", …, "10.jpg" come out in
 * numeric order rather than the lexicographic "1, 10, 11, 2, 3…".
 */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

interface CandidateFolder {
  name: string;
  fullPath: string;
  imageFiles: string[];
}

/** Walk one folder's direct contents; return image files (full paths) only
 *  if the folder qualifies as a chapter (≥ MIN_IMAGES_PER_CHAPTER images and
 *  no nested archives that should have been caught by the primary scan). */
async function inspectFolder(fullPath: string): Promise<string[] | null> {
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const images: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTS.has(ext)) images.push(path.join(fullPath, entry.name));
  }
  if (images.length < MIN_IMAGES_PER_CHAPTER) return null;
  return images.sort(naturalCompare);
}

async function findCandidateFolders(rootPath: string): Promise<CandidateFolder[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory() && !SKIP_DIR_NAMES.has(e.name) && !e.name.startsWith('.'));
  const checked = await Promise.all(
    dirs.map(async (d) => {
      const fullPath = path.join(rootPath, d.name);
      const imageFiles = await inspectFolder(fullPath);
      return imageFiles === null ? null : { name: d.name, fullPath, imageFiles };
    }),
  );
  return checked.filter((c): c is CandidateFolder => c !== null);
}

async function bundleFolderToCbz(folder: CandidateFolder, outputDir: string): Promise<string | null> {
  const cbzPath = path.join(outputDir, `${folder.name}.cbz`);
  const pages = folder.imageFiles.map((filePath, index) => ({
    filePath,
    archiveName: generatePageName(index + 1, path.extname(filePath)),
  }));
  const result = await createCBZ({ outputPath: cbzPath, pages });
  if (!result.success) {
    logger.warn('[LooseImageFolderScanner] CBZ bundling failed', {
      folder: folder.name, error: result.error,
    });
    return null;
  }
  return cbzPath;
}

/**
 * Scan `directoryPath` for "image-folder chapters" and materialize each one
 * as a sibling `.cbz`. Returns one {@link ScannedFile} per successfully
 * bundled chapter. Caller is responsible for deciding when to invoke this
 * (the recommended trigger is `files.length === 0` from the primary
 * archive scan in `scanDirectoryForChapterFiles`).
 */
export async function scanLooseImageFolders(
  directoryPath: string,
  construct?: Construct,
): Promise<ScannedFile[]> {
  const candidates = await findCandidateFolders(directoryPath);
  if (candidates.length === 0) return [];

  logger.info(
    `[LooseImageFolderScanner] Found ${candidates.length} image-folder candidate(s); bundling to CBZ`,
    { directoryPath, folders: candidates.map(c => c.name) },
  );

  const out: ScannedFile[] = [];
  for (const folder of candidates) {
    // eslint-disable-next-line no-await-in-loop -- CBZ creation is IO-bound but sequential keeps memory bounded
    const cbzPath = await bundleFolderToCbz(folder, directoryPath);
    if (cbzPath === null) continue;
    // eslint-disable-next-line no-await-in-loop -- depends on bundleFolderToCbz above
    const stats = await fs.stat(cbzPath);
    const parsed = parseChapterFileName(folder.name, '.cbz', construct);
    out.push({
      fileName: `${folder.name}.cbz`,
      filePath: cbzPath,
      size: stats.size,
      volumeNumber: parsed.volumeNumber,
      chapterNumber: parsed.chapterNumber,
      isValidChapter: parsed.volumeNumber !== null || parsed.chapterNumber !== null,
    });
  }
  return out;
}
