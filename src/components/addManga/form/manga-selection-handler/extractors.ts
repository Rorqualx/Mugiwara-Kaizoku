/**
 * Extraction Functions for Manga Selection Handler
 *
 * Contains functions for extracting and transforming data from manga objects.
 * These extractors handle the various shapes and sources of manga metadata
 * from different providers (ComicVine, AniList, etc.).
 *
 * @module components/addManga/form/manga-selection-handler/extractors
 */

import type {
  ParsedVolumeData,
  MetadataObject,
  RawDataObject,
  ProviderSpecificObject,
  ComicVineData,
} from './types';

/**
 * Extract cover URL from manga object
 * Checks multiple possible locations for cover image URL
 *
 * @param manga - The manga object to extract cover from
 * @returns The cover URL if found, undefined otherwise
 */
export function extractCoverUrl(manga: Record<string, unknown>): string | undefined {
  if ('cover' in manga && typeof manga['cover'] === 'string') {
    return manga['cover'];
  }
  if ('coverImage' in manga && typeof manga['coverImage'] === 'string') {
    return manga['coverImage'];
  }
  if ('coverUrl' in manga && typeof manga['coverUrl'] === 'string') {
    return manga['coverUrl'];
  }
  return undefined;
}

/**
 * Extract basic metadata fields from manga object
 *
 * @param manga - The manga object to extract metadata from
 * @returns Object containing description, status, genres, authors, and alternativeTitles
 */
export function extractBasicMetadata(manga: Record<string, unknown>): {
  description: string | undefined;
  status: string | undefined;
  genres: string[];
  authors: string[];
  alternativeTitles: string[];
} {
  const description = 'description' in manga && typeof manga['description'] === 'string'
    ? manga['description']
    : undefined;

  const status = 'status' in manga && typeof manga['status'] === 'string'
    ? manga['status']
    : undefined;

  const genres = 'genres' in manga && Array.isArray(manga['genres'])
    ? manga['genres'].filter((genre): genre is string => typeof genre === 'string')
    : [];

  const authors = 'authors' in manga && Array.isArray(manga['authors'])
    ? manga['authors'].filter((author): author is string => typeof author === 'string')
    : [];

  const alternativeTitles = 'alternativeTitles' in manga && Array.isArray(manga['alternativeTitles'])
    ? manga['alternativeTitles'].filter((title): title is string => typeof title === 'string')
    : [];

  return { description, status, genres, authors, alternativeTitles };
}

/**
 * Extract parsed volume data from manga object
 * Checks both direct parsedVolumeData and metadata.volumes/chapters
 *
 * @param manga - The manga object to extract volume data from
 * @returns ParsedVolumeData if found, undefined otherwise
 */
export function extractParsedVolumeData(manga: Record<string, unknown>): ParsedVolumeData | undefined {
  // First check if parsedVolumeData is directly in the manga object
  if ('parsedVolumeData' in manga && manga['parsedVolumeData'] && typeof manga['parsedVolumeData'] === 'object') {
    return manga['parsedVolumeData'] as ParsedVolumeData;
  }

  // Otherwise check in metadata
  if ('metadata' in manga && manga['metadata'] && typeof manga['metadata'] === 'object') {
    const metadata = manga['metadata'] as MetadataObject;
    if ('volumes' in metadata && typeof metadata['volumes'] === 'number' &&
        'chapters' in metadata && typeof metadata['chapters'] === 'number') {
      return {
        volumes: metadata['volumes'] as number,
        chapters: metadata['chapters'] as number,
        ...(Array.isArray(metadata['volumeDetails']) && { volumeDetails: metadata['volumeDetails'] })
      };
    }
  }

  return undefined;
}

/**
 * Extract publisher name from various object shapes
 *
 * @param pub - Publisher value (string or object)
 * @returns Publisher name string or undefined
 */
function extractPublisherName(pub: unknown): string | undefined {
  if (typeof pub === 'string') {
    return pub;
  }
  if (typeof pub === 'object' && pub !== null) {
    const pubObj = pub as Record<string, unknown>;
    if ('name' in pubObj && typeof pubObj['name'] === 'string') {
      return pubObj['name'];
    }
  }
  return undefined;
}

/**
 * Extract direct ComicVine fields from manga object
 *
 * @param manga - The manga object to extract from
 * @returns Object with extracted direct fields
 */
function extractDirectComicVineFields(manga: Record<string, unknown>): {
  issues: unknown | undefined;
  characters: unknown[] | undefined;
  creators: unknown[] | undefined;
  publisher: string | undefined;
  rawData: RawDataObject | undefined;
  providerSpecific: ProviderSpecificObject | undefined;
} {
  const issues = 'issues' in manga ? manga['issues'] : undefined;

  const characters = 'characters' in manga && Array.isArray(manga['characters'])
    ? manga['characters']
    : undefined;

  const creators = 'creators' in manga && Array.isArray(manga['creators'])
    ? manga['creators']
    : undefined;

  const publisher = 'publisher' in manga
    ? extractPublisherName(manga['publisher'])
    : undefined;

  const rawData = 'rawData' in manga && manga['rawData'] && typeof manga['rawData'] === 'object'
    ? manga['rawData'] as RawDataObject
    : undefined;

  const providerSpecific = 'providerSpecific' in manga && manga['providerSpecific'] && typeof manga['providerSpecific'] === 'object'
    ? manga['providerSpecific'] as ProviderSpecificObject
    : undefined;

  return { issues, characters, creators, publisher, rawData, providerSpecific };
}

/**
 * Extract ComicVine fields from metadata object as fallback
 *
 * @param metadata - The metadata object to extract from
 * @param existing - Existing values to use as fallback
 * @returns Object with extracted metadata fields
 */
function extractMetadataComicVineFields(
  metadata: MetadataObject,
  existing: {
    issues: unknown | undefined;
    characters: unknown[] | undefined;
    creators: unknown[] | undefined;
    publisher: string | undefined;
  }
): {
  issues: unknown | undefined;
  characters: unknown[] | undefined;
  creators: unknown[] | undefined;
  publisher: string | undefined;
} {
  const issues = existing.issues ?? ('issues' in metadata ? metadata['issues'] : undefined);

  const characters = existing.characters ?? (
    'characters' in metadata && Array.isArray(metadata['characters'])
      ? metadata['characters']
      : undefined
  );

  const creators = existing.creators ?? (
    'creators' in metadata && Array.isArray(metadata['creators'])
      ? metadata['creators']
      : undefined
  );

  const publisher = existing.publisher ?? (
    'publisher' in metadata
      ? extractPublisherName(metadata['publisher'])
      : undefined
  );

  return { issues, characters, creators, publisher };
}

/**
 * Extract ComicVine-specific data from manga object
 * Includes issues, characters, creators, publisher, rawData, and providerSpecific
 *
 * @param manga - The manga object to extract ComicVine data from
 * @returns Object containing all ComicVine-specific fields
 */
export function extractComicVineData(manga: Record<string, unknown>): ComicVineData {
  // Extract direct fields
  const directFields = extractDirectComicVineFields(manga);

  // Extract from metadata as fallback
  if ('metadata' in manga && manga['metadata'] && typeof manga['metadata'] === 'object') {
    const metadata = manga['metadata'] as MetadataObject;
    const metadataFields = extractMetadataComicVineFields(metadata, directFields);

    return {
      ...metadataFields,
      rawData: directFields.rawData,
      providerSpecific: directFields.providerSpecific
    };
  }

  return directFields;
}
