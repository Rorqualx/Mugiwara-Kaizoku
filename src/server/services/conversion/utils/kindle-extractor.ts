/**
 * Kindle Format Extraction Utility
 *
 * Provides extraction for MOBI and AZW3 (KF8) Kindle formats using @lingo-reader/mobi-parser.
 * Extracts images from ebook files for conversion to CBZ/EPUB formats.
 *
 * Note: Only DRM-free files can be processed.
 *
 * @module kindle-extractor
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
 * Kindle extraction result
 */
export interface KindleExtractionResult {
  /** Array of extracted image files */
  files: ExtractedFile[];
  /** Total number of chapters in book */
  totalChapters: number;
  /** Number of images extracted */
  extractedCount: number;
  /** Book metadata */
  metadata?: KindleMetadata;
}

/**
 * Kindle book metadata
 */
export interface KindleMetadata {
  title?: string;
  author?: string;
  language?: string;
  publisher?: string;
  description?: string;
  isbn?: string;
  asin?: string;
  publicationDate?: string;
}

/**
 * Supported image extensions for extraction
 */
const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

/**
 * Check if a string appears to be an image URL or blob
 */
function isImageData(str: string): boolean {
  if (str.startsWith('data:image/') || str.startsWith('blob:')) {
    return true;
  }
  const lowerStr = str.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some(ext => lowerStr.endsWith(ext));
}

/**
 * Convert a blob URL or data URL to Buffer
 */
async function urlToBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('data:')) {
      // Handle data URL
      const [header, base64Data] = url.split(',');
      if (!base64Data || !header) return null;
      return Buffer.from(base64Data, 'base64');
    }
    // For blob URLs, we need to fetch them
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Get image extension from mime type or URL
 */
function getImageExtension(url: string): string {
  if (url.startsWith('data:image/')) {
    const match = url.match(/data:image\/(\w+)/);
    if (match?.[1]) {
      const type = match[1].toLowerCase();
      return type === 'jpeg' ? '.jpg' : `.${type}`;
    }
  }
  for (const ext of SUPPORTED_IMAGE_EXTENSIONS) {
    if (url.toLowerCase().includes(ext)) {
      return ext;
    }
  }
  return '.png'; // Default
}

/**
 * Extract images from a MOBI file
 *
 * @param mobiPath - Path to the MOBI file
 * @returns AsyncResult with extracted images
 */
export async function extractImagesFromMobi(
  mobiPath: string
): Promise<AsyncResult<KindleExtractionResult, Error>> {
  try {
    logger.debug(`[KindleExtractor] Extracting images from MOBI: ${mobiPath}`);

    // Read the file
    const fileData = await fs.readFile(mobiPath);

    // Dynamically import to avoid bundling issues
    const { initMobiFile } = await import('@lingo-reader/mobi-parser');

    // Initialize the MOBI parser - convert Buffer to Uint8Array
    const mobi = await initMobiFile(new Uint8Array(fileData));

    // Get metadata
    const rawMetadata = mobi.getMetadata();
    const metadata: KindleMetadata = {
      title: rawMetadata.title,
      author: Array.isArray(rawMetadata.author) ? rawMetadata.author.join(', ') : rawMetadata.author,
      language: rawMetadata.language,
      publisher: rawMetadata.publisher,
      description: rawMetadata.description
    };

    logger.info(`[KindleExtractor] MOBI metadata: ${metadata.title ?? 'Unknown'} by ${metadata.author ?? 'Unknown'}`);

    const files: ExtractedFile[] = [];

    // Try to get cover image
    const coverUrl = mobi.getCoverImage();
    if (coverUrl && isImageData(coverUrl)) {
      const coverBuffer = await urlToBuffer(coverUrl);
      if (coverBuffer) {
        const ext = getImageExtension(coverUrl);
        files.push({
          name: `page_0000${ext}`,
          data: coverBuffer
        });
        logger.debug(`[KindleExtractor] Extracted cover image (${coverBuffer.length} bytes)`);
      }
    }

    // Get spine (chapters) and extract images from each
    const spine = mobi.getSpine();
    const totalChapters = spine.length;

    logger.info(`[KindleExtractor] Processing ${totalChapters} chapters`);

    for (let i = 0; i < spine.length; i++) {
      const chapter = spine[i];
      if (!chapter) continue;

      const chapterContent = mobi.loadChapter(chapter.id);
      if (!chapterContent?.html) continue;

      // Extract image sources from HTML
      const imgMatches = chapterContent.html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);

      for (const match of imgMatches) {
        const imgSrc = match[1];
        if (!imgSrc || !isImageData(imgSrc)) continue;

        // eslint-disable-next-line no-await-in-loop -- Sequential extraction required to maintain page order
        const imgBuffer = await urlToBuffer(imgSrc);
        if (imgBuffer) {
          const ext = getImageExtension(imgSrc);
          const paddedNum = String(files.length + 1).padStart(4, '0');
          files.push({
            name: `page_${paddedNum}${ext}`,
            data: imgBuffer
          });
          logger.debug(`[KindleExtractor] Extracted image from chapter ${i + 1}: page_${paddedNum}${ext}`);
        }
      }
    }

    logger.info(`[KindleExtractor] Extraction complete: ${files.length} images from ${totalChapters} chapters`);

    return createSuccessResult({
      files,
      totalChapters,
      extractedCount: files.length,
      metadata
    });
  } catch (error: unknown) {
    logger.error('[KindleExtractor] MOBI extraction failed:', error);

    // Check for DRM error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.toLowerCase().includes('drm')) {
      return createErrorResult(new Error('This MOBI file is DRM-protected and cannot be processed'));
    }

    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Extract images from an AZW3 (KF8) file
 *
 * @param azw3Path - Path to the AZW3 file
 * @returns AsyncResult with extracted images
 */
export async function extractImagesFromAzw3(
  azw3Path: string
): Promise<AsyncResult<KindleExtractionResult, Error>> {
  try {
    logger.debug(`[KindleExtractor] Extracting images from AZW3: ${azw3Path}`);

    // Read the file
    const fileData = await fs.readFile(azw3Path);

    // Dynamically import to avoid bundling issues
    const { initKf8File } = await import('@lingo-reader/mobi-parser');

    // Initialize the KF8/AZW3 parser - convert Buffer to Uint8Array
    const kf8 = await initKf8File(new Uint8Array(fileData));

    // Get metadata
    const rawMetadata = kf8.getMetadata();
    const metadata: KindleMetadata = {
      title: rawMetadata.title,
      author: Array.isArray(rawMetadata.author) ? rawMetadata.author.join(', ') : rawMetadata.author,
      language: rawMetadata.language,
      publisher: rawMetadata.publisher,
      description: rawMetadata.description
    };

    logger.info(`[KindleExtractor] AZW3 metadata: ${metadata.title ?? 'Unknown'} by ${metadata.author ?? 'Unknown'}`);

    const files: ExtractedFile[] = [];

    // Try to get cover image
    const coverUrl = kf8.getCoverImage();
    if (coverUrl && isImageData(coverUrl)) {
      const coverBuffer = await urlToBuffer(coverUrl);
      if (coverBuffer) {
        const ext = getImageExtension(coverUrl);
        files.push({
          name: `page_0000${ext}`,
          data: coverBuffer
        });
        logger.debug(`[KindleExtractor] Extracted cover image (${coverBuffer.length} bytes)`);
      }
    }

    // Get spine (chapters) and extract images from each
    const spine = kf8.getSpine();
    const totalChapters = spine.length;

    logger.info(`[KindleExtractor] Processing ${totalChapters} chapters`);

    for (let i = 0; i < spine.length; i++) {
      const chapter = spine[i];
      if (!chapter) continue;

      const chapterContent = kf8.loadChapter(chapter.id);
      if (!chapterContent?.html) continue;

      // Extract image sources from HTML
      const imgMatches = chapterContent.html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);

      for (const match of imgMatches) {
        const imgSrc = match[1];
        if (!imgSrc || !isImageData(imgSrc)) continue;

        // eslint-disable-next-line no-await-in-loop -- Sequential extraction required to maintain page order
        const imgBuffer = await urlToBuffer(imgSrc);
        if (imgBuffer) {
          const ext = getImageExtension(imgSrc);
          const paddedNum = String(files.length + 1).padStart(4, '0');
          files.push({
            name: `page_${paddedNum}${ext}`,
            data: imgBuffer
          });
          logger.debug(`[KindleExtractor] Extracted image from chapter ${i + 1}: page_${paddedNum}${ext}`);
        }
      }
    }

    logger.info(`[KindleExtractor] Extraction complete: ${files.length} images from ${totalChapters} chapters`);

    return createSuccessResult({
      files,
      totalChapters,
      extractedCount: files.length,
      metadata
    });
  } catch (error: unknown) {
    logger.error('[KindleExtractor] AZW3 extraction failed:', error);

    // Check for DRM error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.toLowerCase().includes('drm')) {
      return createErrorResult(new Error('This AZW3 file is DRM-protected and cannot be processed'));
    }

    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Get metadata from a Kindle file without full extraction
 *
 * @param filePath - Path to the MOBI or AZW3 file
 * @param format - File format ('mobi' or 'azw3')
 * @returns AsyncResult with book metadata
 */
export async function getKindleMetadata(
  filePath: string,
  format: 'mobi' | 'azw3'
): Promise<AsyncResult<KindleMetadata, Error>> {
  try {
    const fileData = await fs.readFile(filePath);
    const { initMobiFile, initKf8File } = await import('@lingo-reader/mobi-parser');

    const parser = format === 'mobi'
      ? await initMobiFile(new Uint8Array(fileData))
      : await initKf8File(new Uint8Array(fileData));

    const rawMetadata = parser.getMetadata();

    return createSuccessResult({
      title: rawMetadata.title,
      author: Array.isArray(rawMetadata.author) ? rawMetadata.author.join(', ') : rawMetadata.author,
      language: rawMetadata.language,
      publisher: rawMetadata.publisher,
      description: rawMetadata.description
    });
  } catch (error: unknown) {
    logger.error('[KindleExtractor] Metadata extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check if a file is a valid MOBI file
 *
 * @param filePath - Path to the file
 * @returns AsyncResult with true if valid MOBI
 */
export async function isValidMobi(
  filePath: string
): Promise<AsyncResult<boolean, Error>> {
  try {
    const fileData = await fs.readFile(filePath);
    const { initMobiFile } = await import('@lingo-reader/mobi-parser');

    // Try to initialize - will throw if invalid
    await initMobiFile(new Uint8Array(fileData));

    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  }
}

/**
 * Check if a file is a valid AZW3 file
 *
 * @param filePath - Path to the file
 * @returns AsyncResult with true if valid AZW3
 */
export async function isValidAzw3(
  filePath: string
): Promise<AsyncResult<boolean, Error>> {
  try {
    const fileData = await fs.readFile(filePath);
    const { initKf8File } = await import('@lingo-reader/mobi-parser');

    // Try to initialize - will throw if invalid
    await initKf8File(new Uint8Array(fileData));

    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  }
}

/**
 * Detect the Kindle format from file extension
 *
 * @param filePath - Path to the file
 * @returns 'mobi', 'azw3', or null if not a Kindle format
 */
export function detectKindleFormat(filePath: string): 'mobi' | 'azw3' | null {
  const ext = filePath.toLowerCase().split('.').pop();

  switch (ext) {
    case 'mobi':
    case 'prc':
      return 'mobi';
    case 'azw3':
    case 'azw':
    case 'kf8':
      return 'azw3';
    default:
      return null;
  }
}

/**
 * Extract images from a Kindle file (auto-detect format)
 *
 * @param filePath - Path to the MOBI or AZW3 file
 * @returns AsyncResult with extracted images
 */
export async function extractImagesFromKindle(
  filePath: string
): Promise<AsyncResult<KindleExtractionResult, Error>> {
  const format = detectKindleFormat(filePath);

  if (!format) {
    return createErrorResult(new Error(`Unsupported Kindle format: ${filePath}`));
  }

  return format === 'mobi'
    ? extractImagesFromMobi(filePath)
    : extractImagesFromAzw3(filePath);
}
