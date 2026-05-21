/**
 * Archive Converter
 *
 * Converts RAR/7z/CBR archives to CBZ format using pure JS libraries.
 * Uses node-unrar-js for RAR extraction and JSZip for CBZ creation.
 * No external binary dependencies (unrar, 7z) required.
 *
 * Used during pack imports when conversion.autoConvert is enabled.
 */

import fs from 'fs/promises';
import path from 'path';

import { bufferToArrayBuffer } from '@/server/services/conversion/utils/buffer-utils';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

const CONVERTIBLE_EXTENSIONS = new Set(['.rar', '.cbr', '.7z', '.cb7']);

export interface ConversionConfig {
  autoConvert: boolean;
  defaultFormat: string;
  deleteSource: boolean;
  /**
   * Kill-switch override. When `true`, source archives are kept regardless
   * of `deleteSource`. Lets users opt out of cleanup without flipping the
   * primary lever back. Default `false`.
   */
  preserveSource: boolean;
  compressionLevel: number;
}

/**
 * Load conversion settings from Config table.
 *
 * iter-IC6: `conversion.deleteSource` default flipped from `false` to
 * `true` — successful conversions prune the source archive by default.
 * The new `conversion.preserveSource` key (default `false`) is a
 * kill-switch override for users who want to keep both files.
 */
export async function loadConversionConfig(prismaClient: PrismaClient): Promise<ConversionConfig> {
  const keys = [
    'conversion.autoConvert',
    'downloads.defaultFormat',
    'conversion.deleteSource',
    'conversion.preserveSource',
    'conversion.compressionLevel',
  ];
  const configs = await prismaClient.config.findMany({ where: { key: { in: keys } } });
  const configMap = new Map(configs.map(c => [c.key, c.value]));

  // Default-true: only an explicit 'false' opts out.
  const rawDeleteSource = configMap.get('conversion.deleteSource');
  const deleteSource = rawDeleteSource === undefined ? true : rawDeleteSource !== 'false';

  return {
    autoConvert: configMap.get('conversion.autoConvert') === 'true',
    defaultFormat: configMap.get('downloads.defaultFormat') ?? 'cbz',
    deleteSource,
    preserveSource: configMap.get('conversion.preserveSource') === 'true',
    compressionLevel: parseInt(configMap.get('conversion.compressionLevel') ?? '6', 10),
  };
}

/**
 * Resolve the effective per-call source-cleanup decision. `preserveSource`
 * wins over `deleteSource` so the kill-switch is unambiguous.
 */
export function shouldDeleteSource(config: ConversionConfig): boolean {
  return config.deleteSource && !config.preserveSource;
}

/**
 * Check if a file needs conversion based on its extension and config.
 */
export function needsConversion(filePath: string, targetFormat: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const targetExt = `.${targetFormat}`;
  return ext !== targetExt && CONVERTIBLE_EXTENSIONS.has(ext);
}

/**
 * Extract all files from a RAR/CBR archive to a temp directory.
 * Writes each extracted file to disk immediately instead of holding all in memory.
 */
async function extractRarToDir(sourcePath: string, tempDir: string): Promise<string[]> {
  const { createExtractorFromData } = await import('node-unrar-js');
  const archiveData = await fs.readFile(sourcePath);

  const extractor = await createExtractorFromData({
    data: bufferToArrayBuffer(archiveData)
  });

  const extracted = extractor.extract();
  const filePaths: string[] = [];

  for (const file of extracted.files) {
    if (file.fileHeader.flags.directory) continue;
    if (file.extraction) {
      const flatName = path.basename(file.fileHeader.name);
      const outPath = path.join(tempDir, flatName);
      await fs.writeFile(outPath, Buffer.from(file.extraction)); // eslint-disable-line no-await-in-loop
      filePaths.push(outPath);
    }
  }

  // Release archive buffer for GC
  return filePaths;
}

/** Package files from a directory into a CBZ (ZIP) archive using JSZip, streaming from disk */
async function packageDirAsCbz(
  filePaths: string[],
  destPath: string,
  compressionLevel: number
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const filePath of filePaths) {
    const data = await fs.readFile(filePath); // eslint-disable-line no-await-in-loop
    const flatName = path.basename(filePath);
    zip.file(flatName, data);
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel }
  });

  await fs.writeFile(destPath, zipBuffer);
}

/**
 * Convert an archive file to CBZ format.
 *
 * 1. Extract RAR/CBR using node-unrar-js (pure JS, no unrar binary)
 * 2. Repackage as CBZ using JSZip
 * 3. Optionally delete the source file
 *
 * @returns Path to the converted CBZ file
 */
export async function convertToCbz(
  sourcePath: string,
  deleteSource: boolean,
  compressionLevel: number = 6
): Promise<string> {
  const dir = path.dirname(sourcePath);
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const destPath = path.join(dir, `${baseName}.cbz`);

  const ext = path.extname(sourcePath).toLowerCase();

  if (ext === '.rar' || ext === '.cbr') {
    // Extract to temp dir to avoid holding all files in memory simultaneously
    const tempDir = path.join(dir, `.convert-tmp-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    try {
      const extractedPaths = await extractRarToDir(sourcePath, tempDir);
      logger.info(`[ArchiveConverter] Extracted ${extractedPaths.length} files from ${path.basename(sourcePath)}`);
      await packageDirAsCbz(extractedPaths, destPath, compressionLevel);
    } finally {
      // Always clean up temp dir
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {
        logger.warn(`[ArchiveConverter] Failed to clean up temp dir: ${tempDir}`);
      });
    }
  } else if (ext === '.7z' || ext === '.cb7') {
    // 7z requires external binary — fail clearly instead of silently
    throw new Error(`7z/cb7 conversion requires external 7z binary (not installed). File: ${path.basename(sourcePath)}`);
  } else {
    throw new Error(`Cannot convert ${ext} format`);
  }

  if (deleteSource) {
    await fs.unlink(sourcePath);
  }

  logger.info(`[ArchiveConverter] Converted ${path.basename(sourcePath)} → ${path.basename(destPath)}`);
  return destPath;
}

/**
 * Convert a file if needed, returning the (possibly new) path and filename.
 * Returns the original path/name unchanged if no conversion is needed.
 */
export async function maybeConvertFile(
  filePath: string,
  fileName: string,
  config: ConversionConfig
): Promise<{ filePath: string; fileName: string; converted: boolean }> {
  if (!config.autoConvert || !needsConversion(filePath, config.defaultFormat)) {
    return { filePath, fileName, converted: false };
  }

  try {
    const newPath = await convertToCbz(filePath, shouldDeleteSource(config), config.compressionLevel);
    const newName = path.basename(fileName, path.extname(fileName)) + `.${config.defaultFormat}`;
    return { filePath: newPath, fileName: newName, converted: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown conversion error';
    logger.warn(`[ArchiveConverter] Conversion failed for ${fileName}: ${msg} — keeping original`);
    return { filePath, fileName, converted: false };
  }
}
