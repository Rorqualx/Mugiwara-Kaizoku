/**
 * Merge Tool Parameter Validators
 *
 * Composite parameter validation functions for the merge tool.
 */

import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import {
  validateMergeType,
  validateMangaId,
  validateAvailableProviders,
  validateSelectedProviders,
  validateUserPreferences,
  validateProviderChapters,
  validateForceRefresh,
} from './merge-tool-validators';

import type { MergeToolParams } from './merge-tool-types';

/**
 * Validate intelligent merge parameters
 */
export function validateIntelligentMergeParams(
  mangaId: number,
  availableProviders: unknown,
  userPreferences: unknown,
  forceRefresh: unknown
): AsyncResult<MergeToolParams, Error> {
  const validatedProvidersResult = validateAvailableProviders(availableProviders);
  if (isError(validatedProvidersResult)) {
    return createErrorResult(validatedProvidersResult.error);
  }
  if (!isSuccess(validatedProvidersResult)) {
    return createErrorResult(new Error('Unexpected status from providers validation'));
  }

  const validatedPreferencesResult = validateUserPreferences(userPreferences);
  if (isError(validatedPreferencesResult)) {
    return createErrorResult(validatedPreferencesResult.error);
  }
  if (!isSuccess(validatedPreferencesResult)) {
    return createErrorResult(new Error('Unexpected status from preferences validation'));
  }

  const validatedForceRefreshResult = validateForceRefresh(forceRefresh);
  if (isError(validatedForceRefreshResult)) {
    return createErrorResult(validatedForceRefreshResult.error);
  }
  if (!isSuccess(validatedForceRefreshResult)) {
    return createErrorResult(new Error('Unexpected status from force refresh validation'));
  }

  return createSuccessResult({
    mergeType: 'intelligent' as const,
    mangaId,
    availableProviders: validatedProvidersResult.data,
    userPreferences: validatedPreferencesResult.data,
    forceRefresh: validatedForceRefreshResult.data,
  });
}

/**
 * Validate selected merge parameters
 */
export function validateSelectedMergeParams(
  mangaId: number,
  selectedProviders: unknown,
  forceRefresh: unknown
): AsyncResult<MergeToolParams, Error> {
  const validatedProvidersResult = validateSelectedProviders(selectedProviders);
  if (isError(validatedProvidersResult)) {
    return createErrorResult(validatedProvidersResult.error);
  }
  if (!isSuccess(validatedProvidersResult)) {
    return createErrorResult(new Error('Unexpected status from providers validation'));
  }

  const validatedForceRefreshResult = validateForceRefresh(forceRefresh);
  if (isError(validatedForceRefreshResult)) {
    return createErrorResult(validatedForceRefreshResult.error);
  }
  if (!isSuccess(validatedForceRefreshResult)) {
    return createErrorResult(new Error('Unexpected status from force refresh validation'));
  }

  return createSuccessResult({
    mergeType: 'selected' as const,
    mangaId,
    selectedProviders: validatedProvidersResult.data,
    forceRefresh: validatedForceRefreshResult.data,
  });
}

/**
 * Validate chapters merge parameters
 */
export function validateChaptersMergeParams(
  mangaId: number,
  providerChapters: unknown,
  forceRefresh: unknown
): AsyncResult<MergeToolParams, Error> {
  const validatedChaptersResult = validateProviderChapters(providerChapters);
  if (isError(validatedChaptersResult)) {
    return createErrorResult(validatedChaptersResult.error);
  }
  if (!isSuccess(validatedChaptersResult)) {
    return createErrorResult(new Error('Unexpected status from chapters validation'));
  }

  const validatedForceRefreshResult = validateForceRefresh(forceRefresh);
  if (isError(validatedForceRefreshResult)) {
    return createErrorResult(validatedForceRefreshResult.error);
  }
  if (!isSuccess(validatedForceRefreshResult)) {
    return createErrorResult(new Error('Unexpected status from force refresh validation'));
  }

  return createSuccessResult({
    mergeType: 'chapters' as const,
    mangaId,
    providerChapters: validatedChaptersResult.data,
    forceRefresh: validatedForceRefreshResult.data,
  });
}

/**
 * Validate tool parameters (main entry point)
 */
export function validateParams(params: unknown): AsyncResult<MergeToolParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const { mergeType, mangaId, availableProviders, selectedProviders, userPreferences, providerChapters, forceRefresh } =
    params as Partial<MergeToolParams>;

  // Validate manga ID first (common to all merge types)
  const mangaIdResult = validateMangaId(mangaId);
  if (isError(mangaIdResult)) {
    return createErrorResult(mangaIdResult.error);
  }
  if (!isSuccess(mangaIdResult)) {
    return createErrorResult(new Error('Unexpected status from manga ID validation'));
  }
  const validatedMangaId = mangaIdResult.data;

  // Validate merge type
  const mergeTypeResult = validateMergeType(mergeType);
  if (isError(mergeTypeResult)) {
    return createErrorResult(mergeTypeResult.error);
  }
  if (!isSuccess(mergeTypeResult)) {
    return createErrorResult(new Error('Unexpected status from merge type validation'));
  }
  const validatedMergeType = mergeTypeResult.data;

  // Route to appropriate validator based on merge type
  switch (validatedMergeType) {
    case 'intelligent':
      return validateIntelligentMergeParams(
        validatedMangaId,
        availableProviders,
        userPreferences,
        forceRefresh
      );

    case 'selected':
      return validateSelectedMergeParams(
        validatedMangaId,
        selectedProviders,
        forceRefresh
      );

    case 'chapters':
      return validateChaptersMergeParams(
        validatedMangaId,
        providerChapters,
        forceRefresh
      );

    default:
      return createErrorResult(new Error(`Unknown merge type: ${validatedMergeType}`));
  }
}