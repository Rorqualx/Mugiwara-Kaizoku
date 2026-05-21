/**
 * Type Guards for Metadata Objects
 * 
 * This module provides type guards for safely validating and narrowing
 * metadata objects with various properties.
 */

import { MangaPublicationStatus as MangaStatus } from '@prisma/client';

/**
 * Type guard to check if an object has a metadata property
 * @param obj - Object to check
 * @returns Type predicate that narrows the object type
 */
export function hasMetadata(obj: unknown): obj is { 
  metadata?: Record<string, unknown>
} {
  return obj !== null && 
    typeof obj === 'object' && 
    'metadata' in obj && 
    (obj as { metadata?: unknown }).metadata !== null &&
    typeof (obj as { metadata?: unknown }).metadata === 'object';
}

/**
 * Type guard to check if an object has a specific metadata field
 * @param obj - Object to check
 * @param field - Field name to check for
 * @returns Type predicate that narrows the object type
 */
export function hasMetadataField<T extends string>(
  obj: unknown,
  field: T
): obj is {
  metadata?: Record<T, unknown>
} {
  if (!hasMetadata(obj)) return false;
  const objWithMetadata = obj as { metadata?: unknown };
  const metadata = objWithMetadata.metadata;
  if (typeof metadata !== 'object' || metadata === null) return false;
  return field in metadata;
}

/**
 * Type guard to check if value is a string array
 * @param value - Value to check
 * @returns Type predicate that narrows to string array
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && 
    value.every(item => typeof item === 'string');
}

/**
 * Type guard to check if value is a number array
 * @param value - Value to check
 * @returns Type predicate that narrows to number array
 */
export function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && 
    value.every(item => typeof item === 'number');
}

/**
 * Type guard to check if value is a valid date
 * @param value - Value to check
 * @returns Type predicate that narrows to Date
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Type guard to check if value is a valid MangaStatus
 * @param value - Value to check
 * @returns Type predicate that narrows to MangaStatus
 */
export function isValidMangaStatus(value: unknown): value is MangaStatus {
  return typeof value === 'string' && 
    Object.values(MangaStatus).includes(value as MangaStatus);
}

/**
 * Type guard to check if object has a title property
 * @param obj - Object to check
 * @returns Type predicate that narrows the object type
 */
export function hasTitle(obj: unknown): obj is { title: string } {
  return obj !== null && 
    typeof obj === 'object' && 
    'title' in obj && 
    typeof (obj as { title: unknown }).title === 'string';
}

/**
 * Type guard to check if object has an id property
 * @param obj - Object to check
 * @returns Type predicate that narrows the object type
 */
export function hasId(obj: unknown): obj is { id: string | number } {
  return obj !== null && 
    typeof obj === 'object' && 
    'id' in obj && 
    (typeof (obj as { id: unknown }).id === 'string' || 
     typeof (obj as { id: unknown }).id === 'number');
}

/**
 * Type guard to check if object has a description property
 * @param obj - Object to check
 * @returns Type predicate that narrows the object type
 */
export function hasDescription(obj: unknown): obj is { description: string } {
  return obj !== null && 
    typeof obj === 'object' && 
    'description' in obj && 
    typeof (obj as { description: unknown }).description === 'string';
}

/**
 * Type guard to check if object has a coverUrl property
 * @param obj - Object to check
 * @returns Type predicate that narrows the object type
 */
export function hasCoverUrl(obj: unknown): obj is { coverUrl: string } {
  return obj !== null && 
    typeof obj === 'object' && 
    'coverUrl' in obj && 
    typeof (obj as { coverUrl: unknown }).coverUrl === 'string';
}

/**
 * Type guard to check if object has a status property
 * @param obj - Object to check
 * @returns Type predicate that narrows the object type
 */
export function hasStatus(obj: unknown): obj is { status: string | MangaStatus } {
  return obj !== null && 
    typeof obj === 'object' && 
    'status' in obj && 
    (typeof (obj as { status: unknown }).status === 'string');
}

/**
 * Type guard to check if object has a genres property that is a string array
 * @param obj - Object to check
 * @returns Type predicate that narrows the object type
 */
export function hasGenres(obj: unknown): obj is { genres: string[] } {
  return obj !== null && 
    typeof obj === 'object' && 
    'genres' in obj && 
    isStringArray((obj as { genres: unknown }).genres);
}

/**
 * Type guard to check if object has a tags property that is a string array
 * @param obj - Object to check
 * @returns Type predicate that narrows the object type
 */
export function hasTags(obj: unknown): obj is { tags: string[] } {
  return obj !== null && 
    typeof obj === 'object' && 
    'tags' in obj && 
    isStringArray((obj as { tags: unknown }).tags);
}

/**
 * Type guard to check if object has an authors property that is a string array
 * @param obj - Object to check
 * @returns Type predicate that narrows the object type
 */
export function hasAuthors(obj: unknown): obj is { authors: string[] } {
  return obj !== null && 
    typeof obj === 'object' && 
    'authors' in obj && 
    isStringArray((obj as { authors: unknown }).authors);
}

/**
 * Gets a string array from a value, safely handling different types
 * @param value - Value that might be an array
 * @returns String array, or empty array if value is not a valid string array
 */
export function getStringArray(value: unknown): string[] {
  if (isStringArray(value)) {
    return value;
  }
  
  if (Array.isArray(value)) {
    return value.map(item => String(item)).filter(Boolean);
  }
  
  return [];
}

/**
 * Processes authors array safely, handling different formats
 * @param authors - Authors array that may contain objects or strings
 * @returns Array of author names as strings
 */
export function processAuthors(authors: unknown): string[] {
  if (!Array.isArray(authors)) return [];
  
  return authors.map((author) => {
    // If the author is already a string, use it
    if (typeof author === 'string') return author;
    
    // If the author is an object with a name property, use the name
    if (author !== null && typeof author === 'object' && 'name' in author) {
      const authorName = (author as { name: unknown }).name;
      if (typeof authorName === 'string') return authorName;
    }
    
    // Default fallback
    return 'Unknown';
  });
}