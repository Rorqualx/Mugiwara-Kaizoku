/**
 * Form and Manga Object Builders
 *
 * Contains functions for building form update objects and selected manga
 * state from extracted metadata and provider data.
 *
 * @module components/addManga/form/manga-selection-handler/builders
 */

import type { MangaSearchResult, ExtendedMangaSearchResult } from '@/types/search.types';
import { toStringId } from '@/utils/id-converters';

import type { extractBasicMetadata } from './extractors';
import type {
  FormType,
  ComicVineData,
  ParsedVolumeData,
  VolumeDetail,
  RawDataObject,
  ProviderSpecificObject,
} from './types';

/**
 * Build form update object from extracted data
 *
 * @param params - Object containing all extracted data and current form values
 * @returns Form update object
 */
export function buildFormUpdate(params: {
  currentFormValues: FormType;
  manga: MangaSearchResult | ExtendedMangaSearchResult;
  source: string;
  coverUrl: string | undefined;
  basicMetadata: ReturnType<typeof extractBasicMetadata>;
  parsedVolumeData: ParsedVolumeData | undefined;
  comicVineData: ComicVineData;
}): Partial<FormType> & Record<string, unknown> {
  const {
    currentFormValues,
    manga,
    source,
    coverUrl,
    basicMetadata,
    parsedVolumeData,
    comicVineData
  } = params;

  const parsedVolumeDataTyped = parsedVolumeData;

  let volumesValue: number | undefined;
  let chaptersValue: number | undefined;

  if (parsedVolumeDataTyped) {
    volumesValue = typeof parsedVolumeDataTyped.volumes === 'number'
      ? parsedVolumeDataTyped.volumes
      : (parsedVolumeDataTyped.volumes as VolumeDetail[]).length;
    chaptersValue = typeof parsedVolumeDataTyped.chapters === 'number'
      ? parsedVolumeDataTyped.chapters
      : (parsedVolumeDataTyped.chapters as unknown[]).length;
  }

  return {
    ...currentFormValues,
    mangaTitle: manga.title,
    mangaId: toStringId(manga.id),
    ...(source ? { source } : {}),
    ...(coverUrl ? { cover: coverUrl } : {}),
    ...(basicMetadata.description ? { description: basicMetadata.description } : {}),
    ...(basicMetadata.status ? { status: basicMetadata.status } : {}),
    genres: basicMetadata.genres,
    ...(parsedVolumeDataTyped ? {
      volumes: volumesValue,
      chapters: chaptersValue,
      volumeDetails: parsedVolumeDataTyped.volumeDetails
    } : {}),
    // Add ComicVine-specific fields (only if defined)
    ...(comicVineData.issues !== undefined ? { issues: comicVineData.issues } : {}),
    ...(comicVineData.characters ? { characters: comicVineData.characters } : {}),
    ...(comicVineData.creators ? { creators: comicVineData.creators } : {}),
    ...(comicVineData.publisher ? { publisher: comicVineData.publisher } : {}),
    // Preserve metadata and providerSpecific for confirmation screen
    ...('metadata' in manga && manga.metadata ? { metadata: manga.metadata } : {}),
    ...(comicVineData.rawData ? { rawData: comicVineData.rawData } : {}),
    ...(comicVineData.providerSpecific ? { providerSpecific: comicVineData.providerSpecific } : {})
  };
}

/**
 * Build selected manga object for component state
 *
 * @param params - Object containing manga data and extracted metadata
 * @returns ExtendedMangaSearchResult with all optional fields properly set
 */
export function buildSelectedManga(params: {
  manga: MangaSearchResult | ExtendedMangaSearchResult;
  source: string;
  basicMetadata: ReturnType<typeof extractBasicMetadata>;
  comicVineData: ComicVineData;
}): ExtendedMangaSearchResult & { rawData?: RawDataObject; providerSpecific?: ProviderSpecificObject } {
  const { manga, source, basicMetadata, comicVineData } = params;

  const componentMangaBase = {
    // Spread all properties from the original manga to preserve everything
    ...manga,
    id: toStringId(manga.id),
    title: manga.title,
    provider: source,
    source: source
  } as ExtendedMangaSearchResult & { rawData?: RawDataObject; providerSpecific?: ProviderSpecificObject };

  // Add optional fields separately to satisfy exactOptionalPropertyTypes
  if ('cover' in manga && typeof manga['cover'] === 'string') {
    componentMangaBase.cover = manga['cover'];
  }
  if ('coverImage' in manga && typeof manga['coverImage'] === 'string') {
    componentMangaBase.coverImage = manga['coverImage'];
  }
  if ('coverUrl' in manga && typeof manga['coverUrl'] === 'string') {
    componentMangaBase.coverUrl = manga['coverUrl'];
  }
  if (basicMetadata.description) {
    componentMangaBase.description = basicMetadata.description;
  }
  if (basicMetadata.status) {
    componentMangaBase.status = basicMetadata.status as NonNullable<ExtendedMangaSearchResult['status']>;
  }
  if (basicMetadata.genres.length > 0) {
    componentMangaBase.genres = basicMetadata.genres;
  }
  if (basicMetadata.authors.length > 0) {
    componentMangaBase.authors = basicMetadata.authors;
  }
  if (basicMetadata.alternativeTitles.length > 0) {
    componentMangaBase.alternativeTitles = basicMetadata.alternativeTitles;
  }
  if ('metadata' in manga && manga['metadata'] !== null && typeof manga['metadata'] === 'object') {
    componentMangaBase.metadata = manga['metadata'] as Record<string, unknown>;
  }
  if (comicVineData.rawData) {
    componentMangaBase.rawData = comicVineData.rawData;
  }
  if (comicVineData.providerSpecific) {
    componentMangaBase.providerSpecific = comicVineData.providerSpecific;
  }

  return componentMangaBase;
}
