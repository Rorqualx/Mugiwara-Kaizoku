/**
 * Page Counter
 *
 * Counts image pages in CBZ/CBR/PDF archives without extracting them. Used by
 * the file-importer right after a chapter row is linked to a freshly-imported
 * archive, so the `readable` signal (Chapter.pageCount > 0) lights up on the
 * first pass instead of waiting for a reader request.
 *
 * iter-5.
 *
 * @module server/services/download/fileImporter/page-counter
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

import { listRarImages } from '@/server/services/conversion/utils/rar-extractor';
import { logger } from '@/utils/logger';

// iter-12: broadened to include less-common but legitimate manga page formats
// (.avif on newer danke-Empire packs, .jxl on some digital-first releases,
// .tiff/.heic on studio scans). Without these, CBZs using modern formats
// count as 0 pages and the chapter stays un-`readable`.
const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.avif', '.jxl', '.tiff', '.tif', '.heic', '.heif',
] as const;

const MIN_IMAGE_BYTES_FALLBACK = 10_240; // ≥10KB — a zip entry that large is almost certainly an image page, even if the extension is missing.

function isPdf(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.pdf';
}

function isRarArchive(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.cbr' || ext === '.rar';
}

async function countPagesInPdf(pdfPath: string): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib');
    const buffer = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return pdf.getPageCount();
  } catch (error) {
    logger.warn('[PageCounter] Failed to count pages in PDF', {
      pdfPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

async function countPagesInRar(rarPath: string): Promise<number> {
  try {
    const result = await listRarImages(rarPath);
    if (result.status === 'success' && result.data.length > 0) return result.data.length;
  } catch (error) {
    logger.debug('[PageCounter] node-unrar-js failed, trying lsar fallback', {
      rarPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  // iter-15: lsar (libarchive/unar suite) handles RARs that node-unrar-js chokes
  // on ("File read error" on legit single-volume CBRs like NGE V13).
  const fallback = await countPagesViaLsar(rarPath);
  if (fallback > 0) return fallback;
  logger.warn('[PageCounter] Failed to count pages in RAR (all strategies)', { rarPath });
  return 0;
}

async function countPagesViaLsar(archivePath: string): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('lsar', [archivePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.on('error', () => resolve(0));
    proc.on('close', (code) => {
      if (code !== 0) { resolve(0); return; }
      const text = Buffer.concat(chunks).toString('utf-8');
      const lines = text.split('\n').slice(1); // first line is the archive header
      let count = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        const ext = path.extname(trimmed).toLowerCase();
        if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) count += 1;
      }
      resolve(count);
    });
  });
}

async function countPagesInZip(zipPath: string): Promise<number> {
  try {
    const buffer = await fs.readFile(zipPath);
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);

    const allEntries = Object.keys(zip.files)
      .map((filename) => ({ filename, entry: zip.files[filename] }))
      .filter(({ entry }) => entry !== undefined && entry.dir !== true);

    const imageFiles = allEntries.filter(({ filename }) => {
      const ext = path.extname(filename).toLowerCase();
      return (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
    });
    if (imageFiles.length > 0) return imageFiles.length;

    // iter-12: no extension-matched images found — likely a CBZ using a format
    // our extension list doesn't cover yet, OR pages stored without extensions.
    // Fall back to "entries plausibly large enough to be page images".
    const candidateEntries = await countSizedEntries(allEntries);
    if (candidateEntries > 0) {
      logger.warn('[PageCounter] ZIP had no extension-matched images; using size-fallback', {
        zipPath, totalEntries: allEntries.length, candidateEntries,
        sampleNames: allEntries.slice(0, 5).map(e => e.filename),
      });
      return candidateEntries;
    }

    logger.warn('[PageCounter] ZIP has no image-like entries at all', {
      zipPath, totalEntries: allEntries.length,
      sampleNames: allEntries.slice(0, 5).map(e => e.filename),
    });
    return 0;
  } catch (error) {
    logger.warn('[PageCounter] Failed to count pages in ZIP/CBZ', {
      zipPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

async function countSizedEntries(
  entries: ReadonlyArray<{ filename: string; entry: { async: (type: 'uint8array') => Promise<Uint8Array> } | undefined }>
): Promise<number> {
  let count = 0;
  for (const { filename, entry } of entries) {
    if (entry === undefined) continue;
    // Skip obvious metadata files
    const lower = filename.toLowerCase();
    if (lower.endsWith('.xml') || lower.endsWith('.txt') || lower.endsWith('.json') || lower.endsWith('.nfo')) continue;
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential to avoid memory spikes on large archives
      const bytes = await entry.async('uint8array');
      if (bytes.byteLength >= MIN_IMAGE_BYTES_FALLBACK) count += 1;
    } catch {
      // skip unreadable entries
    }
  }
  return count;
}

async function countPagesInDirectory(dirPath: string): Promise<number> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) count += 1;
    }
    return count;
  } catch (error) {
    logger.warn('[PageCounter] Failed to count pages in directory', {
      dirPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * Count image pages in an archive. Returns 0 on any failure (logged as warn).
 * Supports .cbz/.zip, .cbr/.rar, .pdf, and directories-of-images.
 */
export async function countPagesInArchive(archivePath: string): Promise<number> {
  let st: { isDirectory(): boolean };
  try {
    st = await fs.stat(archivePath);
  } catch {
    return 0;
  }
  if (st.isDirectory()) return countPagesInDirectory(archivePath);
  if (isPdf(archivePath)) return countPagesInPdf(archivePath);
  if (isRarArchive(archivePath)) return countPagesInRar(archivePath);
  return countPagesInZip(archivePath);
}
