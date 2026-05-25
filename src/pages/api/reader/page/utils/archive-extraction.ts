/**
 * Archive Extraction for Page Reader API
 *
 * Handles on-demand extraction of pages from CBZ/ZIP/CBR/RAR archives.
 * Supports both ZIP-based (CBZ) and RAR-based (CBR) comic book formats.
 */

import fs from 'fs/promises';
import path from 'path';

import yauzl from 'yauzl';

import { extractPageFromRar } from '@/server/services/conversion/utils/rar-extractor';
import { logger } from '@/utils/logger';

import type { NextApiResponse } from 'next';

/**
 * Supported image extensions
 */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/** Maximum archive size in bytes (2 GB). Applies to RAR and PDF, which still
 *  load the whole file into memory. ZIP uses streaming (yauzl) and is bounded
 *  by central-directory size + the single extracted page, not the archive
 *  total — color manga volumes routinely exceed 500 MB (e.g. One Piece
 *  Digital Colored Vol 1 = 745 MB) and need to be readable. */
const MAX_ARCHIVE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

/** Maximum extraction time in milliseconds (30 seconds) */
const EXTRACTION_TIMEOUT_MS = 30_000;

/** Per-archive extraction lock to prevent concurrent full-archive loads */
const extractionLocks = new Map<string, Promise<ExtractedPageResult | ExtractionError>>();

/** Maximum concurrent archive extractions */
const MAX_CONCURRENT_EXTRACTIONS = 3;
let activeExtractions = 0;

/**
 * Result of extracting a page from archive
 */
export interface ExtractedPageResult {
  buffer: Buffer;
  contentType: string;
  extension: string;
  totalPagesInArchive: number;
}

/**
 * Error result from extraction
 */
export interface ExtractionError {
  code: string;
  message: string;
}

/**
 * Natural sort comparator for page ordering
 * Handles filenames with mixed numeric/text parts correctly
 */
function naturalSortCompare(a: string, b: string): number {
  const regex = /(\d+)/g;
  const aParts = a.split(regex);
  const bParts = b.split(regex);

  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];
    if (!aPart || !bPart) continue;

    // Compare numeric parts as numbers
    if (/^\d+$/.test(aPart) && /^\d+$/.test(bPart)) {
      const diff = parseInt(aPart, 10) - parseInt(bPart, 10);
      if (diff !== 0) return diff;
    } else if (aPart !== bPart) {
      // Compare text parts as strings
      return aPart.localeCompare(bPart);
    }
  }
  return aParts.length - bParts.length;
}

/** Open a yauzl zipfile with lazyEntries so we only pay for the central
 *  directory + the entries we explicitly read. autoClose stays false so the
 *  underlying fd survives the 'end' event of the entry-enumeration pass — we
 *  enumerate first to pick the target page, then openReadStream against the
 *  still-open handle. Caller is responsible for calling zipfile.close(). */
function openZipfile(archivePath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, autoClose: false }, (err, zipfile) => {
      if (err ?? !zipfile) {
        reject(err ?? new Error('Failed to open zipfile'));
        return;
      }
      resolve(zipfile);
    });
  });
}

/** Walk the central directory once, collecting image entries indexed by
 *  filename. Does NOT decompress any entry — yauzl only seeks through entry
 *  headers, so memory cost is the central directory size (typically <1 MB). */
function collectImageEntries(zipfile: yauzl.ZipFile): Promise<Map<string, yauzl.Entry>> {
  return new Promise((resolve, reject) => {
    const entries = new Map<string, yauzl.Entry>();
    zipfile.on('entry', (entry: yauzl.Entry) => {
      if (/\/$/.test(entry.fileName)) {
        zipfile.readEntry();
        return;
      }
      const ext = path.extname(entry.fileName).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        entries.set(entry.fileName, entry);
      }
      zipfile.readEntry();
    });
    zipfile.on('end', () => resolve(entries));
    zipfile.on('error', reject);
    zipfile.readEntry();
  });
}

/** Open a read stream for a single entry and accumulate its decompressed
 *  bytes into a Buffer. The stream is the only thing held in memory; the
 *  rest of the archive is never read. */
function readEntryBuffer(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, readStream) => {
      if (err ?? !readStream) {
        reject(err ?? new Error('Failed to open entry stream'));
        return;
      }
      const chunks: Buffer[] = [];
      readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      readStream.on('end', () => resolve(Buffer.concat(chunks)));
      readStream.on('error', reject);
    });
  });
}

/**
 * Map file extension to content type
 */
function getContentType(extension: string): string {
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    default:
      return 'image/jpeg';
  }
}

/**
 * Cache extracted page asynchronously (fire-and-forget)
 * Silently fails if cache directory is not writable - page extraction still works
 */
function cacheExtractedPage(
  mangaId: number,
  chapterId: number,
  pageNumber: number,
  extension: string,
  buffer: Buffer
): void {
  // Use project-local data directory for development, /data/manga for production
  const baseDir = process.env['MANGA_FILES_DIR'] ?? process.cwd() + '/data/cache';
  const cacheDir = path.join(baseDir, 'extracted', `manga-${mangaId}`, `chapter-${chapterId}`);

  fs.mkdir(cacheDir, { recursive: true })
    .then(() => fs.writeFile(path.join(cacheDir, `${pageNumber}${extension}`), buffer))
    .catch(() => {
      // Silently ignore cache failures - extraction still works without caching
    });
}

/**
 * Archive format detected by magic bytes or extension
 */
type ArchiveType = 'zip' | 'rar' | 'pdf' | 'unknown';

/**
 * Check if archive is a RAR/CBR file by extension
 */
function isRarArchive(archivePath: string): boolean {
  const ext = path.extname(archivePath).toLowerCase();
  return ext === '.cbr' || ext === '.rar';
}

/**
 * Check if file is a PDF by extension
 */
function isPdfFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.pdf';
}

/**
 * Detect archive format by reading magic bytes from the file header.
 * Reads only 8 bytes — negligible I/O cost.
 *
 * Magic byte signatures:
 * - ZIP: 50 4B 03 04
 * - RAR: 52 61 72 21 1A 07
 * - PDF: 25 50 44 46
 */
async function detectArchiveFormat(archivePath: string): Promise<ArchiveType> {
  let fh: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    fh = await fs.open(archivePath, 'r');
    const buf = Buffer.alloc(8);
    await fh.read(buf, 0, 8, 0);

    // ZIP: PK\x03\x04
    if (buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04) {
      return 'zip';
    }
    // RAR: Rar!\x1a\x07
    if (buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21
      && buf[4] === 0x1A && buf[5] === 0x07) {
      return 'rar';
    }
    // PDF: %PDF
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
      return 'pdf';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  } finally {
    await fh?.close();
  }
}

/**
 * Get the archive format based on file extension
 */
function getFormatByExtension(archivePath: string): ArchiveType {
  if (isPdfFile(archivePath)) return 'pdf';
  if (isRarArchive(archivePath)) return 'rar';
  return 'zip';
}

/**
 * Extract a page using the extension-based format detection
 */
async function extractByExtension(
  archivePath: string,
  pageNumber: number,
  pageStart?: number,
  pageEnd?: number
): Promise<ExtractedPageResult | ExtractionError> {
  return extractByFormat(getFormatByExtension(archivePath), archivePath, pageNumber, pageStart, pageEnd);
}

/**
 * Extract a page using a specific archive format
 */
async function extractByFormat(
  format: ArchiveType,
  archivePath: string,
  pageNumber: number,
  pageStart?: number,
  pageEnd?: number
): Promise<ExtractedPageResult | ExtractionError> {
  switch (format) {
    case 'pdf':
      return extractPageFromPdfFile(archivePath, pageNumber);
    case 'rar':
      return extractPageFromRarArchive(archivePath, pageNumber);
    case 'zip':
      return extractPageFromZipArchive(archivePath, pageNumber, pageStart, pageEnd);
    default:
      return { code: 'EXTRACTION_FAILED', message: `Unsupported archive format: ${format}` };
  }
}

/**
 * Extracts a specific page from a CBZ/ZIP/CBR/RAR archive
 *
 * Automatically detects archive type and uses appropriate extraction method:
 * - ZIP/CBZ: Uses yauzl (streaming, memory-bounded)
 * - RAR/CBR: Uses node-unrar-js
 *
 * When pageStart is provided (volume files), translates the chapter-relative
 * page number to the absolute page within the archive.
 *
 * @param archivePath - Path to the archive file
 * @param pageNumber - 1-indexed page number (chapter-relative)
 * @param mangaId - Manga ID for caching
 * @param chapterId - Chapter ID for caching
 * @param pageStart - Optional 1-indexed start page within archive (for volume files)
 * @param pageEnd - Optional 1-indexed end page within archive (for volume files)
 * @returns ExtractedPageResult if successful, ExtractionError if failed
 */
async function performExtraction(
  archivePath: string,
  archivePageNumber: number,
  pageStart?: number,
  pageEnd?: number
): Promise<ExtractedPageResult | ExtractionError> {
  const innerExtraction = extractByExtension(archivePath, archivePageNumber, pageStart, pageEnd);
  const timeoutPromise = new Promise<ExtractionError>((resolve) => {
    setTimeout(() => resolve({
      code: 'EXTRACTION_TIMEOUT',
      message: `Archive extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000}s`,
    }), EXTRACTION_TIMEOUT_MS);
  });

  let result = await Promise.race([innerExtraction, timeoutPromise]);

  if (isExtractionError(result) && result.code === 'EXTRACTION_FAILED') {
    const detectedFormat = await detectArchiveFormat(archivePath);
    const extensionFormat = getFormatByExtension(archivePath);

    if (detectedFormat !== 'unknown' && detectedFormat !== extensionFormat) {
      logger.warn('Archive format mismatch — retrying with detected format', {
        archivePath, extensionFormat, detectedFormat,
      });
      result = await extractByFormat(detectedFormat, archivePath, archivePageNumber, pageStart, pageEnd);
    }
  }

  return result;
}

// eslint-disable-next-line max-params -- pageStart/pageEnd are optional volume-file page range params
export async function extractPageFromArchive(
  archivePath: string,
  pageNumber: number,
  mangaId: number,
  chapterId: number,
  pageStart?: number,
  pageEnd?: number
): Promise<ExtractedPageResult | ExtractionError> {
  // Translate chapter-relative page to archive-absolute page when page range is set
  let archivePageNumber = pageNumber;
  if (pageStart !== undefined) {
    archivePageNumber = pageStart + pageNumber - 1;

    // Validate we don't exceed the page range
    if (pageEnd !== undefined && archivePageNumber > pageEnd) {
      return {
        code: 'PAGE_OUT_OF_RANGE',
        message: `Page ${pageNumber} exceeds chapter boundary (pages ${pageStart}-${pageEnd} in archive)`,
      };
    }
  }

  // Guard: reject archives that are too large to safely load into memory
  try {
    const stats = await fs.stat(archivePath);
    if (stats.size > MAX_ARCHIVE_SIZE_BYTES) {
      return {
        code: 'ARCHIVE_TOO_LARGE',
        message: `Archive is ${Math.round(stats.size / 1024 / 1024)}MB, exceeding the ${MAX_ARCHIVE_SIZE_BYTES / 1024 / 1024}MB limit`,
      };
    }
  } catch {
    return { code: 'EXTRACTION_FAILED', message: 'Unable to read archive file' };
  }

  // Per-archive lock: if another request is already extracting the same page from this archive,
  // wait for it instead of loading the archive into memory a second time.
  const lockKey = `${archivePath}:${archivePageNumber}`;
  const existingLock = extractionLocks.get(lockKey);
  if (existingLock) {
    return existingLock;
  }

  // Concurrency gate: limit total simultaneous archive extractions
  if (activeExtractions >= MAX_CONCURRENT_EXTRACTIONS) {
    return { code: 'EXTRACTION_FAILED', message: 'Too many concurrent archive extractions — try again shortly' };
  }
  activeExtractions++;

  // Route to appropriate extractor — locked per archive+page to prevent concurrent full-archive loads
  const lockedPromise = performExtraction(archivePath, archivePageNumber, pageStart, pageEnd)
    .then((result) => {
      if (!isExtractionError(result)) {
        cacheExtractedPage(mangaId, chapterId, pageNumber, result.extension, result.buffer);
      }
      return result;
    })
    .finally(() => {
      extractionLocks.delete(lockKey);
      activeExtractions--;
    });

  extractionLocks.set(lockKey, lockedPromise);
  return lockedPromise;
}

/**
 * Extracts a specific page from a RAR/CBR archive
 */
async function extractPageFromRarArchive(
  archivePath: string,
  pageNumber: number
): Promise<ExtractedPageResult | ExtractionError> {
  try {
    // Convert 1-indexed page number to 0-indexed
    const pageIndex = pageNumber - 1;

    const result = await extractPageFromRar(archivePath, pageIndex);

    if (result.status === 'error') {
      logger.error('RAR page extraction failed:', result.error);
      return {
        code: 'EXTRACTION_FAILED',
        message: result.error.message
      };
    }

    if (result.status !== 'success') {
      return {
        code: 'EXTRACTION_FAILED',
        message: 'Unexpected RAR extraction status'
      };
    }

    const { name, data, totalPages } = result.data;
    const extension = path.extname(name).toLowerCase();
    const contentType = getContentType(extension);

    return {
      buffer: data,
      contentType,
      extension,
      totalPagesInArchive: totalPages
    };
  } catch (error) {
    logger.error('Error extracting page from RAR archive:', error);
    return {
      code: 'EXTRACTION_FAILED',
      message: 'Failed to extract page from RAR archive'
    };
  }
}

/**
 * Render a single PDF page to PNG and free native mupdf resources.
 */
function renderPdfPageToPng(
  mupdf: typeof import('mupdf'),
  doc: ReturnType<typeof import('mupdf').Document.openDocument>,
  pageIndex: number
): Buffer {
  const page = doc.loadPage(pageIndex);
  try {
    const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB);
    try {
      return Buffer.from(pixmap.asPNG());
    } finally {
      pixmap.destroy();
    }
  } finally {
    page.destroy();
  }
}

/**
 * Extracts a specific page from a PDF file.
 * Uses mupdf to render the page to a PNG image.
 * Resources are explicitly freed to avoid native memory leaks.
 */
async function extractPageFromPdfFile(
  pdfPath: string,
  pageNumber: number
): Promise<ExtractedPageResult | ExtractionError> {
  let doc: ReturnType<typeof import('mupdf').Document.openDocument> | null = null;

  try {
    const mupdf = await import('mupdf');
    const buffer = await fs.readFile(pdfPath);
    doc = mupdf.Document.openDocument(buffer, 'application/pdf');
    const totalPages = doc.countPages();

    if (pageNumber < 1 || pageNumber > totalPages) {
      return {
        code: 'PAGE_OUT_OF_RANGE',
        message: `Page ${pageNumber} does not exist (PDF has ${totalPages} pages)`,
      };
    }

    // Render at 2x scale for quality (default 72 DPI → 144 DPI)
    const pngBuffer = renderPdfPageToPng(mupdf, doc, pageNumber - 1);

    return {
      buffer: pngBuffer,
      contentType: 'image/png',
      extension: '.png',
      totalPagesInArchive: totalPages,
    };
  } catch (error) {
    logger.error('Error extracting page from PDF:', error);
    return {
      code: 'EXTRACTION_FAILED',
      message: 'Failed to extract page from PDF',
    };
  } finally {
    doc?.destroy();
  }
}

/**
 * Extracts a specific page from a ZIP/CBZ archive using yauzl streaming.
 *
 * Memory usage is bounded by the central directory (~tens of KB for a 100+
 * entry archive) plus the single extracted page (~1-5 MB). The archive total
 * size is never loaded into RAM, so multi-hundred-MB color volumes read fine.
 *
 * Previous JSZip impl read the whole archive into a Buffer up front, which
 * imposed the 500 MB MAX_ARCHIVE_SIZE_BYTES guard and made One Piece color
 * volumes (700+ MB) unreadable.
 */
async function extractPageFromZipArchive(
  archivePath: string,
  pageNumber: number,
  pageStart?: number,
  pageEnd?: number
): Promise<ExtractedPageResult | ExtractionError> {
  let zipfile: yauzl.ZipFile | null = null;
  try {
    zipfile = await openZipfile(archivePath);
    const entriesByName = await collectImageEntries(zipfile);

    const sortedNames = [...entriesByName.keys()].sort(naturalSortCompare);

    if (pageNumber < 1 || pageNumber > sortedNames.length) {
      return {
        code: 'PAGE_OUT_OF_RANGE',
        message: `Page ${pageNumber} does not exist (archive has ${sortedNames.length} pages)`
      };
    }

    const pageFilename = sortedNames[pageNumber - 1];
    if (!pageFilename) {
      return { code: 'PAGE_NOT_FOUND', message: 'Page file not found in archive' };
    }
    const entry = entriesByName.get(pageFilename);
    if (!entry) {
      return { code: 'PAGE_FILE_MISSING', message: 'Page file missing from archive' };
    }

    const pageBuffer = await readEntryBuffer(zipfile, entry);
    const extension = path.extname(pageFilename).toLowerCase();
    const contentType = getContentType(extension);

    const effectiveTotal = (pageStart !== undefined && pageEnd !== undefined)
      ? (pageEnd - pageStart + 1)
      : sortedNames.length;

    return { buffer: pageBuffer, contentType, extension, totalPagesInArchive: effectiveTotal };
  } catch (error) {
    logger.error('Error extracting page from archive:', error);
    return { code: 'EXTRACTION_FAILED', message: 'Failed to extract page from archive' };
  } finally {
    zipfile?.close();
  }
}

/**
 * Type guard to check if result is an error
 */
export function isExtractionError(
  result: ExtractedPageResult | ExtractionError
): result is ExtractionError {
  return 'code' in result && 'message' in result && !('buffer' in result);
}

/**
 * Serves an extracted page with appropriate headers
 */
export function serveExtractedPage(
  res: NextApiResponse,
  page: ExtractedPageResult,
  pageNumber: number
): void {
  res.setHeader('Content-Type', page.contentType);
  res.setHeader('Content-Length', page.buffer.length.toString());
  res.setHeader('X-Page-Number', pageNumber.toString());
  res.setHeader('X-Total-Pages', page.totalPagesInArchive.toString());
  res.setHeader('X-Cache-Status', 'MISS');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(page.buffer);
}
