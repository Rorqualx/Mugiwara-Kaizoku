/**
 * Local Cover Extractor
 *
 * Extracts the first page from a manga chapter archive (CBZ/CBR/ZIP/RAR)
 * to use as the series cover when no provider match is available.
 * Saves the cover to the local cache directory and updates the Metadata record.
 */

import fs from 'fs/promises';
import path from 'path';

import { prisma } from '@/server/db';
import { triggerLayerize } from '@/server/services/coverLayers/coverLayerizer';
import { findMangaFiles } from '@/utils/file-utils';
import { logger } from '@/utils/logger';

const log = logger.child('LocalCoverExtractor');

/** Supported image extensions for cover pages */
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/** Base directory for cached covers */
function getCoverCacheDir(): string {
  const baseDir = process.env['MANGA_FILES_DIR'] ?? process.cwd() + '/data/cache';
  return path.join(baseDir, 'covers');
}

/** Natural sort for filenames so "page 2" comes before "page 10" */
function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** Extract first image from a ZIP/CBZ archive using JSZip */
async function extractFirstPageFromZip(archivePath: string): Promise<{ buffer: Buffer; ext: string } | null> {
  const JSZip = (await import('jszip')).default;
  const fileData = await fs.readFile(archivePath);
  const zip = await JSZip.loadAsync(fileData);

  const imageFiles = Object.keys(zip.files)
    .filter(name => {
      const ext = path.extname(name).toLowerCase();
      return IMAGE_EXTENSIONS.has(ext) && !zip.files[name]?.dir && !name.startsWith('__MACOSX');
    })
    .sort(naturalSort);

  const firstImage = imageFiles[0];
  if (!firstImage) return null;

  const data = await zip.files[firstImage]?.async('nodebuffer');
  if (!data) return null;

  return { buffer: data, ext: path.extname(firstImage).toLowerCase() };
}

/** Extract first image from a RAR/CBR archive */
async function extractFirstPageFromRar(archivePath: string): Promise<{ buffer: Buffer; ext: string } | null> {
  const { extractPageFromRar } = await import('@/server/services/conversion/utils/rar-extractor');
  const result = await extractPageFromRar(archivePath, 0);
  if (result.status !== 'success') return null;

  const ext = path.extname(result.data.name).toLowerCase();
  return { buffer: result.data.data, ext };
}

/** Check if file is a RAR/CBR archive */
function isRarArchive(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.cbr' || ext === '.rar';
}

/** Check if file is a ZIP/CBZ archive */
function isZipArchive(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.cbz' || ext === '.zip';
}

/**
 * Extract first page from the first available archive in a directory,
 * save it to the cover cache, and update the manga's Metadata record.
 *
 * @returns The cover URL path (e.g., "/api/local-cover/42") or null on failure
 */
export async function extractAndSetLocalCover(
  mangaId: number,
  sourcePath: string,
): Promise<string | null> {
  try {
    const files = await findMangaFiles(sourcePath);
    if (files.length === 0) return null;

    // Sort files and pick the first archive (likely volume 1 or chapter 1)
    const sorted = [...files].sort(naturalSort);
    const archivePath = sorted[0];
    if (!archivePath) return null;

    // Extract first page based on archive type
    let pageResult: { buffer: Buffer; ext: string } | null = null;
    if (isZipArchive(archivePath)) {
      pageResult = await extractFirstPageFromZip(archivePath);
    } else if (isRarArchive(archivePath)) {
      pageResult = await extractFirstPageFromRar(archivePath);
    }

    if (!pageResult) {
      log.warn('Could not extract cover page', { mangaId, archivePath });
      return null;
    }

    // Save cover to cache directory
    const coverDir = getCoverCacheDir();
    await fs.mkdir(coverDir, { recursive: true });
    const coverFilename = `manga-${mangaId}${pageResult.ext}`;
    const coverPath = path.join(coverDir, coverFilename);
    await fs.writeFile(coverPath, pageResult.buffer);

    // Update Metadata record with local cover URL
    const coverUrl = `/api/local-cover/${mangaId}`;
    // Find the metadata record linked to this manga and update its cover
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { metadataId: true },
    });
    if (manga?.metadataId) {
      await prisma.metadata.update({
        where: { id: manga.metadataId },
        data: { cover: coverUrl },
      });
    }

    log.info('Extracted and set local cover', { mangaId, coverUrl, archivePath: path.basename(archivePath) });

    // Generate living-cover layers in the background (non-blocking).
    triggerLayerize(mangaId);

    return coverUrl;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('Failed to extract local cover (non-critical)', { mangaId, error: msg });
    return null;
  }
}
