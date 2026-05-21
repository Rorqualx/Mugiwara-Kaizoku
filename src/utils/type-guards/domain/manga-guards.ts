/**
 * Manga Type Guards
 *
 * Type guards for manga domain types
 */

import { isString, isNumber, isBoolean, isObject, isArray } from '../index';

/**
 * Helper: Check required fields for manga object
 */
function checkMangaRequiredFields(obj: Record<string, unknown>): boolean {
  return (
    'id' in obj &&
    (isString(obj['id']) || isNumber(obj['id'])) &&
    'title' in obj &&
    isString(obj['title'])
  );
}

/**
 * Helper: Check optional string fields for manga object
 */
function checkMangaOptionalStrings(obj: Record<string, unknown>): boolean {
  return (
    (!('description' in obj) || isString(obj['description'])) &&
    (!('coverImage' in obj) || isString(obj['coverImage'])) &&
    (!('status' in obj) || isString(obj['status']))
  );
}

/**
 * Helper: Check optional array fields for manga object
 */
function checkMangaOptionalArrays(obj: Record<string, unknown>): boolean {
  return (
    (!('genres' in obj) || isArray(obj['genres'])) &&
    (!('authors' in obj) || isArray(obj['authors'])) &&
    (!('publishers' in obj) || isArray(obj['publishers']))
  );
}

/**
 * Helper: Check optional number fields for manga object
 */
function checkMangaOptionalNumbers(obj: Record<string, unknown>): boolean {
  return (
    (!('volumes' in obj) || isNumber(obj['volumes'])) &&
    (!('chapters' in obj) || isNumber(obj['chapters']))
  );
}

/**
 * Check if value is a valid manga object
 */
export function isManga(value: unknown): value is {
  id: string | number;
  title: string;
  description?: string;
  coverImage?: string;
  status?: string;
  genres?: string[];
  authors?: string[];
  publishers?: string[];
  volumes?: number;
  chapters?: number;
} {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    checkMangaRequiredFields(obj) &&
    checkMangaOptionalStrings(obj) &&
    checkMangaOptionalArrays(obj) &&
    checkMangaOptionalNumbers(obj)
  );
}

/**
 * Check if value is a valid manga search result
 */
export function isMangaSearchResult(value: unknown): value is {
  id: string | number;
  title: string;
  coverImage?: string;
  description?: string;
  provider: string;
  score?: number;
} {
  return (
    isObject(value) &&
    'id' in value &&
    (isString(value['id']) || isNumber(value['id'])) &&
    'title' in value &&
    isString(value['title']) &&
    (!('coverImage' in value) || isString(value['coverImage'])) &&
    (!('description' in value) || isString(value['description'])) &&
    'provider' in value &&
    isString(value['provider']) &&
    (!('score' in value) || isNumber(value['score']))
  );
}

/**
 * Check if value is a valid manga metadata
 */
export function isMangaMetadata(value: unknown): value is {
  title: string;
  alternativeTitles?: string[];
  description?: string;
  authors?: string[];
  artists?: string[];
  genres?: string[];
  status?: string;
  year?: number;
  publisher?: string;
} {
  return (
    isObject(value) &&
    'title' in value &&
    isString(value['title']) &&
    (!('alternativeTitles' in value) || isArray(value['alternativeTitles'])) &&
    (!('description' in value) || isString(value['description'])) &&
    (!('authors' in value) || isArray(value['authors'])) &&
    (!('artists' in value) || isArray(value['artists'])) &&
    (!('genres' in value) || isArray(value['genres'])) &&
    (!('status' in value) || isString(value['status'])) &&
    (!('year' in value) || isNumber(value['year'])) &&
    (!('publisher' in value) || isString(value['publisher']))
  );
}

/**
 * Check if value is a valid manga status
 */
export function isMangaStatus(value: unknown): value is 'ongoing' | 'completed' | 'hiatus' | 'cancelled' {
  return (
    isString(value) &&
    ['ongoing', 'completed', 'hiatus', 'cancelled'].includes(value)
  );
}

/**
 * Check if value is a valid manga provider
 */
export function isMangaProvider(value: unknown): value is {
  name: string;
  url?: string;
  supported?: boolean;
  priority?: number;
} {
  return (
    isObject(value) &&
    'name' in value &&
    isString(value['name']) &&
    (!('url' in value) || isString(value['url'])) &&
    (!('supported' in value) || isBoolean(value['supported'])) &&
    (!('priority' in value) || isNumber(value['priority']))
  );
}