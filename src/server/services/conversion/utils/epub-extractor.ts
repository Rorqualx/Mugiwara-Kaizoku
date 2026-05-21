/**
 * EPUB Extraction Utility
 *
 * Provides EPUB image extraction using JSZip.
 * EPUB files are ZIP archives containing XHTML and images.
 * Extracts images for conversion to CBZ format.
 *
 * @module epub-extractor
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import JSZip from 'jszip';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/**
 * Supported image extensions for extraction
 */
const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];

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
 * EPUB extraction result
 */
export interface EpubExtractionResult {
  /** Array of extracted image files */
  files: ExtractedFile[];
  /** Total number of files in EPUB */
  totalFiles: number;
  /** Number of images extracted */
  extractedCount: number;
  /** Number of non-image files skipped */
  skippedCount: number;
  /** EPUB metadata if available */
  metadata?: EpubMetadata;
}

/**
 * EPUB metadata from content.opf
 */
export interface EpubMetadata {
  title?: string;
  author?: string;
  language?: string;
  identifier?: string;
  publisher?: string;
  description?: string;
}

/**
 * Check if a file extension is a supported image type
 */
function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Parse EPUB content.opf to get spine order and metadata
 */
async function parseContentOpf(
  zip: JSZip,
  opfPath: string
): Promise<{ imageOrder: string[]; metadata: EpubMetadata }> {
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    return { imageOrder: [], metadata: {} };
  }

  const opfContent = await opfFile.async('text');
  const metadata: EpubMetadata = {};
  const imageOrder: string[] = [];

  // Extract basic metadata using regex (avoiding full XML parser)
  const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
  if (titleMatch?.[1]) {
    metadata.title = titleMatch[1];
  }

  const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
  if (authorMatch?.[1]) {
    metadata.author = authorMatch[1];
  }

  const languageMatch = opfContent.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
  if (languageMatch?.[1]) {
    metadata.language = languageMatch[1];
  }

  // Extract manifest items to build image order
  const manifestRegex = /<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"[^>]*>/gi;
  const manifestItems = new Map<string, string>();
  let manifestMatch;

  while ((manifestMatch = manifestRegex.exec(opfContent)) !== null) {
    const [, id, href] = manifestMatch;
    if (id && href) {
      manifestItems.set(id, href);
    }
  }

  // Extract spine order
  const spineRegex = /<itemref[^>]+idref="([^"]+)"[^>]*>/gi;
  let spineMatch;

  while ((spineMatch = spineRegex.exec(opfContent)) !== null) {
    const idref = spineMatch[1];
    if (idref) {
      const href = manifestItems.get(idref);
      if (href && isImageFile(href)) {
        // Get directory of OPF file to resolve relative paths
        const opfDir = path.dirname(opfPath);
        const fullPath = opfDir ? `${opfDir}/${href}` : href;
        imageOrder.push(fullPath.replace(/\\/g, '/'));
      }
    }
  }

  return { imageOrder, metadata };
}

/**
 * Find the content.opf path from container.xml
 */
async function findContentOpfPath(zip: JSZip): Promise<string | null> {
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    return null;
  }

  const containerContent = await containerFile.async('text');
  const rootfileMatch = containerContent.match(/full-path="([^"]+\.opf)"/i);

  return rootfileMatch?.[1] ?? null;
}

/**
 * Extract images from an EPUB file using JSZip
 *
 * Images are extracted in reading order if possible (using spine),
 * otherwise in natural sort order.
 *
 * @param epubPath - Path to the EPUB file
 * @returns AsyncResult with extracted image files
 */
export async function extractImagesFromEpub(
  epubPath: string
): Promise<AsyncResult<EpubExtractionResult, Error>> {
  try {
    logger.debug(`[EpubExtractor] Extracting images from: ${epubPath}`);

    // Read the EPUB file
    const epubData = await fs.readFile(epubPath);

    // Load as ZIP
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(epubData);

    // Find content.opf for metadata and image order
    const opfPath = await findContentOpfPath(zipContent);
    let metadata: EpubMetadata = {};
    let imageOrder: string[] = [];

    if (opfPath) {
      const parsed = await parseContentOpf(zipContent, opfPath);
      metadata = parsed.metadata;
      imageOrder = parsed.imageOrder;
      logger.debug(`[EpubExtractor] Found OPF at: ${opfPath}, spine has ${imageOrder.length} items`);
    }

    // Get all image files in the EPUB
    const allFiles = Object.entries(zipContent.files);
    const imageFiles = allFiles.filter(([filename, file]) => {
      if (file.dir) return false;
      return isImageFile(filename);
    });

    const totalFiles = allFiles.length;
    const skippedCount = totalFiles - imageFiles.length;

    // Create a map of normalized paths to file entries
    const imageMap = new Map<string, [string, JSZip.JSZipObject]>();
    for (const entry of imageFiles) {
      const [filename] = entry;
      const normalized = filename.replace(/\\/g, '/').toLowerCase();
      imageMap.set(normalized, entry);
    }

    // Build extraction order - prefer spine order, then natural sort
    const orderedImages: Array<[string, JSZip.JSZipObject]> = [];
    const usedPaths = new Set<string>();

    // First, add images from spine order
    for (const spinePath of imageOrder) {
      const normalized = spinePath.toLowerCase();
      const entry = imageMap.get(normalized);
      if (entry && !usedPaths.has(normalized)) {
        orderedImages.push(entry);
        usedPaths.add(normalized);
      }
    }

    // Then add remaining images (not in spine) sorted by name
    const remainingImages = imageFiles
      .filter(([filename]) => !usedPaths.has(filename.replace(/\\/g, '/').toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0], undefined, {
        numeric: true,
        sensitivity: 'base'
      }));

    orderedImages.push(...remainingImages);

    // Extract images
    const files: ExtractedFile[] = [];

    for (let i = 0; i < orderedImages.length; i++) {
      const entry = orderedImages[i];
      if (!entry) continue;

      const [filename, file] = entry;
      // eslint-disable-next-line no-await-in-loop -- Sequential extraction required to maintain page order
      const imageData = await file.async('nodebuffer');
      const ext = path.extname(filename).toLowerCase();

      // Rename to sequential page numbers for consistent ordering
      const paddedNum = String(i + 1).padStart(4, '0');
      const newName = `page_${paddedNum}${ext}`;

      files.push({
        name: newName,
        data: imageData
      });

      logger.debug(`[EpubExtractor] Extracted: ${filename} -> ${newName} (${imageData.length} bytes)`);
    }

    logger.info(`[EpubExtractor] Extraction complete: ${files.length} images from ${totalFiles} total files`);

    return createSuccessResult({
      files,
      totalFiles,
      extractedCount: files.length,
      skippedCount,
      metadata
    });
  } catch (error: unknown) {
    logger.error('[EpubExtractor] Extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Extract a single image from an EPUB by index
 *
 * @param epubPath - Path to the EPUB file
 * @param pageIndex - Zero-based page index
 * @returns AsyncResult with the extracted image data
 */
export async function extractPageFromEpub(
  epubPath: string,
  pageIndex: number
): Promise<AsyncResult<ExtractedFile & { totalPages: number }, Error>> {
  try {
    logger.debug(`[EpubExtractor] Extracting page ${pageIndex} from: ${epubPath}`);

    // For single page extraction, we still need to get all images to determine order
    const result = await extractImagesFromEpub(epubPath);

    if (result.status === 'error') {
      return createErrorResult(result.error);
    }

    if (result.status !== 'success') {
      return createErrorResult(new Error('Unexpected extraction status'));
    }

    const { files } = result.data;

    if (pageIndex < 0 || pageIndex >= files.length) {
      return createErrorResult(new Error(
        `Page index ${pageIndex} out of range (0-${files.length - 1})`
      ));
    }

    const file = files[pageIndex];
    if (!file) {
      return createErrorResult(new Error('Target page not found'));
    }

    return createSuccessResult({
      name: file.name,
      data: file.data,
      totalPages: files.length
    });
  } catch (error: unknown) {
    logger.error('[EpubExtractor] Page extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Get the list of image files in an EPUB without extracting content
 *
 * @param epubPath - Path to the EPUB file
 * @returns AsyncResult with list of image filenames
 */
export async function listEpubImages(
  epubPath: string
): Promise<AsyncResult<string[], Error>> {
  try {
    const epubData = await fs.readFile(epubPath);
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(epubData);

    const imageFiles = Object.keys(zipContent.files)
      .filter(filename => {
        const file = zipContent.files[filename];
        return file && !file.dir && isImageFile(filename);
      })
      .sort((a, b) => a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base'
      }));

    return createSuccessResult(imageFiles);
  } catch (error: unknown) {
    logger.error('[EpubExtractor] List failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Get EPUB metadata without extracting images
 *
 * @param epubPath - Path to the EPUB file
 * @returns AsyncResult with EPUB metadata
 */
export async function getEpubMetadata(
  epubPath: string
): Promise<AsyncResult<EpubMetadata, Error>> {
  try {
    const epubData = await fs.readFile(epubPath);
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(epubData);

    const opfPath = await findContentOpfPath(zipContent);
    if (!opfPath) {
      return createSuccessResult({});
    }

    const { metadata } = await parseContentOpf(zipContent, opfPath);
    return createSuccessResult(metadata);
  } catch (error: unknown) {
    logger.error('[EpubExtractor] Metadata extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check if a file is a valid EPUB
 *
 * @param epubPath - Path to the file
 * @returns AsyncResult with true if valid EPUB
 */
export async function isValidEpub(
  epubPath: string
): Promise<AsyncResult<boolean, Error>> {
  try {
    const epubData = await fs.readFile(epubPath);
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(epubData);

    // Check for required EPUB files
    const hasContainer = zipContent.file('META-INF/container.xml') !== null;
    const mimetypeFile = zipContent.file('mimetype');

    if (!hasContainer) {
      return createSuccessResult(false);
    }

    // Check mimetype if present
    if (mimetypeFile) {
      const mimetype = await mimetypeFile.async('text');
      if (!mimetype.trim().startsWith('application/epub+zip')) {
        return createSuccessResult(false);
      }
    }

    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  }
}
