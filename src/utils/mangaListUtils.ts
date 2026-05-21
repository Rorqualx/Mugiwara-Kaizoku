/**
 * Manga List Utilities
 * 
 * This module provides utility functions for type-safe operations on manga lists.
 * It handles type checking, validation, and data transformation for manga collections.
 */

import type { FilterState } from '../store/uiSlice';
import type { MangaWithRelations } from '../types/search.types';
import type {
  Manga,
  Library
} from '@prisma/client';

// import type { ID } from '../types/common';

type MangaEntity = Manga;
type LibraryEntity = Library;

/**
 * Type guard to check if an object is a valid MangaEntity
 * 
 * @param obj - The object to check
 * @returns True if the object is a valid MangaEntity
 */
export function isMangaEntity(obj: unknown): obj is MangaEntity {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const manga = obj as Partial<MangaEntity>;
  
  return (
    (typeof manga["id"] === 'string' || typeof manga["id"] === 'number') &&
    typeof manga["title"] === 'string' &&
    typeof manga.libraryId === 'number' &&
    manga.metadataId !== undefined
  );
}

/**
 * Type guard to check if an object is a valid MangaWithRelations
 * 
 * @param obj - The object to check
 * @returns True if the object is a valid MangaWithRelations
 */
export function isMangaWithRelations(obj: unknown): obj is MangaWithRelations {
  if (!isMangaEntity(obj)) {
    return false;
  }

  const manga = obj as Partial<MangaWithRelations>;
  
  return (
    Array.isArray(manga["Chapter"]) &&
    manga.Metadata !== null &&
    manga.Library !== undefined
  );
}

/**
 * Type guard to check if an object is a valid LibraryEntity
 * 
 * @param obj - The object to check
 * @returns True if the object is a valid LibraryEntity
 */
export function isLibraryEntity(obj: unknown): obj is LibraryEntity {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const library = obj as Partial<LibraryEntity>;
  
  return (
    (typeof library["id"] === 'string' || typeof library["id"] === 'number') && 
    typeof library["name"] === 'string' &&
    typeof library.path === 'string'
  );
}

/**
 * Validates and converts an array of unknown items to MangaWithRelations array
 * 
 * @param items - Array of unknown items to validate
 * @returns Array of validated MangaWithRelations objects
 */
export function validateMangaArray(items: unknown[]): MangaWithRelations[] {
  if (!Array.isArray(items)) {
    return [];
  }
  
  return items.filter(isMangaWithRelations);
}

/**
 * Validates and converts an array of unknown items to MangaWithChapters array
 * 
 * @param items - Array of unknown items to validate
 * @returns Array of validated MangaWithChapters objects
 */
export function validateMangaWithChaptersArray(items: unknown[]): MangaWithRelations[] {
  if (!Array.isArray(items)) {
    return [];
  }
  
  return items.filter((item): item is MangaWithRelations => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    
    const manga = item as Partial<MangaWithRelations>;
    
    return (
      (typeof manga["id"] === 'string' || typeof manga["id"] === 'number') &&
      typeof manga["title"] === 'string' &&
      Array.isArray(manga["Chapter"])
    );
  });
}

/**
 * Validates and converts an array of unknown items to LibraryEntity array
 * 
 * @param items - Array of unknown items to validate
 * @returns Array of validated LibraryEntity objects
 */
export function validateLibraryArray(items: unknown[]): LibraryEntity[] {
  if (!Array.isArray(items)) {
    return [];
  }
  
  return items.filter(isLibraryEntity);
}

/**
 * Type guard to check if a value is a string array
 *
 * @param value - The value to check
 * @returns True if the value is an array of strings
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Safely extracts filter values with proper type validation
 *
 * @param filters - Filter state from the store
 * @returns Validated filter state with defaults for missing values
 */
export function validateFilters(filters: Record<string, unknown>): FilterState {
  return {
    searchTerm: typeof filters['searchTerm'] === 'string' ? filters['searchTerm'] : '',
    sources: isStringArray(filters['sources']) ? filters['sources'] : [],
    status: isStringArray(filters['status']) ? filters['status'] : [],
    genres: isStringArray(filters['genres']) ? filters['genres'] : [],
    tags: isStringArray(filters['tags']) ? filters['tags'] : []
  };
}

/**
 * Converts a MangaWithRelations to MangaWithChapters
 * 
 * @param manga - The manga with relations to convert
 * @returns Converted manga with chapters for domain type compatibility
 */
export function toMangaWithChapters(manga: MangaWithRelations): MangaWithRelations {
  return {
    ...manga,
    Chapter: manga["Chapter"]
  };
}

/**
 * Safely combines libraries from different sources with deduplication
 * 
 * @param storeLibraries - Libraries from the store
 * @param apiLibraries - Libraries from the API
 * @returns Combined and deduplicated library array
 */
export function combineLibraries(
  storeLibraries: unknown,
  apiLibraries: unknown
): LibraryEntity[] {
  // Ensure we have arrays to work with
  const safeStoreLibraries = Array.isArray(storeLibraries) 
    ? validateLibraryArray(storeLibraries)
    : [];
  
  const safeApiLibraries = Array.isArray(apiLibraries)
    ? validateLibraryArray(apiLibraries)
    : [];
  
  // Start with store libraries
  const allLibraries = [...safeStoreLibraries];
  
  // Add API libraries that aren't already in the store libraries
  safeApiLibraries.forEach(apiLib => {
    if (!allLibraries.some(storeLib => storeLib["id"] === apiLib["id"])) {
      allLibraries.push(apiLib);
    }
  });
  
  return allLibraries;
}

/**
 * Type-safe manga filter function that handles missing or null properties
 * 
 * @param manga - The manga to filter
 * @param filters - The filters to apply
 * @returns True if the manga matches all filters
 */
export function filterManga(
  manga: MangaWithRelations,
  filters: FilterState
): boolean {
  // Extract search term and normalize
  const searchTerm = filters.searchTerm.toLowerCase();
  const sources = filters.sources;
  const status = filters["status"];

  // Check if we have any filters
  const hasSourceFilter = sources.length > 0;
  const hasStatusFilter = status.length > 0;
  
  // Get manga title with fallback to empty string
  const title = manga["title"].toLowerCase();
  
  // Apply search term filter
  if (searchTerm && !title.includes(searchTerm)) {
    return false;
  }
  
  // Apply source filter
  if (hasSourceFilter) {
    const mangaSource = manga["source"];
    if (!sources.includes(mangaSource)) {
      return false;
    }
  }
  
  // Apply status filter
  if (hasStatusFilter) {
    const mangaStatus = manga.publicationStatus;
    if (!status.includes(typeof mangaStatus === 'string' ? mangaStatus : '')) {
      return false;
    }
  }
  
  return true;
}