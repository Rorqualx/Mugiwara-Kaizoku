/**
 * Provider-specific data extraction utilities
 *
 * @module metadata-editor/data-extractors
 */

import type { FieldExtractor } from './types';

/**
 * Extract field value from Fandom data
 */
export function extractFromFandom(field: string, data: Record<string, unknown>): unknown {
  const fieldMap: Record<string, string> = {
    cover: 'cover',
    description: 'description',
    alternativeTitles: 'alternativeTitles',
    genres: 'genres',
    authors: 'authors',
    status: 'status',
  };

  const mappedField = fieldMap[field] ?? field;
  return data[mappedField];
}

/**
 * Extract field value from AniList data
 */
export function extractFromAniList(field: string, data: Record<string, unknown>): unknown {
  const fieldMap: Record<string, string> = {
    cover: 'cover',
    description: 'description',
    alternativeTitles: 'alternativeTitles',
    genres: 'genres',
    authors: 'authors',
    status: 'status',
    volumes: 'volumes',
    chapters: 'chapters',
    averageScore: 'averageScore',
    popularity: 'popularity',
    startDate: 'startDate',
    endDate: 'endDate',
  };

  const mappedField = fieldMap[field] ?? field;
  return data[mappedField];
}

/**
 * Extract field value from ComicVine data
 */
export function extractFromComicVine(field: string, data: Record<string, unknown>): unknown {
  switch (field) {
    case 'cover': {
      const image = data['image'];
      if (image && typeof image === 'object' && 'original_url' in image) {
        return image['original_url'];
      }
      return undefined;
    }
    case 'publisher': {
      const publisher = data['publisher'];
      if (publisher && typeof publisher === 'object' && 'name' in publisher) {
        return publisher['name'];
      }
      return undefined;
    }
    case 'volumes':
      return data['count_of_issues'];
    case 'description':
      return data['description'];
    default:
      return data[field];
  }
}

/**
 * Extract field value from image URL data
 */
export function extractFromImageUrl(field: string, data: Record<string, unknown>): unknown {
  const imageFields = ['cover', 'banner', 'volumeCovers', 'chapterArt'];
  if (imageFields.includes(field)) {
    return data['imageUrl'];
  }
  return undefined;
}

/**
 * Extract field value from Wikipedia data
 */
export function extractFromWikipedia(field: string, data: Record<string, unknown>): unknown {
  if (field === 'volumes') {
    const volumeDetails = data['volumeDetails'];
    if (Array.isArray(volumeDetails)) {
      return volumeDetails.length;
    }
  }

  if (field === 'chapters' && data['chapters']) {
    return data['chapters'];
  }

  return data[field];
}

/**
 * Extract field value from JSON data
 */
export function extractFromJson(field: string, data: Record<string, unknown>): unknown {
  const commonMappings: Record<string, string[]> = {
    title: ['title', 'name', 'Title', 'Name'],
    description: ['description', 'summary', 'synopsis', 'Description'],
    cover: ['cover', 'coverImage', 'image', 'thumbnail', 'cover_url'],
    genres: ['genres', 'tags', 'categories'],
    authors: ['authors', 'author', 'creators', 'writer'],
  };

  const possibleKeys = commonMappings[field] ?? [field];

  for (const key of possibleKeys) {
    if (data[key] !== undefined) {
      return data[key];
    }
  }

  return undefined;
}

/**
 * Provider-specific extractor registry
 */
const extractors: Record<string, FieldExtractor> = {
  fandom: extractFromFandom,
  anilist: extractFromAniList,
  comicvine: extractFromComicVine,
  image: extractFromImageUrl,
  wikipedia: extractFromWikipedia,
  json: extractFromJson,
};

/**
 * Extract appropriate field value from parsed data based on data type
 */
export function extractFieldFromParsedData(
  field: string,
  parsedData: Record<string, unknown>,
  dataType: string
): unknown {
  const extractor = extractors[dataType];

  if (extractor) {
    return extractor(field, parsedData);
  }

  // Default: try direct field access
  return parsedData[field];
}
