/**
 * Volume Persister Module
 *
 * Handles persistence of EnhancedVolumeData to normalized Volume tables.
 * Converts provider metadata to relational database records with proper
 * junction table entries for creators, characters, themes, genres, and story arcs.
 */


import { prisma } from '@/server/db';
import type { EnhancedVolumeData } from '@/types/search-types/metadata.types';
import { logger } from '@/utils/logger';

import {
  extractFandomVolumeData,
  transformComicVineVolumeData,
  transformFandomVolumeData,
} from './volume-persister/provider-transformers';

import type { Prisma, PrismaClient, CreatorRole, VolumeFormat } from '@prisma/client';


// ============================================================================
// Types
// ============================================================================

export interface VolumePersistInput {
  mangaId: number;
  volumes: EnhancedVolumeData[];
  source: 'comicvine' | 'fandom' | 'anilist' | 'wikipedia';
}

export interface VolumePersistResult {
  created: number;
  updated: number;
  linkedChapters: number;
}

type PrismaTransaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>;

// ============================================================================
// Format Mapping
// ============================================================================

const FORMAT_MAP: Record<string, VolumeFormat> = {
  tankobon: 'TANKOBON',
  tankōbon: 'TANKOBON',
  omnibus: 'OMNIBUS',
  digital: 'DIGITAL',
  magazine: 'MAGAZINE',
  special: 'SPECIAL',
};

function mapFormat(format: string | undefined): VolumeFormat {
  if (!format) return 'TANKOBON';
  const normalized = format.toLowerCase().trim();
  return FORMAT_MAP[normalized] ?? 'UNKNOWN';
}

// ============================================================================
// Volume Data Mapping
// ============================================================================

// eslint-disable-next-line complexity -- Pure data mapper with optional field handling; no actual control flow complexity
function mapEnhancedVolumeToCreate(
  mangaId: number,
  volumeData: EnhancedVolumeData,
  source: string
): Prisma.VolumeCreateInput {
  return {
    manga: { connect: { id: mangaId } },
    number: volumeData.number,
    title: volumeData.title ?? null,
    subtitle: volumeData.subtitle ?? null,
    alternativeTitle: volumeData.alternativeTitle ?? null,
    description: volumeData.description ?? null,
    summary: volumeData.summary ?? null,
    isbn: volumeData.isbn ?? null,
    isbn13: volumeData.isbn13 ?? null,
    publisher: volumeData.publisher ?? null,
    pageCount: volumeData.pageCount ?? null,
    format: mapFormat(volumeData.format),
    releaseDate: volumeData.releaseDate ? new Date(volumeData.releaseDate) : null,
    coverImage: volumeData.coverImage ?? null,
    chapterStart: volumeData.chapterStart ?? null,
    chapterEnd: volumeData.chapterEnd ?? null,
    totalChapters: volumeData.totalChapters ?? volumeData.chapters?.length ?? null,
    source,
    sourceId: volumeData.sourceId ?? volumeData.id ?? null,
    sourceUrl: volumeData.sourceUrl ?? null,
    fetchedAt: volumeData.fetchedAt ? new Date(volumeData.fetchedAt) : new Date(),
    lastEnriched: volumeData.lastEnriched ? new Date(volumeData.lastEnriched) : null,
    enrichmentTier: volumeData.enrichmentTier ?? 1,
  };
}

/**
 * Filter out undefined values from an object
 *
 * Prisma's exactOptionalPropertyTypes requires null instead of undefined.
 */
function filterUndefinedValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
}

function mapEnhancedVolumeToUpdate(
  volumeData: EnhancedVolumeData
): Prisma.VolumeUpdateInput {
  const data = {
    title: volumeData.title ?? undefined,
    subtitle: volumeData.subtitle ?? undefined,
    alternativeTitle: volumeData.alternativeTitle ?? undefined,
    description: volumeData.description ?? undefined,
    summary: volumeData.summary ?? undefined,
    isbn: volumeData.isbn ?? undefined,
    isbn13: volumeData.isbn13 ?? undefined,
    publisher: volumeData.publisher ?? undefined,
    pageCount: volumeData.pageCount ?? undefined,
    format: volumeData.format ? mapFormat(volumeData.format) : undefined,
    releaseDate: volumeData.releaseDate ? new Date(volumeData.releaseDate) : undefined,
    coverImage: volumeData.coverImage ?? undefined,
    chapterStart: volumeData.chapterStart ?? undefined,
    chapterEnd: volumeData.chapterEnd ?? undefined,
    totalChapters: volumeData.totalChapters ?? volumeData.chapters?.length ?? undefined,
    sourceUrl: volumeData.sourceUrl ?? undefined,
    lastEnriched: new Date(),
    enrichmentTier: volumeData.enrichmentTier ?? undefined,
  };
  return filterUndefinedValues(data) as Prisma.VolumeUpdateInput;
}

// ============================================================================
// Junction Table Sync Functions
// ============================================================================

async function syncVolumeCreators(
  tx: PrismaTransaction,
  volumeId: number,
  creators: EnhancedVolumeData['creators']
): Promise<void> {
  if (!creators) return;

  // Clear existing creators
  await tx.volumeCreator.deleteMany({ where: { volumeId } });

  const creatorEntries: Prisma.VolumeCreatorCreateManyInput[] = [];

  // Map each creator type to entries
  const creatorTypes: Array<{ key: keyof NonNullable<typeof creators>; role: CreatorRole }> = [
    { key: 'authors', role: 'AUTHOR' },
    { key: 'artists', role: 'ARTIST' },
    { key: 'editors', role: 'EDITOR' },
    { key: 'colorists', role: 'COLORIST' },
    { key: 'letterers', role: 'LETTERER' },
    { key: 'coverArtists', role: 'COVER_ARTIST' },
  ];

  for (const { key, role } of creatorTypes) {
    const names = creators[key];
    if (Array.isArray(names)) {
      for (const name of names) {
        if (typeof name === 'string' && name.trim()) {
          creatorEntries.push({ volumeId, name: name.trim(), role });
        }
      }
    }
  }

  if (creatorEntries.length > 0) {
    await tx.volumeCreator.createMany({
      data: creatorEntries,
      skipDuplicates: true,
    });
  }
}

async function syncVolumeCharacters(
  tx: PrismaTransaction,
  volumeId: number,
  characters: string[] | undefined
): Promise<void> {
  if (!characters || characters.length === 0) return;

  // Clear existing characters
  await tx.volumeCharacter.deleteMany({ where: { volumeId } });

  const characterEntries: Prisma.VolumeCharacterCreateManyInput[] = characters
    .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    .map((name, index) => ({
      volumeId,
      name: name.trim(),
      isMain: index < 5, // First 5 characters are considered main
    }));

  if (characterEntries.length > 0) {
    await tx.volumeCharacter.createMany({
      data: characterEntries,
      skipDuplicates: true,
    });
  }
}

async function syncVolumeThemes(
  tx: PrismaTransaction,
  volumeId: number,
  themes: string[] | undefined
): Promise<void> {
  if (!themes || themes.length === 0) return;

  // Clear existing themes
  await tx.volumeTheme.deleteMany({ where: { volumeId } });

  const themeEntries: Prisma.VolumeThemeCreateManyInput[] = themes
    .filter((theme): theme is string => typeof theme === 'string' && theme.trim().length > 0)
    .map(theme => ({ volumeId, theme: theme.trim() }));

  if (themeEntries.length > 0) {
    await tx.volumeTheme.createMany({
      data: themeEntries,
      skipDuplicates: true,
    });
  }
}

async function syncVolumeGenres(
  tx: PrismaTransaction,
  volumeId: number,
  genres: string[] | undefined
): Promise<void> {
  if (!genres || genres.length === 0) return;

  // Clear existing genres
  await tx.volumeGenre.deleteMany({ where: { volumeId } });

  const genreEntries: Prisma.VolumeGenreCreateManyInput[] = genres
    .filter((genre): genre is string => typeof genre === 'string' && genre.trim().length > 0)
    .map(genre => ({ volumeId, genre: genre.trim() }));

  if (genreEntries.length > 0) {
    await tx.volumeGenre.createMany({
      data: genreEntries,
      skipDuplicates: true,
    });
  }
}

async function syncVolumeStoryArcs(
  tx: PrismaTransaction,
  volumeId: number,
  storyArcs: string[] | undefined
): Promise<void> {
  if (!storyArcs || storyArcs.length === 0) return;

  // Clear existing story arcs
  await tx.volumeStoryArc.deleteMany({ where: { volumeId } });

  const arcEntries: Prisma.VolumeStoryArcCreateManyInput[] = storyArcs
    .filter((arcName): arcName is string => typeof arcName === 'string' && arcName.trim().length > 0)
    .map((arcName, index) => ({
      volumeId,
      arcName: arcName.trim(),
      arcOrder: index + 1,
    }));

  if (arcEntries.length > 0) {
    await tx.volumeStoryArc.createMany({
      data: arcEntries,
      skipDuplicates: true,
    });
  }
}

// ============================================================================
// Chapter Linking
// ============================================================================

async function linkChaptersToVolume(
  tx: PrismaTransaction,
  mangaId: number,
  volumeId: number,
  volumeData: EnhancedVolumeData
): Promise<number> {
  let linkedCount = 0;

  // Link by chapter range if available
  if (volumeData.chapterStart !== undefined && volumeData.chapterEnd !== undefined) {
    const result = await tx.chapter.updateMany({
      where: {
        mangaId,
        volumeId: null, // Only link unlinked chapters
        OR: [
          {
            chapterNumber: {
              gte: volumeData.chapterStart,
              lte: volumeData.chapterEnd,
            },
          },
          {
            number: {
              gte: volumeData.chapterStart,
              lte: volumeData.chapterEnd,
            },
          },
        ],
      },
      data: { volumeId },
    });
    linkedCount += result.count;
  }

  // Link by volume number if chapters have volume field set
  if (linkedCount === 0) {
    const result = await tx.chapter.updateMany({
      where: {
        mangaId,
        volumeId: null,
        volume: volumeData.number,
      },
      data: { volumeId },
    });
    linkedCount += result.count;
  }

  return linkedCount;
}

// ============================================================================
// Main Persistence Function
// ============================================================================

/**
 * Persist normalized volumes to database
 *
 * Converts EnhancedVolumeData[] to proper relational records with
 * junction table entries for creators, characters, themes, genres, and story arcs.
 *
 * @param input - Volume persistence input containing mangaId, volumes, and source
 * @returns Result with counts of created, updated, and linked chapters
 */
export async function persistNormalizedVolumes(
  input: VolumePersistInput
): Promise<VolumePersistResult> {
  const { mangaId, volumes, source } = input;

  if (volumes.length === 0) {
    logger.debug(`No volumes to persist for manga ${mangaId}`);
    return { created: 0, updated: 0, linkedChapters: 0 };
  }

  logger.info(`Persisting ${volumes.length} volumes from ${source} for manga ${mangaId}`);

  const result: VolumePersistResult = { created: 0, updated: 0, linkedChapters: 0 };

  try {
    await prisma.$transaction(async (tx) => {
      for (const volumeData of volumes) {
        // Validate volume number
        if (typeof volumeData.number !== 'number' || volumeData.number < 0) {
          logger.warn(`Invalid volume number: ${volumeData.number}, skipping`);
          continue;
        }

        // Check if volume exists
        // eslint-disable-next-line no-await-in-loop -- Sequential CRUD chain: existence check → conditional create/update
        const existing = await tx.volume.findUnique({
          where: { mangaId_number: { mangaId, number: volumeData.number } },
        });

        let volumeId: number;

        if (existing) {
          // Update existing volume
          // eslint-disable-next-line no-await-in-loop -- Sequential CRUD chain: existence check → conditional create/update
          const updated = await tx.volume.update({
            where: { id: existing.id },
            data: mapEnhancedVolumeToUpdate(volumeData),
          });
          volumeId = updated.id;
          result.updated++;
        } else {
          // Create new volume
          // eslint-disable-next-line no-await-in-loop -- Sequential CRUD chain: existence check → conditional create/update
          const created = await tx.volume.create({
            data: mapEnhancedVolumeToCreate(mangaId, volumeData, source),
          });
          volumeId = created.id;
          result.created++;
        }

        // Sync junction tables (in parallel - these operations are independent)
        // eslint-disable-next-line no-await-in-loop -- Junction table sync must complete after volume CRUD for foreign key integrity
        await Promise.all([
          syncVolumeCreators(tx, volumeId, volumeData.creators),
          syncVolumeCharacters(tx, volumeId, volumeData.characters),
          syncVolumeThemes(tx, volumeId, volumeData.themes),
          syncVolumeGenres(tx, volumeId, volumeData.genres),
          syncVolumeStoryArcs(tx, volumeId, volumeData.storyArcs),
        ]);

        // Link chapters to volume
        // eslint-disable-next-line no-await-in-loop -- Must execute after junction table sync for referential integrity
        const linkedCount = await linkChaptersToVolume(tx, mangaId, volumeId, volumeData);
        result.linkedChapters += linkedCount;
      }
    });

    logger.info(
      `Volume persistence complete for manga ${mangaId}: ` +
      `created=${result.created}, updated=${result.updated}, linkedChapters=${result.linkedChapters}`
    );
  } catch (error) {
    logger.error(`Failed to persist volumes for manga ${mangaId}:`, error);
    throw error;
  }

  return result;
}

/**
 * Extract volume data from provider metadata object
 *
 * Searches for volumeData in various possible locations within provider metadata.
 * Transforms provider-specific field names to standard EnhancedVolumeData format.
 *
 * @param providerMetadata - Provider metadata object
 * @param provider - Provider name
 * @returns Array of EnhancedVolumeData or empty array
 */
export function extractVolumeDataFromProvider(
  providerMetadata: unknown,
  provider: string
): EnhancedVolumeData[] {
  if (!providerMetadata || typeof providerMetadata !== 'object') {
    return [];
  }

  const meta = providerMetadata as Record<string, unknown>;
  let rawVolumeData: unknown[] = [];

  // Special handling for Fandom - check multiple possible locations
  if (provider === 'fandom') {
    rawVolumeData = extractFandomVolumeData(meta);
    if (rawVolumeData.length > 0) {
      logger.info(`[extractVolumeDataFromProvider] Found ${rawVolumeData.length} Fandom volumes`);
      return transformFandomVolumeData(rawVolumeData);
    }
  }

  // Check direct volumeData property
  if (Array.isArray(meta['volumeData'])) {
    rawVolumeData = meta['volumeData'];
  }

  // Check nested in provider-specific location
  if (rawVolumeData.length === 0) {
    const providerData = meta[provider];
    if (providerData && typeof providerData === 'object') {
      const nested = providerData as Record<string, unknown>;
      if (Array.isArray(nested['volumeData'])) {
        rawVolumeData = nested['volumeData'];
      }
    }
  }

  // Check providerSpecificFields
  if (rawVolumeData.length === 0) {
    const specific = meta['providerSpecificFields'];
    if (specific && typeof specific === 'object') {
      const fields = specific as Record<string, unknown>;
      if (Array.isArray(fields['volumeData'])) {
        rawVolumeData = fields['volumeData'];
      }
    }
  }

  if (rawVolumeData.length === 0) {
    return [];
  }

  // Transform ComicVine-specific field names to EnhancedVolumeData format
  if (provider === 'comicvine') {
    return transformComicVineVolumeData(rawVolumeData);
  }

  return rawVolumeData as EnhancedVolumeData[];
}
