/**
 * PDF Extraction Utility
 *
 * Provides PDF image extraction using mupdf.
 * Renders PDF pages as images for conversion to CBZ/EPUB formats.
 *
 * @module pdf-extractor
 */

import * as fs from 'fs/promises';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/**
 * Extracted file data
 */
export interface ExtractedFile {
  /** Original filename from archive */
  name: string;
  /** File data as Buffer */
  data: Buffer;
}

/**
 * PDF extraction result
 */
export interface PdfExtractionResult {
  /** Array of extracted page images */
  files: ExtractedFile[];
  /** Total number of pages in PDF */
  totalPages: number;
  /** Number of pages extracted */
  extractedCount: number;
}

/**
 * PDF extraction options
 */
export interface PdfExtractionOptions {
  /** DPI for rendering (default: 150) */
  dpi?: number;
  /** Output format: 'png' | 'jpeg' (default: 'png') */
  format?: 'png' | 'jpeg';
  /** JPEG quality if format is jpeg (1-100, default: 90) */
  quality?: number;
}

const DEFAULT_OPTIONS: Required<PdfExtractionOptions> = {
  dpi: 150,
  format: 'png',
  quality: 90
};

/**
 * Render a single PDF page to an image buffer, freeing native mupdf resources.
 */
function renderPageToImage(
  mupdf: typeof import('mupdf'),
  doc: ReturnType<typeof import('mupdf').Document.openDocument>,
  pageIndex: number,
  opts: Required<PdfExtractionOptions>
): { data: Uint8Array; ext: string } {
  const page = doc.loadPage(pageIndex);
  try {
    const scale = opts.dpi / 72;
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true
    );
    try {
      if (opts.format === 'jpeg') {
        return { data: pixmap.asJPEG(opts.quality), ext: '.jpg' };
      }
      return { data: pixmap.asPNG(), ext: '.png' };
    } finally {
      pixmap.destroy();
    }
  } finally {
    page.destroy();
  }
}

/**
 * Extract all pages from a PDF as images using mupdf
 *
 * @param pdfPath - Path to the PDF file
 * @param options - Extraction options
 * @returns AsyncResult with extracted page images
 */
export async function extractImagesFromPdf(
  pdfPath: string,
  options: PdfExtractionOptions = {}
): Promise<AsyncResult<PdfExtractionResult, Error>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let doc: ReturnType<typeof import('mupdf').Document.openDocument> | null = null;

  try {
    const mupdf = await import('mupdf');

    logger.debug(`[PdfExtractor] Extracting pages from: ${pdfPath}`);

    const pdfData = await fs.readFile(pdfPath);
    doc = mupdf.Document.openDocument(pdfData, 'application/pdf');
    const totalPages = doc.countPages();

    logger.info(`[PdfExtractor] PDF has ${totalPages} pages`);

    const files: ExtractedFile[] = [];

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      const { data: imageData, ext } = renderPageToImage(mupdf, doc, pageNum, opts);

      const paddedPageNum = String(pageNum + 1).padStart(4, '0');
      const filename = `page_${paddedPageNum}${ext}`;

      files.push({ name: filename, data: Buffer.from(imageData) });
      logger.debug(`[PdfExtractor] Extracted page ${pageNum + 1}: ${filename} (${imageData.length} bytes)`);
    }

    logger.info(`[PdfExtractor] Extraction complete: ${files.length} pages`);

    return createSuccessResult({ files, totalPages, extractedCount: files.length });
  } catch (error: unknown) {
    logger.error('[PdfExtractor] Extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    doc?.destroy();
  }
}

/**
 * Extract a single page from a PDF by index
 *
 * @param pdfPath - Path to the PDF file
 * @param pageIndex - Zero-based page index
 * @param options - Extraction options
 * @returns AsyncResult with the extracted page data
 */
export async function extractPageFromPdf(
  pdfPath: string,
  pageIndex: number,
  options: PdfExtractionOptions = {}
): Promise<AsyncResult<ExtractedFile & { totalPages: number }, Error>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let doc: ReturnType<typeof import('mupdf').Document.openDocument> | null = null;

  try {
    const mupdf = await import('mupdf');

    logger.debug(`[PdfExtractor] Extracting page ${pageIndex} from: ${pdfPath}`);

    const pdfData = await fs.readFile(pdfPath);
    doc = mupdf.Document.openDocument(pdfData, 'application/pdf');
    const totalPages = doc.countPages();

    if (pageIndex < 0 || pageIndex >= totalPages) {
      return createErrorResult(new Error(
        `Page index ${pageIndex} out of range (0-${totalPages - 1})`
      ));
    }

    const { data: imageData, ext } = renderPageToImage(mupdf, doc, pageIndex, opts);
    const paddedPageNum = String(pageIndex + 1).padStart(4, '0');
    const filename = `page_${paddedPageNum}${ext}`;

    return createSuccessResult({ name: filename, data: Buffer.from(imageData), totalPages });
  } catch (error: unknown) {
    logger.error('[PdfExtractor] Page extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    doc?.destroy();
  }
}

/**
 * Get the number of pages in a PDF without extracting
 *
 * @param pdfPath - Path to the PDF file
 * @returns AsyncResult with page count
 */
export async function getPdfPageCount(
  pdfPath: string
): Promise<AsyncResult<number, Error>> {
  let doc: ReturnType<typeof import('mupdf').Document.openDocument> | null = null;

  try {
    const mupdf = await import('mupdf');

    const pdfData = await fs.readFile(pdfPath);
    doc = mupdf.Document.openDocument(pdfData, 'application/pdf');

    return createSuccessResult(doc.countPages());
  } catch (error: unknown) {
    logger.error('[PdfExtractor] Page count failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    doc?.destroy();
  }
}

/**
 * Check if a file is a valid PDF
 *
 * @param pdfPath - Path to the file
 * @returns AsyncResult with true if valid PDF
 */
export async function isValidPdf(
  pdfPath: string
): Promise<AsyncResult<boolean, Error>> {
  let doc: ReturnType<typeof import('mupdf').Document.openDocument> | null = null;

  try {
    const mupdf = await import('mupdf');

    const pdfData = await fs.readFile(pdfPath);
    doc = mupdf.Document.openDocument(pdfData, 'application/pdf');
    doc.countPages(); // Will throw if invalid

    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  } finally {
    doc?.destroy();
  }
}

/**
 * Get PDF metadata
 *
 * @param pdfPath - Path to the PDF file
 * @returns AsyncResult with PDF metadata
 */
export async function getPdfMetadata(
  pdfPath: string
): Promise<AsyncResult<Record<string, string>, Error>> {
  let doc: ReturnType<typeof import('mupdf').Document.openDocument> | null = null;

  try {
    const mupdf = await import('mupdf');

    const pdfData = await fs.readFile(pdfPath);
    doc = mupdf.Document.openDocument(pdfData, 'application/pdf');

    const metadata: Record<string, string> = {};
    const metadataKeys = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'];

    for (const key of metadataKeys) {
      const value = doc.getMetaData(`info:${key}`);
      if (value) {
        metadata[key.toLowerCase()] = value;
      }
    }

    return createSuccessResult(metadata);
  } catch (error: unknown) {
    logger.error('[PdfExtractor] Metadata extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    doc?.destroy();
  }
}
