/**
 * Field Extractor Utilities
 *
 * Extracts field values from provider metadata results with proper type safety.
 * This module handles the complex logic of mapping provider data fields to
 * standardized field names used in the UI.
 */

import type { ProviderMetadataResult } from '@/components/updateManga/providerFormUtils';

/**
 * AniList staff member interface for type safety
 */
export interface AniListStaff {
  role: string;
  name: string;
}

/**
 * AniList character interface for type safety
 */
export interface AniListCharacter {
  name: string;
  role?: string;
}

/**
 * Type guard to check if a value is a valid AniList staff member
 *
 * @param staff - The value to check
 * @returns True if the value conforms to AniListStaff interface
 */
export function isValidStaffMember(staff: unknown): staff is AniListStaff {
  if (staff === null || typeof staff !== 'object') return false;
  const staffObj = staff as Partial<AniListStaff>;
  return typeof staffObj.role === 'string' && typeof staffObj.name === 'string';
}

/**
 * Type guard to check if a value is a valid AniList character
 *
 * @param character - The value to check
 * @returns True if the value conforms to AniListCharacter interface
 */
export function isValidCharacter(character: unknown): character is AniListCharacter {
  if (character === null || typeof character !== 'object') return false;
  const charObj = character as Partial<AniListCharacter>;
  return typeof charObj.name === 'string';
}

/** Extracts the title field from provider data */
function extractTitle(typedData: ProviderMetadataResult): string | null {
  if ('title' in typedData && typeof typedData.title === 'string') {
    return typedData.title;
  }
  return null;
}

/** Extracts the summary/description field from provider data */
function extractSummary(typedData: ProviderMetadataResult): string | null {
  if ('description' in typedData && typeof typedData.description === 'string') {
    return typedData.description;
  }
  return null;
}

/** Extracts the status field from provider data */
function extractStatus(typedData: ProviderMetadataResult): string | null {
  if ('status' in typedData && typeof typedData.status === 'string') {
    return typedData.status;
  }
  return null;
}

/** Extracts the synonyms/alternative titles field from provider data */
function extractSynonyms(typedData: ProviderMetadataResult): string[] | null {
  if ('alternativeTitles' in typedData && Array.isArray(typedData.alternativeTitles)) {
    return typedData.alternativeTitles;
  }
  return null;
}

/** Extracts the volumes field from provider data */
function extractVolumes(typedData: ProviderMetadataResult): number | string | null {
  if ('volumes' in typedData && (typeof typedData.volumes === 'number' || typeof typedData.volumes === 'string')) {
    return typedData.volumes;
  }
  return null;
}

/** Extracts the chapters field from provider data */
function extractChapters(typedData: ProviderMetadataResult): number | string | null {
  if ('chapters' in typedData && (typeof typedData.chapters === 'number' || typeof typedData.chapters === 'string')) {
    return typedData.chapters;
  }
  return null;
}

/** Extracts the genres field from provider data */
function extractGenres(typedData: ProviderMetadataResult): string[] | null {
  if ('genres' in typedData && Array.isArray(typedData.genres)) {
    return typedData.genres;
  }
  return null;
}

/** Extracts the tags field from provider data */
function extractTags(typedData: ProviderMetadataResult): string[] | null {
  if ('tags' in typedData && Array.isArray(typedData.tags)) {
    if (typedData.tags.length > 0) {
      return typedData.tags
        .map((tag: unknown) => {
          if (typeof tag === 'string') {
            return tag;
          } else if (tag && typeof tag === 'object' && 'name' in tag) {
            const tagObj = tag as { name?: unknown };
            if (typeof tagObj.name === 'string') {
              return tagObj.name;
            }
          }
          return '';
        })
        .filter(Boolean);
    }
    return [];
  }
  return null;
}

/** Extracts the start date field from provider data */
function extractStartDate(typedData: ProviderMetadataResult): string | Date | null {
  if ('startDate' in typedData && (typeof typedData.startDate === 'string' || typedData.startDate instanceof Date)) {
    return typedData.startDate;
  }
  return null;
}

/** Extracts the end date field from provider data */
function extractEndDate(typedData: ProviderMetadataResult): string | Date | null {
  if ('endDate' in typedData && (typeof typedData.endDate === 'string' || typedData.endDate instanceof Date)) {
    return typedData.endDate;
  }
  return null;
}

/** Extracts the authors field from provider data (using staff data) */
function extractAuthors(typedData: ProviderMetadataResult): string[] | null {
  if ('staff' in typedData) {
    const staffData = typedData.staff;
    if (Array.isArray(staffData)) {
      return staffData
        .filter(isValidStaffMember)
        .filter((s) => s.role === 'Author')
        .map((s) => s.name);
    }
    return [];
  }
  return null;
}

/** Extracts the characters field from provider data */
function extractCharacters(typedData: ProviderMetadataResult): string[] | null {
  if ('characters' in typedData) {
    const characterData = typedData.characters;
    if (Array.isArray(characterData)) {
      return characterData.filter(isValidCharacter).map((c) => c.name);
    }
    return [];
  }
  return null;
}

/** Extracts cover image fields from provider data */
function extractCover(field: string, typedData: ProviderMetadataResult): string | null {
  // Check all possible cover field names
  if ('cover' in typedData && typeof typedData.cover === 'string') {
    return typedData.cover;
  } else if ('coverImage' in typedData && typeof typedData.coverImage === 'string') {
    return typedData.coverImage;
  } else if ('coverUrl' in typedData && typeof typedData['coverUrl'] === 'string') {
    return typedData['coverUrl'];
  } else if (field === 'coverLarge' && 'coverLarge' in typedData && typeof typedData.coverLarge === 'string') {
    return typedData.coverLarge;
  } else if (field === 'coverMedium' && 'coverMedium' in typedData && typeof typedData.coverMedium === 'string') {
    return typedData.coverMedium;
  } else if (field === 'coverSmall' && 'coverSmall' in typedData && typeof typedData.coverSmall === 'string') {
    return typedData.coverSmall;
  }
  return null;
}

/**
 * Extracts a field value from provider metadata based on the field name
 *
 * This function handles the mapping between provider-specific field names
 * and the standardized field names used in the UI. It includes proper
 * type checking and validation for each field type.
 *
 * @param field - The standardized field name to extract
 * @param typedData - The provider metadata result containing the data
 * @returns The extracted value or null if not found/invalid
 */
export function extractFieldValue(field: string, typedData: ProviderMetadataResult): unknown {
  switch (field) {
    case 'title':
      return extractTitle(typedData);
    case 'summary':
      return extractSummary(typedData);
    case 'status':
      return extractStatus(typedData);
    case 'synonyms':
      return extractSynonyms(typedData);
    case 'volumes':
      return extractVolumes(typedData);
    case 'chapters':
      return extractChapters(typedData);
    case 'genres':
      return extractGenres(typedData);
    case 'tags':
      return extractTags(typedData);
    case 'startDate':
      return extractStartDate(typedData);
    case 'endDate':
      return extractEndDate(typedData);
    case 'authors':
      return extractAuthors(typedData);
    case 'characters':
      return extractCharacters(typedData);
    case 'cover':
    case 'coverLarge':
    case 'coverMedium':
    case 'coverSmall':
      return extractCover(field, typedData);
    default:
      return null;
  }
}
