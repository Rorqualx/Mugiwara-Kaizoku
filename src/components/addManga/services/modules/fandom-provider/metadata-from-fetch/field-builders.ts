/**
 * Field-specific builders for metadata construction
 */

import type { ProviderMetadata, Volume, Chapter } from '@/types/universalImportWizard.types';

/**
 * Build basic identification and description fields
 */
export function buildBasicFields(
  data: Record<string, unknown>,
  result: Record<string, unknown>,
  url: string
): Partial<ProviderMetadata> {
  const fields: Partial<ProviderMetadata> = {};

  // Basic identification
  fields.id = String(result['id'] ?? url);
  fields.sourceId = String(result['sourceId'] ?? url);

  // Title
  const title = data['title'];
  if (typeof title === 'string') fields.title = title;

  // Description
  const description = data['description'];
  const synopsis = data['synopsis'];
  const descValue = typeof description === 'string' ? description : (typeof synopsis === 'string' ? synopsis : undefined);
  if (descValue) fields.description = descValue;

  // Synopsis
  const synValue = typeof synopsis === 'string' ? synopsis : (typeof description === 'string' ? description : undefined);
  if (synValue) fields.synopsis = synValue;

  return fields;
}

/**
 * Infer publication status from dates when not directly available
 */
function inferStatusFromDates(startDate: string | undefined, endDate: string | undefined): string {
  // If we have an end date, it's completed
  if (endDate) {
    return 'COMPLETED';
  }

  // If we have a start date but no end date
  if (startDate) {
    // Check if start date is in the future
    const startDateObj = new Date(startDate);
    if (!isNaN(startDateObj.getTime()) && startDateObj > new Date()) {
      return 'UPCOMING';
    }
    // Has started, no end date = ongoing
    return 'ONGOING';
  }

  // No date info, can't infer
  return '';
}

/**
 * Build status and format fields
 */
export function buildStatusAndFormat(data: Record<string, unknown>): Partial<ProviderMetadata> {
  const fields: Partial<ProviderMetadata> = {};

  // Status - prefer direct status, fall back to date inference
  const status = data['status'];
  if (typeof status === 'string' && status.trim()) {
    fields.status = status;
  } else {
    // Infer from dates
    const startDate = data['startDate'] ?? data['releaseDate'];
    const endDate = data['endDate'];
    const startDateStr = typeof startDate === 'string' ? startDate : undefined;
    const endDateStr = typeof endDate === 'string' ? endDate : undefined;
    const inferredStatus = inferStatusFromDates(startDateStr, endDateStr);
    if (inferredStatus) fields.status = inferredStatus;
  }

  // Format
  const format = data['format'];
  const formatType = data['type'];
  const formatValue = typeof format === 'string' ? format : (typeof formatType === 'string' ? formatType : undefined);
  if (formatValue) fields.format = formatValue;

  return fields;
}

/**
 * Build array fields (genres, tags, themes)
 */
export function buildArrayFields(
  data: Record<string, unknown>,
  metadata: Record<string, unknown> | undefined
): Partial<ProviderMetadata> {
  const fields: Partial<ProviderMetadata> = {};

  // Genres
  const genres = data['genres'];
  const genresValue = Array.isArray(genres) ? genres : (metadata && Array.isArray(metadata['genres']) ? metadata['genres'] : undefined);
  if (genresValue) fields.genres = genresValue as string[];

  // Tags
  const tags = data['tags'];
  const tagsValue = Array.isArray(tags) ? tags : (metadata && Array.isArray(metadata['tags']) ? metadata['tags'] : undefined);
  if (tagsValue) fields.tags = tagsValue as string[];

  // Themes
  const themes = data['themes'];
  const themesValue = Array.isArray(themes) ? themes : (metadata && Array.isArray(metadata['themes']) ? metadata['themes'] : undefined);
  if (themesValue) fields.themes = themesValue as string[];

  return fields;
}

/**
 * Build creator fields (authors, artists)
 */
export function buildCreatorFields(
  data: Record<string, unknown>,
  metadata: Record<string, unknown> | undefined,
  result: Record<string, unknown>
): Partial<ProviderMetadata> {
  const fields: Partial<ProviderMetadata> = {};

  // Authors
  const authors = data['authors'];
  const authorsValue = Array.isArray(authors) ? authors : (metadata && Array.isArray(metadata['authors']) ? metadata['authors'] : (result['authors'] ?? undefined));
  if (authorsValue) fields.authors = authorsValue as string[];

  // Artists
  const artists = data['artists'];
  const artistsValue = Array.isArray(artists) ? artists : (metadata && Array.isArray(metadata['artists']) ? metadata['artists'] : (result['artists'] ?? undefined));
  if (artistsValue) fields.artists = artistsValue as string[];

  return fields;
}

/**
 * Build publication fields (publisher, demographic, dates)
 */
export function buildPublicationFields(data: Record<string, unknown>): Partial<ProviderMetadata> {
  const fields: Partial<ProviderMetadata> = {};

  // Publisher
  const publisher = data['publisher'];
  if (typeof publisher === 'string') fields.publisher = publisher;

  // Demographic
  const demographic = data['demographic'];
  if (typeof demographic === 'string') fields.demographic = demographic;

  // Start date
  const releaseDate = data['releaseDate'];
  const startDate = data['startDate'];
  const startDateValue = typeof releaseDate === 'string' ? releaseDate : (typeof startDate === 'string' ? startDate : undefined);
  if (startDateValue) fields.startDate = startDateValue;

  // End date
  const endDate = data['endDate'];
  if (typeof endDate === 'string') fields.endDate = endDate;

  return fields;
}

/**
 * Build image fields (cover, alternative titles)
 */
export function buildImageFields(
  data: Record<string, unknown>,
  coverArt: Record<string, unknown> | undefined
): Partial<ProviderMetadata> {
  const fields: Partial<ProviderMetadata> = {};

  // Cover image - check both 'coverImage' and 'cover' (server returns 'cover')
  const coverImage = data['coverImage'] ?? data['cover'];
  const coverImageValue = coverArt && typeof coverArt['primary'] === 'string' ? coverArt['primary'] : (typeof coverImage === 'string' ? coverImage : undefined);
  if (coverImageValue) fields.coverImage = coverImageValue;

  // Alternative titles
  const alternativeTitles = data['alternativeTitles'];
  const altTitlesValue = Array.isArray(alternativeTitles) ? alternativeTitles : undefined;
  if (altTitlesValue) fields.alternativeTitles = altTitlesValue as string[];

  return fields;
}

/**
 * Build external link fields (idMal, externalLinks, etc.)
 */
export function buildExternalLinkFields(data: Record<string, unknown>): Partial<ProviderMetadata> {
  const fields: Partial<ProviderMetadata> = {};
  const externalLinks: string[] = [];

  // MyAnimeList ID (server returns myAnimeListId, client type uses idMal)
  const myAnimeListId = data['myAnimeListId'];
  if (typeof myAnimeListId === 'number') {
    fields.idMal = myAnimeListId;
  } else if (typeof myAnimeListId === 'string') {
    fields.idMal = parseInt(myAnimeListId, 10);
  }

  // MyAnimeList URL - add to externalLinks array
  const myAnimeListUrl = data['myAnimeListUrl'];
  if (typeof myAnimeListUrl === 'string' && myAnimeListUrl.startsWith('http')) {
    externalLinks.push(myAnimeListUrl);
  }

  // Add externalLinks if any were found
  if (externalLinks.length > 0) {
    fields.externalLinks = externalLinks;
  }

  return fields;
}

/**
 * Build volume and chapter data fields
 */
export function buildVolumeChapterData(
  data: Record<string, unknown>,
  volumesAndChapters: Record<string, unknown> | undefined,
  volumeCount: number,
  chapterCount: number
): Partial<ProviderMetadata> {
  const fields: Partial<ProviderMetadata> = {};

  // Volumes and chapters counts
  if (volumeCount > 0) fields.volumes = volumeCount;
  if (chapterCount > 0) fields.chapters = chapterCount;

  // Detailed volume data
  const volumes = data['volumes'];
  const volumeDataValue = volumesAndChapters && Array.isArray(volumesAndChapters['volumes']) ? volumesAndChapters['volumes'] : (Array.isArray(volumes) ? volumes : undefined);
  if (volumeDataValue) fields.volumeData = volumeDataValue as Volume[];

  // Detailed chapter data
  const chapters = data['chapters'];
  const chapterDataValue = volumesAndChapters && Array.isArray(volumesAndChapters['chapters']) ? volumesAndChapters['chapters'] : (Array.isArray(chapters) ? chapters : undefined);
  if (chapterDataValue) fields.chapterData = chapterDataValue as Chapter[];

  return fields;
}
