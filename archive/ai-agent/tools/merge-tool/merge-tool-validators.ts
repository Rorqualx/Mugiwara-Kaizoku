/**
 * Merge Tool Validators
 *
 * Parameter validation functions for the merge tool.
 */

import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import type { ProviderChapter } from './merge-tool-types';



/**
 * Validate merge type parameter
 */
export function validateMergeType(mergeType: unknown): AsyncResult<'intelligent' | 'selected' | 'chapters', Error> {
  if (!mergeType || typeof mergeType !== 'string') {
    return createErrorResult(new Error('mergeType parameter is required and must be a string'));
  }

  const validMergeTypes = ['intelligent', 'selected', 'chapters'];
  if (!validMergeTypes.includes(mergeType)) {
    return createErrorResult(new Error(`mergeType must be one of: ${validMergeTypes.join(', ')}`));
  }

  return createSuccessResult(mergeType as 'intelligent' | 'selected' | 'chapters');
}

/**
 * Validate manga ID parameter
 */
export function validateMangaId(mangaId: unknown): AsyncResult<number, Error> {
  if (mangaId === undefined || typeof mangaId !== 'number') {
    return createErrorResult(new Error('mangaId parameter is required and must be a number'));
  }
  return createSuccessResult(mangaId);
}

/**
 * Validate available providers parameter
 */
export function validateAvailableProviders(availableProviders: unknown): AsyncResult<string[], Error> {
  if (!availableProviders || !Array.isArray(availableProviders)) {
    return createErrorResult(new Error('availableProviders must be an array'));
  }

  for (const provider of availableProviders) {
    if (typeof provider !== 'string') {
      return createErrorResult(new Error('availableProviders must contain only strings'));
    }
  }

  return createSuccessResult(availableProviders);
}

/**
 * Validate selected providers parameter
 */
export function validateSelectedProviders(selectedProviders: unknown): AsyncResult<Record<string, string>, Error> {
  if (!selectedProviders || typeof selectedProviders !== 'object') {
    return createErrorResult(new Error('selectedProviders must be an object'));
  }

  const validated: Record<string, string> = {};
  for (const [key, value] of Object.entries(selectedProviders)) {
    if (typeof value !== 'string') {
      return createErrorResult(new Error(`selectedProviders.${key} must be a string`));
    }
    validated[key] = value;
  }

  return createSuccessResult(validated);
}

/**
 * Validate user preferences parameter
 */
export function validateUserPreferences(userPreferences: unknown): AsyncResult<Record<string, string[]>, Error> {
  if (typeof userPreferences !== 'object') {
    return createErrorResult(new Error('userPreferences must be an object'));
  }

  const validated: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(userPreferences ?? {})) {
    if (!Array.isArray(value)) {
      return createErrorResult(new Error(`userPreferences.${key} must be an array`));
    }

    const stringArray: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string') {
        return createErrorResult(new Error(`userPreferences.${key} must contain only strings`));
      }
      stringArray.push(item);
    }

    validated[key] = stringArray;
  }

  return createSuccessResult(validated);
}

/**
 * Validate a chapter field
 */
export function validateChapterField<T>(
  chapter: Record<string, unknown>,
  fieldName: string,
  type: 'string' | 'number',
  required: boolean
): AsyncResult<T | undefined, Error> {
  const value = chapter[fieldName];
  if (value === undefined) {
    if (required) {
      return createErrorResult(new Error(`providerChapters ${fieldName} is required`));
    }
    return createSuccessResult(undefined);
  }

  if (typeof value !== type) {
    return createErrorResult(new Error(`providerChapters ${fieldName} must be a ${type}`));
  }

  return createSuccessResult(value as T);
}

/**
 * Validate a single chapter item
 */
export function validateSingleChapter(item: unknown): AsyncResult<ProviderChapter, Error> {
  if (!item || typeof item !== 'object') {
    return createErrorResult(new Error('providerChapters must contain objects'));
  }

  const chapter = item as Record<string, unknown>;

  // Validate chapterNumber (required)
  const chapterNumberResult = validateChapterField<number>(chapter, 'chapterNumber', 'number', true);
  if (isError(chapterNumberResult)) {
    return createErrorResult(chapterNumberResult.error);
  }
  if (!isSuccess(chapterNumberResult)) {
    return createErrorResult(new Error('Unexpected status from chapter number validation'));
  }

  const validatedChapter: ProviderChapter = {
    chapterNumber: chapterNumberResult.data as number,
  };

  // Validate optional fields
  const optionalFields = [
    { name: 'title', type: 'string' as const },
    { name: 'volume', type: 'number' as const },
    { name: 'description', type: 'string' as const },
    { name: 'coverImage', type: 'string' as const },
    { name: 'pages', type: 'number' as const },
    { name: 'pageCount', type: 'number' as const },
    { name: 'source', type: 'string' as const },
  ];

  for (const field of optionalFields) {
    const result = validateChapterField<unknown>(chapter, field.name, field.type, false);
    if (isError(result)) {
      return createErrorResult(result.error);
    }
    if (!isSuccess(result)) {
      return createErrorResult(new Error(`Unexpected status from ${field.name} validation`));
    }
    if (result.data !== undefined) {
      (validatedChapter as unknown as Record<string, unknown>)[field.name] = result.data;
    }
  }

  return createSuccessResult(validatedChapter);
}

/**
 * Validate provider chapters parameter
 */
export function validateProviderChapters(providerChapters: unknown): AsyncResult<ProviderChapter[], Error> {
  if (!providerChapters || !Array.isArray(providerChapters)) {
    return createErrorResult(new Error('providerChapters must be an array'));
  }

  const validated: ProviderChapter[] = [];
  for (const item of providerChapters) {
    const result = validateSingleChapter(item);
    if (isError(result)) {
      return createErrorResult(result.error);
    }
    if (!isSuccess(result)) {
      return createErrorResult(new Error('Unexpected status from chapter validation'));
    }
    validated.push(result.data);
  }

  return createSuccessResult(validated);
}

/**
 * Validate force refresh parameter
 */
export function validateForceRefresh(forceRefresh: unknown): AsyncResult<boolean, Error> {
  if (forceRefresh === undefined) {
    return createSuccessResult(false);
  }

  if (typeof forceRefresh !== 'boolean') {
    return createErrorResult(new Error('forceRefresh must be a boolean'));
  }

  return createSuccessResult(forceRefresh);
}