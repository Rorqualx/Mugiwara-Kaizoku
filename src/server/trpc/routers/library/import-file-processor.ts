/**
 * Import File Processor
 *
 * Handles file routing and naming during manga import.
 * Routes volume files to Volumes/ and chapter files to Chapters/ subdirectories.
 * Applies naming templates from media management settings.
 */

import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

import { ensureMangaSubdirs } from '@/server/services/download/fileImporter/utils';
import type { FileOrganizationConfig } from '@/server/services/fileOrganization/configService';
import { buildChapterDestDir } from '@/server/services/packImport/library-path-resolver';
import { logger } from '@/utils/logger';


type ImportMode = 'copy' | 'move' | 'inPlace';

/** Result of file processing (copy/move/in-place) */
export interface FileProcessingResult {
  successFiles: string[];
  failedCount: number;
  failedFiles: string[];
}

export function getImportMode(config: FileOrganizationConfig): ImportMode {
  switch (config.fileMode) {
    case 'keep_in_place': return 'inPlace';
    case 'copy': return 'copy';
    case 'move': return 'move';
    default: return 'move';
  }
}

/** Detect if a filename is a volume-only file (e.g., "Manga V01") vs chapter file */
function isVolumeOnlyFile(fileName: string): boolean {
  const hasVolume = /\bv(?:ol(?:ume)?)?[.\s-]*\d+/i.test(fileName);
  const hasChapter = /\bc(?:h(?:apter)?)?[.\s-]*\d+/i.test(fileName);
  return hasVolume && !hasChapter;
}

/** Extract volume and chapter numbers from a filename */
function parseVolumeAndChapter(fileName: string): { volume: number | null; chapter: number | null } {
  const volMatch = fileName.match(/\bv(?:ol(?:ume)?)?[.\s-]*(\d+)/i);
  const chMatch = fileName.match(/\bc(?:h(?:apter)?)?[.\s-]*(\d+)/i);
  return {
    volume: volMatch?.[1] ? parseInt(volMatch[1], 10) : null,
    chapter: chMatch?.[1] ? parseInt(chMatch[1], 10) : null,
  };
}

/** Apply naming template to a file based on its type and parsed numbers */
function applyNamingTemplate(
  originalName: string, mangaTitle: string, mediaSettings: Record<string, unknown>,
  parsed: { volume: number | null; chapter: number | null }, isVolume: boolean,
): string {
  const ext = path.extname(originalName);
  const template = isVolume
    ? (mediaSettings['volumeNamingTemplate'] as string | undefined) ?? '{title} V{volume}'
    : (mediaSettings['chapterNamingTemplate'] as string | undefined) ?? '{title} V{volume} C{chapter}';

  const volStr = parsed.volume !== null ? String(parsed.volume).padStart(2, '0') : '';
  const chStr = parsed.chapter !== null ? String(parsed.chapter).padStart(3, '0') : '';

  const fileName = template
    .replace(/{title}/g, mangaTitle)
    .replace(/{volume}/g, volStr)
    .replace(/{chapter}/g, chStr)
    .replace(/\s+/g, ' ').trim()
    .replace(/[<>:"/\\|?*]/g, '_');

  return fileName + ext;
}

/** Resolve the on-disk destination folder for a single import entry. */
function resolveDestDir(
  mangaFolderPath: string,
  mediaSettings: Record<string, unknown>,
  mangaTitle: string | undefined,
  parsed: { volume: number | null; chapter: number | null },
  isVolume: boolean,
): string {
  const createVolFolders = mediaSettings['createVolumeFolders'] === true;
  const chMode = (mediaSettings['chapterFolderMode'] as string | undefined) ?? 'volume-group';

  if (isVolume && createVolFolders) {
    const volFolder = `${mangaTitle ?? 'Unknown'} Vol ${parsed.volume ?? 0}`;
    return path.join(mangaFolderPath, 'Volumes', volFolder);
  }
  if (isVolume) {
    return path.join(mangaFolderPath, 'Volumes');
  }
  // Legacy per-chapter mode keeps its own subdir-per-chapter layout.
  if (chMode === 'per-chapter' && parsed.chapter !== null) {
    const chFolder = `${mangaTitle ?? 'Unknown'} Ch ${String(parsed.chapter).padStart(3, '0')}`;
    return path.join(mangaFolderPath, 'Chapters', chFolder);
  }
  // Default + 'volume-group' mode: group by volume bucket — volume-tagged
  // chapters land under `Chapters/Volume NN/`, unvolumed under `Chapters/Unsorted/`.
  const chaptersDir = path.join(mangaFolderPath, 'Chapters');
  return buildChapterDestDir(chaptersDir, parsed.volume);
}

/** Process a single file: route to subfolders, apply naming template, respect media settings */
async function processSingleFile(
  srcFile: string, mangaFolderPath: string, mode: ImportMode,
  mediaSettings: Record<string, unknown>, mangaTitle: string | undefined,
): Promise<string | null> {
  if (mode === 'inPlace') return srcFile;

  // `findMangaFiles` can return both archive files (.cbz/.cbr/...) AND image
  // directories (a folder containing loose .jpg/.png pages). The file path
  // shapes are indistinguishable from a string alone — stat it once up front
  // so we route the right primitive (copyFile vs recursive directory copy)
  // and avoid `EISDIR` from fs.copyFile.
  let isDir = false;
  try {
    const stat = await fs.stat(srcFile);
    isDir = stat.isDirectory();
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    logger.error('Failed to stat import source', error, { src: srcFile, code, mode });
    return null;
  }

  const originalName = path.basename(srcFile);
  const isVolume = isVolumeOnlyFile(originalName);
  const parsed = parseVolumeAndChapter(originalName);
  const destDir = resolveDestDir(mangaFolderPath, mediaSettings, mangaTitle, parsed, isVolume);
  await fs.mkdir(destDir, { recursive: true });

  // Apply naming template — only for file entries. Image directories keep
  // their original folder name; the naming template assumes a single archive
  // file with an extension and would produce a confusing rename for a tree.
  let fileName = originalName;
  const hasParsedNumbers = parsed.volume !== null || parsed.chapter !== null;
  if (!isDir && hasParsedNumbers && mangaTitle && Object.keys(mediaSettings).length > 0) {
    fileName = applyNamingTemplate(originalName, mangaTitle, mediaSettings, parsed, isVolume);
  }
  const destPath = path.join(destDir, fileName);

  try {
    if (isDir) {
      await copyDirectoryRecursive(srcFile, destPath);
      if (mode === 'move') {
        try { await fs.rm(srcFile, { recursive: true, force: true }); } catch { /* non-fatal */ }
      }
    } else {
      await copyWithFallback(srcFile, destPath);
      if (mode === 'move') {
        try { await fs.unlink(srcFile); } catch { /* non-fatal */ }
      }
    }
    return destPath;
  } catch (error) {
    // logger.error(message, error?, context?) — pass `error` as 2nd arg so the
    // logger's Error-handling path prepends `: <error.message>` and includes
    // the stack. Context (paths + node fs code + mode) goes in 3rd arg.
    const code = (error as { code?: string } | null)?.code;
    logger.error('Failed to process file', error, { src: srcFile, dest: destPath, code, mode, isDir });
    return null;
  }
}

/**
 * Copy a file with a stream-based fallback when `fs.copyFile` fails.
 *
 * Bun's `fs.copyFile` uses macOS `copyfile()` / Linux `copy_file_range()`
 * syscalls. Both can fail over SMB/NFS mounts with EBADF, EXDEV, or
 * ENOTSUP. The streaming fallback (createReadStream→createWriteStream)
 * works on any POSIX-visible filesystem.
 */
async function copyWithFallback(src: string, dest: string): Promise<void> {
  // Same-path no-op: when src and dest resolve to the same file, copyFile
  // throws ENOENT/EEXIST depending on the platform. Treat it as success —
  // there's nothing to do.
  if (path.resolve(src) === path.resolve(dest)) return;

  try {
    await fs.copyFile(src, dest);
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code;
    if (code === 'EBADF' || code === 'EXDEV' || code === 'ENOTSUP' || code === 'EINVAL') {
      // Network filesystem can't satisfy the kernel-level fast path.
      // Fall back to userspace stream copy.
      await pipeline(createReadStream(src), createWriteStream(dest));
      return;
    }
    throw err;
  }
}

/**
 * Recursively copy a directory tree using `copyWithFallback` for each leaf
 * file. `fs.copyFile` (and therefore `copyWithFallback`) refuses directories,
 * so the recursive walk is the layer that turns an image-directory entry
 * from `findMangaFiles` into a usable copy. Each file goes through the same
 * SMB-safe fallback as a flat archive copy.
 */
async function copyDirectoryRecursive(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  await Promise.all(entries.map((entry) => copyEntry(src, dest, entry)));
}

async function copyEntry(srcDir: string, destDir: string, entry: import('fs').Dirent): Promise<void> {
  const srcChild = path.join(srcDir, entry.name);
  const destChild = path.join(destDir, entry.name);

  // Dirent d_type can be DT_UNKNOWN on NFS/SMB mounts — isDirectory()/isFile()
  // both return false for real entries. Fall back to lstat() when the dirent
  // can't classify the entry, otherwise the recursive copy silently truncates.
  let isDir = entry.isDirectory();
  let isFile = entry.isFile();
  if (!isDir && !isFile) {
    try {
      const stats = await fs.lstat(srcChild);
      isDir = stats.isDirectory();
      isFile = stats.isFile();
    } catch {
      return;
    }
  }

  if (isDir) {
    await copyDirectoryRecursive(srcChild, destChild);
  } else if (isFile) {
    await copyWithFallback(srcChild, destChild);
  }
  // Symlinks and other special entries are intentionally skipped — manga
  // image directories don't legitimately contain them, and following them
  // blindly is a footgun.
}

/** Load media management settings for naming templates and volume folders */
async function loadMediaSettings(): Promise<Record<string, unknown>> {
  try {
    const { getGlobalConfigService } = await import('@/server/services/config/globalConfigService');
    const { parseJsonSafely } = await import('@/server/services/download/fileImporter/utils');
    const raw = await getGlobalConfigService().get('fileOrganization');
    if (raw) return parseJsonSafely(raw) as Record<string, unknown>;
  } catch { /* use defaults */ }
  return {};
}

/** Process files for import: route to Chapters/Volumes subfolders and apply naming template */
export async function processFilesForImport(
  sourceFiles: string[], mangaFolderPath: string,
  config: FileOrganizationConfig, mangaTitle?: string,
): Promise<FileProcessingResult> {
  const mode = getImportMode(config);
  if (mode !== 'inPlace') {
    await fs.mkdir(mangaFolderPath, { recursive: true });
    await ensureMangaSubdirs(mangaFolderPath);
  }

  const mediaSettings = await loadMediaSettings();
  const results = await Promise.all(
    sourceFiles.map(async (srcFile) => ({
      srcFile,
      destPath: await processSingleFile(srcFile, mangaFolderPath, mode, mediaSettings, mangaTitle),
    }))
  );

  const successFiles: string[] = [];
  const failedFiles: string[] = [];
  for (const { srcFile, destPath } of results) {
    if (destPath !== null) {
      successFiles.push(destPath);
    } else {
      failedFiles.push(srcFile);
    }
  }
  if (failedFiles.length > 0) {
    logger.warn('Some files failed during import', { failed: failedFiles.length, total: sourceFiles.length });
  }
  return { successFiles, failedCount: failedFiles.length, failedFiles };
}

/**
 * Queue file conversion jobs for imported files based on media management settings.
 * Checks the conversion.autoConvert and downloads.defaultFormat config keys.
 * Should be called after chapters are created (needs chapterId for conversion jobs).
 */
export async function queueConversionIfNeeded(mangaId: number): Promise<void> {
  try {
    const { shouldConvertFile, createConversionJob } = await import(
      '@/server/services/download/fileImporter/conversion-operations'
    );
    const { prisma } = await import('@/server/db');

    const chapters = await prisma.chapter.findMany({
      where: { mangaId, filePath: { not: null }, downloadStatus: 'COMPLETED' },
      select: { id: true, filePath: true },
    });

    for (const ch of chapters) {
      if (!ch.filePath) continue;
      const ext = ch.filePath.split('.').pop() ?? '';
      // eslint-disable-next-line no-await-in-loop -- sequential conversion check per chapter
      const check = await shouldConvertFile(ext);
      if (check.shouldConvert && check.targetFormat) {
        // eslint-disable-next-line no-await-in-loop -- sequential job creation
        await createConversionJob(mangaId, ch.id, ch.filePath, ext, check.targetFormat);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn('Conversion check failed (non-critical)', { mangaId, error: msg });
  }
}
