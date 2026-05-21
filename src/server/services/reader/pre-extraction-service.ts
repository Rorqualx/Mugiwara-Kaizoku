/**
 * Pre-Extraction Service
 *
 * Automatically extracts pages from downloaded archives when chapter downloads complete.
 * Pre-extracted pages are served instantly from disk cache instead of on-demand extraction.
 *
 * This optimization saves 100-200ms per page load for first-time views.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import JSZip from 'jszip';

import { extractImagesFromRar } from '@/server/services/conversion/utils/rar-extractor';
import { logger } from '@/utils/logger';

// Configuration
const BATCH_SIZE = 5;
const MANGA_FILES_DIR = process.env['MANGA_FILES_DIR'] ?? '/data/manga';

/**
 * Check if file is an image by extension
 */
function isImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(filename);
}

/**
 * Extract pages from a CBZ archive to disk cache
 */
async function extractCbzPages(
  archiveBuffer: Buffer,
  cacheDir: string
): Promise<number> {
  const zip = await JSZip.loadAsync(archiveBuffer);

  // Get image files sorted naturally
  const imageFiles = Object.keys(zip.files)
    .filter(name => isImageFile(name) && !zip.files[name]?.dir)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  // Extract in batches to avoid memory pressure
  for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
    const batch = imageFiles.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop -- Intentional: batching to control memory usage
    await Promise.all(
      batch.map(async (filename, batchIdx) => {
        const pageNum = i + batchIdx + 1;
        const ext = path.extname(filename);
        const file = zip.file(filename);
        if (!file) return;

        const buffer = await file.async('nodebuffer');
        await fs.writeFile(path.join(cacheDir, `${pageNum}${ext}`), buffer);
      })
    );
  }

  return imageFiles.length;
}

/**
 * Extract pages from a RAR/CBR archive to disk cache.
 * Returns page count or -1 on failure.
 */
async function extractRarPages(
  archivePath: string,
  cacheDir: string
): Promise<number> {
  const result = await extractImagesFromRar(archivePath);
  if (result.status !== 'success') {
    logger.error('RAR pre-extraction failed', {
      archivePath,
      error: result.status === 'error' ? result.error.message : 'Unknown error',
    });
    return -1;
  }

  const { files } = result.data;

  // Write in batches to avoid memory pressure
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    // eslint-disable-next-line no-await-in-loop -- Intentional: batching to control memory usage
    await Promise.all(
      batch.map(async (file, batchIdx) => {
        const pageNum = i + batchIdx + 1;
        const ext = path.extname(file.name);
        await fs.writeFile(path.join(cacheDir, `${pageNum}${ext}`), file.data);
      })
    );
  }

  return files.length;
}

/**
 * Render a single PDF page to PNG and write to disk.
 * Cleans up mupdf native resources after rendering.
 */
function renderAndSavePdfPage(
  mupdf: typeof import('mupdf'),
  doc: ReturnType<typeof import('mupdf').Document.openDocument>,
  pageIndex: number,
  outputPath: string
): Promise<void> {
  const page = doc.loadPage(pageIndex);
  try {
    const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB);
    try {
      const pngBuffer = Buffer.from(pixmap.asPNG());
      return fs.writeFile(outputPath, pngBuffer);
    } finally {
      pixmap.destroy();
    }
  } finally {
    page.destroy();
  }
}

/**
 * Extract pages from a PDF to disk cache
 */
async function extractPdfPages(
  archiveBuffer: Buffer,
  cacheDir: string
): Promise<number> {
  const mupdf = await import('mupdf');
  const doc = mupdf.Document.openDocument(archiveBuffer, 'application/pdf');

  try {
    const totalPages = doc.countPages();

    for (let i = 0; i < totalPages; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, totalPages);
      const batchPromises: Promise<void>[] = [];

      for (let p = i; p < batchEnd; p++) {
        batchPromises.push(renderAndSavePdfPage(mupdf, doc, p, path.join(cacheDir, `${p + 1}.png`)));
      }

      // eslint-disable-next-line no-await-in-loop -- Intentional: batching to control memory usage
      await Promise.all(batchPromises);
    }

    return totalPages;
  } finally {
    doc.destroy();
  }
}

/**
 * Pre-extract all pages from a chapter archive.
 * Called after a chapter download completes to warm the page cache.
 *
 * @param mangaId - Manga ID
 * @param chapterId - Chapter ID
 * @param archivePath - Path to the downloaded archive file
 */
export async function preExtractChapterPages(
  mangaId: number,
  chapterId: number,
  archivePath: string
): Promise<void> {
  const cacheDir = path.join(
    MANGA_FILES_DIR,
    'extracted',
    `manga-${mangaId}`,
    `chapter-${chapterId}`
  );

  try {
    // Create cache directory
    await fs.mkdir(cacheDir, { recursive: true });

    // Check if already extracted
    const existingFiles = await fs.readdir(cacheDir).catch(() => []);
    if (existingFiles.length > 0) {
      logger.debug('Chapter already pre-extracted', {
        mangaId,
        chapterId,
        pages: existingFiles.length
      });
      return;
    }

    // Read archive
    const archiveBuffer = await fs.readFile(archivePath);
    const ext = path.extname(archivePath).toLowerCase();

    let pageCount = 0;

    // Handle different archive formats
    if (ext === '.cbz' || ext === '.zip') {
      pageCount = await extractCbzPages(archiveBuffer, cacheDir);
    } else if (ext === '.cbr' || ext === '.rar') {
      pageCount = await extractRarPages(archivePath, cacheDir);
    } else if (ext === '.pdf') {
      pageCount = await extractPdfPages(archiveBuffer, cacheDir);
    } else {
      logger.warn('Unsupported archive format for pre-extraction', {
        mangaId,
        chapterId,
        format: ext
      });
      return;
    }

    if (pageCount < 0) {
      logger.warn('Pre-extraction returned no pages', { mangaId, chapterId, format: ext });
      return;
    }

    logger.info('Pre-extraction complete', {
      mangaId,
      chapterId,
      pages: pageCount,
      cacheDir
    });
  } catch (error) {
    logger.error('Pre-extraction failed', {
      mangaId,
      chapterId,
      archivePath,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get path to pre-extracted page if it exists
 *
 * @param mangaId - Manga ID
 * @param chapterId - Chapter ID
 * @param pageNumber - Page number (1-based)
 * @returns Path to cached page file, or null if not cached
 */
export async function getPreExtractedPage(
  mangaId: number,
  chapterId: number,
  pageNumber: number
): Promise<string | null> {
  const cacheDir = path.join(
    MANGA_FILES_DIR,
    'extracted',
    `manga-${mangaId}`,
    `chapter-${chapterId}`
  );

  try {
    const files = await fs.readdir(cacheDir);
    // Find file matching page number (e.g., "1.jpg", "1.png", etc.)
    const pageFile = files.find(f => {
      const match = f.match(/^(\d+)\./);
      return match?.[1] && parseInt(match[1], 10) === pageNumber;
    });

    if (pageFile) {
      const pagePath = path.join(cacheDir, pageFile);
      await fs.access(pagePath);
      return pagePath;
    }
  } catch {
    // Cache miss - page not pre-extracted
  }

  return null;
}

/**
 * Clean up pre-extracted pages for a chapter
 *
 * @param mangaId - Manga ID
 * @param chapterId - Chapter ID
 */
export async function cleanupPreExtractedPages(
  mangaId: number,
  chapterId: number
): Promise<void> {
  const cacheDir = path.join(
    MANGA_FILES_DIR,
    'extracted',
    `manga-${mangaId}`,
    `chapter-${chapterId}`
  );

  try {
    await fs.rm(cacheDir, { recursive: true, force: true });
    logger.debug('Cleaned up pre-extracted pages', { mangaId, chapterId });
  } catch (error) {
    logger.error('Failed to cleanup pre-extracted pages', {
      mangaId,
      chapterId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
