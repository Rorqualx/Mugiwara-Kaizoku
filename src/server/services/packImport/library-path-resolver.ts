/**
 * Resolves library paths and naming templates from file organization settings.
 */

import path from 'path';

import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

export interface PackImportConfig {
  libraryBasePath: string;
  chapterNamingTemplate: string;
  volumeNamingTemplate: string;
  // When true, the library scanner moves+renames newly-tracked chapter
  // files into `<manga>/Chapters/<formatted-name>`. Defaults true so the
  // Settings UI's `organizeOnImport` toggle is honored by both code paths
  // (the pack-import linker already moves unconditionally).
  organizeOnImport: boolean;
}

const DEFAULTS: PackImportConfig = {
  libraryBasePath: '/data/libraries',
  chapterNamingTemplate: '{title} C{chapter}',
  volumeNamingTemplate: '{title} V{volume}',
  organizeOnImport: true
};

/**
 * Load file organization config relevant to pack imports.
 */
export async function loadPackImportConfig(prismaClient: PrismaClient): Promise<PackImportConfig> {
  const config = await prismaClient.config.findUnique({ where: { key: 'fileOrganization' } });
  if (!config?.value) {
    return { ...DEFAULTS, libraryBasePath: await resolveBasePath(prismaClient, undefined) };
  }

  try {
    const parsed = JSON.parse(config.value) as Record<string, unknown>;
    const basePath = parsed['libraryBasePath'];
    const chTpl = parsed['chapterNamingTemplate'];
    const volTpl = parsed['volumeNamingTemplate'];
    const organize = parsed['organizeOnImport'];
    return {
      libraryBasePath: await resolveBasePath(prismaClient, typeof basePath === 'string' ? basePath : undefined),
      chapterNamingTemplate: typeof chTpl === 'string' ? chTpl : DEFAULTS.chapterNamingTemplate,
      volumeNamingTemplate: typeof volTpl === 'string' ? volTpl : DEFAULTS.volumeNamingTemplate,
      organizeOnImport: typeof organize === 'boolean' ? organize : DEFAULTS.organizeOnImport
    };
  } catch {
    return { ...DEFAULTS, libraryBasePath: await resolveBasePath(prismaClient, undefined) };
  }
}

/**
 * Resolve the library base path with a single fallback chain shared by every
 * caller: configured non-empty value → first Library row's `path` → hardcoded
 * default. A present-but-blank `libraryBasePath` previously skipped the Library
 * fallback and dropped straight to `/data/libraries`, which isn't a mount in
 * container deployments — so every import died with "EACCES: mkdir '/data'"
 * (the Akira incident, 2026-06-14). Falling back to the real Library path keeps
 * imports landing where the rest of the library already lives; the warn makes a
 * blanked-out setting visible instead of silently mis-routing to an unwritable
 * default.
 */
async function resolveBasePath(
  prismaClient: PrismaClient,
  configured: string | undefined,
): Promise<string> {
  if (typeof configured === 'string' && configured.length > 0) return configured;
  const library = await prismaClient.library.findFirst({ select: { path: true } });
  if (library?.path !== undefined && library.path.length > 0) {
    logger.warn('[PackImport] libraryBasePath is blank; falling back to Library.path', { path: library.path });
    return library.path;
  }
  logger.warn('[PackImport] libraryBasePath is blank and no Library row found; using hardcoded default', {
    path: DEFAULTS.libraryBasePath,
  });
  return DEFAULTS.libraryBasePath;
}

/** Kept for backward compatibility with packImportService */
export async function resolveLibraryBasePath(prismaClient: PrismaClient): Promise<string> {
  const config = await loadPackImportConfig(prismaClient);
  return config.libraryBasePath;
}

/**
 * Generate a chapter file name from the naming template.
 */
export function formatChapterFileName(
  template: string, mangaTitle: string,
  chapterNum: number, volumeNum: number | null, ext: string
): string {
  let name = template
    .replace(/{title}/g, mangaTitle)
    .replace(/{chapter}/g, String(chapterNum).padStart(3, '0'));

  name = volumeNum !== null
    ? name.replace(/{volume}/g, String(volumeNum).padStart(2, '0'))
    : name.replace(/\s*V\{volume\}/g, '');

  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim() + ext;
}

/**
 * Generate a volume folder name from the naming template.
 */
export function formatVolumeFolderName(
  template: string, mangaTitle: string, volumeNum: number
): string {
  const name = template
    .replace(/{title}/g, mangaTitle)
    .replace(/{volume}/g, String(volumeNum).padStart(2, '0'));

  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}

/**
 * Build the standard manga directory paths.
 * Structure: {basePath}/{title}/Chapters/ and {basePath}/{title}/Volumes/
 */
export function buildMangaPaths(basePath: string, mangaTitle: string): {
  mangaDir: string; chaptersDir: string; volumesDir: string;
} {
  const mangaDir = path.join(basePath, mangaTitle);
  return {
    mangaDir,
    chaptersDir: path.join(mangaDir, 'Chapters'),
    volumesDir: path.join(mangaDir, 'Volumes')
  };
}

/**
 * Subdir under `<manga>/Chapters/` that holds a single chapter file.
 * Volume-tagged chapters group under `Volume NN` (padded 2 digits).
 * Chapters with no volume number land under `Unsorted`.
 */
export function chapterSubdirName(volume: number | null): string {
  if (volume === null) return 'Unsorted';
  return `Volume ${String(volume).padStart(2, '0')}`;
}

/**
 * Full chapters destination dir for a specific volume bucket.
 * Pure path join — does not create directories.
 */
export function buildChapterDestDir(chaptersDir: string, volume: number | null): string {
  return path.join(chaptersDir, chapterSubdirName(volume));
}
