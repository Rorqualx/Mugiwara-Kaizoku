/**
 * Metadata Builder Module
 *
 * Handles construction of the metadata object for manga import.
 * Extracts and processes metadata fields from form data and additional sources.
 *
 * @module components/addManga/utils/wizard-mapper/metadata-builder
 */

import { extractValueWithoutProvider, extractArrayWithoutProviders, extractSiteName } from './helpers';

import type { MangaAddInput } from './types';

/**
 * Input data for building metadata
 */
export interface MetadataBuilderInput {
  formData: Partial<{
    title: string;
    coverUrl?: string;
    bannerUrl?: string;
    description?: string;
    synopsis?: string;
    status?: string;
    format?: string;
    publisher?: string;
    startDate?: string;
    endDate?: string;
    averageScore?: number;
    popularity?: number;
    country?: string;
    genres?: string[];
    authors?: string[];
    artists?: string[];
    tags?: string[];
    alternativeTitles?: string[];
    volumes?: number;
    chapters?: number;
  }>;
  additionalData: {
    selectedCover?: string;
    selectedBanner?: string;
    selectedGalleryImages?: string[];
    externalIds: {
      malId?: string;
      anilistId?: string;
      comicVineId?: string;
      mangaUpdatesId?: string;
      kitsuId?: string;
    };
    externalLinks: string[];
  };
  volumeCount?: number | null;
  chapterCount?: number | null;
}

/**
 * Build metadata object for manga import
 */
// eslint-disable-next-line complexity -- Complex metadata assembly with multiple field mappings
export function buildMetadata(input: MetadataBuilderInput): MangaAddInput['metadata'] {
  const { formData, additionalData, volumeCount, chapterCount } = input;
  const {
    selectedCover,
    selectedBanner,
    selectedGalleryImages,
    externalIds,
    externalLinks
  } = additionalData;

  // Prepare metadata object
  const coverValue = selectedCover ?? formData.coverUrl;
  const bannerValue = selectedBanner ?? formData.bannerUrl;
  const statusValue = extractValueWithoutProvider(formData.status);
  const formatValue = extractValueWithoutProvider(formData.format);
  const publisherValue = extractValueWithoutProvider(formData.publisher);

  // Parse external IDs - these now come from ALL providers (merged)
  const malIdValue = externalIds.malId ? parseInt(externalIds.malId, 10) : undefined;
  const anilistIdValue = externalIds.anilistId ? parseInt(externalIds.anilistId, 10) : undefined;

  const metadata: MangaAddInput['metadata'] = {
    // Cover and banner - use selected or fallback to formData
    ...(coverValue !== undefined ? { cover: coverValue } : {}),
    ...(coverValue !== undefined ? { coverLarge: coverValue } : {}),
    ...(bannerValue !== undefined ? { bannerImage: bannerValue } : {}),

    // Description - extract from formData, handling provider suffix
    description: extractValueWithoutProvider(formData.description) ??
                 extractValueWithoutProvider(formData.synopsis) ??
                 '',

    // Status - extract value without provider suffix
    ...(statusValue !== undefined ? { status: statusValue } : {}),

    // Publication details
    ...(formatValue !== undefined ? { format: formatValue } : {}),
    ...(publisherValue !== undefined ? { publisher: publisherValue } : {}),

    // Dates
    ...(formData.startDate ? { startDate: formData.startDate } : {}),
    ...(formData.endDate ? { endDate: formData.endDate } : {}),

    // Scores and popularity
    ...(formData.averageScore ? { averageScore: formData.averageScore } : {}),
    ...(formData.popularity ? { popularity: formData.popularity } : {}),
    ...(formData.country ? { countryOfOrigin: formData.country } : {}),

    // Arrays - extract values without provider suffixes
    genres: extractArrayWithoutProviders(formData.genres) ?? [],
    authors: extractArrayWithoutProviders(formData.authors) ?? [],
    artists: extractArrayWithoutProviders(formData.artists) ?? [],
    tags: extractArrayWithoutProviders(formData.tags) ?? [],
    alternativeTitles: formData.alternativeTitles ?? [],
    synonyms: formData.alternativeTitles ?? [], // Alias

    // Gallery images - user-selected images from import wizard
    ...(selectedGalleryImages?.length ? { gallery: selectedGalleryImages } : {}),

    // Volume and chapter counts
    ...(volumeCount ? { volumes: volumeCount } : {}),
    ...(chapterCount ? { chapters: chapterCount } : {}),

    // External links - transform string array to object array with site names
    ...(externalLinks.length ? {
      externalLinks: externalLinks.map(url => ({
        url,
        site: extractSiteName(url)
      }))
    } : {}),
    ...(externalLinks.length ? { urls: externalLinks } : {}),

    // External IDs from ALL providers (merged from primary + secondary)
    ...(malIdValue ? { idMal: malIdValue } : {}),
    ...(anilistIdValue ? { anilistId: anilistIdValue } : {}),
    ...(externalIds.comicVineId ? { comicVineId: externalIds.comicVineId } : {}),
    ...(externalIds.mangaUpdatesId ? { mangaUpdatesId: externalIds.mangaUpdatesId } : {})
  };

  return metadata;
}