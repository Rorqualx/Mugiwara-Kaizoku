/**
 * EPUB Converter
 *
 * Handles conversion to EPUB format from manga archives.
 * Creates EPUB3 compliant e-books with embedded images optimized for e-readers.
 *
 * Supported conversions:
 * - CBZ/ZIP → EPUB
 * - CBR → EPUB
 * - 7z/CB7 → EPUB
 * - TAR/CBT → EPUB
 *
 * EPUB document construction lives in `EPUBConverter/epub-builder.ts`.
 *
 * @module EPUBConverter
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import JSZip from 'jszip';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseConverter } from '../BaseConverter';
import { extractImagesFromRar } from '../utils/rar-extractor';
import { extractImagesFrom7z } from '../utils/seven-zip-wrapper';
import { extractImagesFromTar } from '../utils/tar-wrapper';

import { createEPUB } from './EPUBConverter/epub-builder';

import type { ConversionOptions, ConversionResult, ConversionFormat } from '../BaseConverter';

const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];

interface ImageEntry {
  name: string;
  data: Buffer;
}

type ZipEntryTuple = [string, JSZip.JSZipObject];

function isSupportedImageEntry(entry: ZipEntryTuple): boolean {
  const [filename, file] = entry;
  if (file.dir) return false;
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

async function extractZipImageEntry(entry: ZipEntryTuple): Promise<ImageEntry> {
  const [filename, file] = entry;
  const data = await file.async('nodebuffer');
  return { name: filename, data };
}

function sortImagesByName(images: ImageEntry[]): ImageEntry[] {
  return images.sort((a, b) => a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: 'base'
  }));
}

export class EPUBConverter extends BaseConverter {
  constructor() {
    super('EPUBConverter');
  }

  getSupportedSourceFormats(): ConversionFormat[] {
    return ['cbz', 'zip', 'cbr', '7z', 'cb7', 'tar', 'cbt'];
  }

  getSupportedTargetFormats(): ConversionFormat[] {
    return ['epub'];
  }

  protected async doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    const startTime = Date.now();

    try {
      logger.info(`[${this.converterName}] Starting EPUB conversion`, {
        sourceFile: options.sourceFile,
        targetFile: options.targetFile
      });

      this.reportProgress(options, 0);

      logger.debug(`[${this.converterName}] Extracting images from source`);
      const extractResult = await this.extractImages(options.sourceFile);

      if (extractResult.status === 'error') {
        return createErrorResult(extractResult.error);
      }

      if (extractResult.status !== 'success') {
        return createErrorResult(new Error('Unexpected extraction status'));
      }

      const images = extractResult.data;
      logger.info(`[${this.converterName}] Extracted ${images.length} images`);
      this.reportProgress(options, 10);

      if (images.length === 0) {
        return createErrorResult(new Error('No images found in source archive'));
      }

      const sortedImages = sortImagesByName(images);
      this.reportProgress(options, 20);

      logger.debug(`[${this.converterName}] Creating EPUB structure`);
      const createResult = await createEPUB(
        sortedImages,
        options.targetFile,
        options.metadata ?? {},
        options.compression ?? 6,
        (progress) => this.reportProgress(options, 20 + (progress * 0.7))
      );

      if (createResult.status === 'error') {
        return createErrorResult(createResult.error);
      }

      this.reportProgress(options, 90);

      const stats = await fs.stat(options.targetFile);
      const duration = Date.now() - startTime;

      this.reportProgress(options, 100);

      const result: ConversionResult = {
        outputPath: options.targetFile,
        fileSize: stats.size,
        pageCount: images.length,
        duration,
        metadata: { format: 'EPUB3', imageCount: images.length }
      };

      logger.info(`[${this.converterName}] EPUB conversion completed`, {
        outputPath: result.outputPath,
        fileSize: result.fileSize,
        pageCount: result.pageCount,
        duration: `${duration}ms`
      });

      return createSuccessResult(result);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Conversion error`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async extractImages(archivePath: string): Promise<AsyncResult<ImageEntry[], Error>> {
    const ext = path.extname(archivePath).toLowerCase();

    if (ext === '.cbr' || ext === '.rar') {
      return this.extractImagesFromRarArchive(archivePath);
    }
    if (ext === '.cb7' || ext === '.7z') {
      return this.extractImagesFrom7zArchive(archivePath);
    }
    if (ext === '.cbt' || ext === '.tar') {
      return this.extractImagesFromTarArchive(archivePath);
    }
    return this.extractImagesFromZip(archivePath);
  }

  private async extractImagesFrom7zArchive(archivePath: string): Promise<AsyncResult<ImageEntry[], Error>> {
    try {
      logger.debug(`[${this.converterName}] Extracting from 7z/CB7: ${archivePath}`);
      const result = await extractImagesFrom7z(archivePath);
      if (result.status === 'error') return createErrorResult(result.error);
      if (result.status !== 'success') return createErrorResult(new Error('Unexpected 7z extraction status'));
      logger.info(`[${this.converterName}] 7z extraction complete: ${result.data.extractedCount} images`);
      return createSuccessResult(result.data.files);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to extract from 7z`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async extractImagesFromTarArchive(archivePath: string): Promise<AsyncResult<ImageEntry[], Error>> {
    try {
      logger.debug(`[${this.converterName}] Extracting from TAR/CBT: ${archivePath}`);
      const result = await extractImagesFromTar(archivePath);
      if (result.status === 'error') return createErrorResult(result.error);
      if (result.status !== 'success') return createErrorResult(new Error('Unexpected TAR extraction status'));
      logger.info(`[${this.converterName}] TAR extraction complete: ${result.data.extractedCount} images`);
      return createSuccessResult(result.data.files);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to extract from TAR`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async extractImagesFromRarArchive(archivePath: string): Promise<AsyncResult<ImageEntry[], Error>> {
    try {
      logger.debug(`[${this.converterName}] Extracting from RAR/CBR: ${archivePath}`);
      const result = await extractImagesFromRar(archivePath);
      if (result.status === 'error') return createErrorResult(result.error);
      if (result.status !== 'success') return createErrorResult(new Error('Unexpected RAR extraction status'));
      logger.info(`[${this.converterName}] RAR extraction complete: ${result.data.extractedCount} images`);
      return createSuccessResult(result.data.files);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to extract from RAR`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async extractImagesFromZip(archivePath: string): Promise<AsyncResult<ImageEntry[], Error>> {
    try {
      const archiveData = await fs.readFile(archivePath);
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(archiveData);

      const imageEntries = Object.entries(zipContent.files).filter(isSupportedImageEntry);
      const images = await Promise.all(imageEntries.map(extractZipImageEntry));

      return createSuccessResult(images);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to extract images`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
