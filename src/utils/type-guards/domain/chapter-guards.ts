/**
 * Chapter Type Guards
 *
 * Type guards for chapter domain types
 */

import { isString, isNumber, isBoolean, isObject, isArray } from '../index';

/**
 * Helper: Check required fields for chapter object
 */
function checkChapterRequiredFields(obj: Record<string, unknown>): boolean {
  return (
    'id' in obj &&
    (isString(obj['id']) || isNumber(obj['id'])) &&
    'mangaId' in obj &&
    (isString(obj['mangaId']) || isNumber(obj['mangaId'])) &&
    'title' in obj &&
    isString(obj['title'])
  );
}

/**
 * Helper: Check optional number fields for chapter object
 */
function checkChapterOptionalNumbers(obj: Record<string, unknown>): boolean {
  return (
    (!('chapterNumber' in obj) || isNumber(obj['chapterNumber'])) &&
    (!('volumeNumber' in obj) || isNumber(obj['volumeNumber'])) &&
    (!('pages' in obj) || isNumber(obj['pages']))
  );
}

/**
 * Helper: Check optional string fields for chapter object
 */
function checkChapterOptionalStrings(obj: Record<string, unknown>): boolean {
  return (
    (!('releaseDate' in obj) || isString(obj['releaseDate'])) &&
    (!('scanlator' in obj) || isString(obj['scanlator'])) &&
    (!('language' in obj) || isString(obj['language']))
  );
}

/**
 * Check if value is a valid chapter object
 */
export function isChapter(value: unknown): value is {
  id: string | number;
  mangaId: string | number;
  title: string;
  chapterNumber?: number;
  volumeNumber?: number;
  pages?: number;
  releaseDate?: string;
  scanlator?: string;
  language?: string;
} {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    checkChapterRequiredFields(obj) &&
    checkChapterOptionalNumbers(obj) &&
    checkChapterOptionalStrings(obj)
  );
}

/**
 * Check if value is a valid chapter list
 */
export function isChapterList(value: unknown): value is Array<{
  id: string | number;
  title: string;
  chapterNumber?: number;
  volumeNumber?: number;
  releaseDate?: string;
}> {
  return (
    isArray(value) &&
    value.every(item =>
      isObject(item) &&
      'id' in item &&
      (isString(item['id']) || isNumber(item['id'])) &&
      'title' in item &&
      isString(item['title']) &&
      (!('chapterNumber' in item) || isNumber(item['chapterNumber'])) &&
      (!('volumeNumber' in item) || isNumber(item['volumeNumber'])) &&
      (!('releaseDate' in item) || isString(item['releaseDate']))
    )
  );
}

/**
 * Check if value is a valid chapter download status
 */
export function isChapterDownloadStatus(value: unknown): value is {
  chapterId: string | number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
} {
  return (
    isObject(value) &&
    'chapterId' in value &&
    (isString(value['chapterId']) || isNumber(value['chapterId'])) &&
    'status' in value &&
    isString(value['status']) &&
    ['pending', 'downloading', 'completed', 'failed'].includes(value['status']) &&
    (!('progress' in value) || isNumber(value['progress'])) &&
    (!('error' in value) || isString(value['error']))
  );
}

/**
 * Check if value is a valid chapter read status
 */
export function isChapterReadStatus(value: unknown): value is {
  chapterId: string | number;
  read: boolean;
  readAt?: string;
  progress?: number;
} {
  return (
    isObject(value) &&
    'chapterId' in value &&
    (isString(value['chapterId']) || isNumber(value['chapterId'])) &&
    'read' in value &&
    isBoolean(value['read']) &&
    (!('readAt' in value) || isString(value['readAt'])) &&
    (!('progress' in value) || isNumber(value['progress']))
  );
}

/**
 * Check if value is a valid chapter source
 */
export function isChapterSource(value: unknown): value is {
  url: string;
  provider: string;
  quality?: string;
  language?: string;
} {
  return (
    isObject(value) &&
    'url' in value &&
    isString(value['url']) &&
    'provider' in value &&
    isString(value['provider']) &&
    (!('quality' in value) || isString(value['quality'])) &&
    (!('language' in value) || isString(value['language']))
  );
}