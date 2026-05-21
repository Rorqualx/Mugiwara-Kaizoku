/**
 * Standardized Metadata Providers Hook
 *
 * This hook provides access to the standardized metadata service through tRPC,
 * allowing components to interact with metadata providers using domain types directly.
 * Uses AsyncResult pattern for consistent error handling and type safety.
 */

import { useCallback, useState } from 'react';

import { createErrorResult, createSuccessResult } from '../utils/async-result';
import { trpc } from '../utils/trpc-client';
import { isObject, isString, isArray } from '../utils/type-guards';

import type { MangaSearchResult } from '../types/search.types';
import type { AsyncResult } from '../utils/async-result';
import type { Manga as MangaEntity } from '@prisma/client';

/**
 * Utility function to create a type-safe error message
 */
function createErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (isString(error)) {
    return error;
  }

  return String(error);
}

export interface UseMetadataProvidersResult {
  /**
   * Search for manga across all enabled providers
   * Uses AsyncResult pattern for type-safe error handling
   */
  searchManga: (
  query: string,
  options?: {
    providers?: string[];
    limit?: number;
    includeAdult?: boolean;
  })
  => Promise<AsyncResult<MangaSearchResult[], Error>>;

  /**
   * Get manga details from a specific provider
   * Uses AsyncResult pattern for type-safe error handling
   */
  getMangaDetails: (
  providerId: string,
  sourceId: string)
  => Promise<AsyncResult<MangaEntity, Error>>;

  /**
   * Update manga metadata in the database
   * Uses AsyncResult pattern for type-safe error handling
   */
  updateMangaMetadata: (
  mangaId: number,
  providerId: string)
  => Promise<AsyncResult<MangaEntity, Error>>;

  /**
   * Create a new manga from provider metadata
   * Uses AsyncResult pattern for type-safe error handling
   */
  createMangaFromProvider: (
  providerId: string,
  sourceId: string,
  libraryId: number)
  => Promise<AsyncResult<{id: number;title: string;}, Error>>;

  /**
   * Get all available provider IDs
   * Uses AsyncResult pattern for type-safe error handling
   */
  getAvailableProviders: () => Promise<AsyncResult<string[], Error>>;

  /**
   * Check if metadata is being loaded
   */
  isLoading: boolean;
}

/**
 * Hook for accessing metadata providers
 * Implements type-safe AsyncResult pattern for all operations
 */
export function useMetadataProviders(): UseMetadataProvidersResult {
  // Get tRPC context utilities for direct API calls
  const utils = trpc.useUtils();

  // Track loading state
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Search manga query with AsyncResult pattern using proper tRPC v11 utilities
  const searchManga = useCallback(async (
    query: string,
    options?: {
      providers?: string[];
      limit?: number;
      includeAdult?: boolean;
    }
  ): Promise<AsyncResult<MangaSearchResult[], Error>> => {
    setIsLoading(true);

    try {
      // Use tRPC utils directly - this is the proper tRPC v11 pattern
      // Provider IDs must match the keys in UnifiedProviderRegistry (uppercase)
      const defaultProviders = ['ANILIST', 'MANGADEX', 'COMICVINE', 'FANDOM', 'WIKIPEDIA'];
      const requestedProviderIds = options?.providers?.map(p => p.toUpperCase()) ?? defaultProviders;

      const result = await utils.manga.searchProviderConfirmation.fetch({
        title: query,
        providers: requestedProviderIds
      });

      // Transform the provider-grouped results into a flat array
      if (!isObject(result)) {
        return createSuccessResult<MangaSearchResult[], Error>([]);
      }

      const resultData = 'results' in result ? (result as { results: Record<string, unknown[]> }).results : result as Record<string, unknown[]>;
      const allResults: MangaSearchResult[] = [];

      Object.entries(resultData).forEach(([_providerName, providerData]: [string, unknown]) => {
        if (Array.isArray(providerData)) {
          const typedData = providerData.filter((item): item is MangaSearchResult =>
            isObject(item) && 'id' in item && 'title' in item
          );
          allResults.push(...typedData);
        }
      });

      return createSuccessResult<MangaSearchResult[], Error>(allResults);
    } catch (error) {
      return createErrorResult(new Error(`Failed to search: ${createErrorMessage(error)}`));
    } finally {
      setIsLoading(false);
    }
  }, [utils.manga.searchProviderConfirmation]);

  // Get manga details query - stub implementation
  const getMangaDetails = useCallback((
    _providerId: string,
    _sourceId: string
  ): Promise<AsyncResult<MangaEntity, Error>> => {
    setIsLoading(true);
    try {
      // This endpoint doesn't exist yet - return appropriate error
      return Promise.resolve(createErrorResult(new Error('getMangaDetails not implemented yet')));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update manga metadata mutation - stub implementation
  const updateMangaMetadata = useCallback((
    _mangaId: number,
    _providerId: string
  ): Promise<AsyncResult<MangaEntity, Error>> => {
    setIsLoading(true);
    try {
      // This endpoint doesn't exist in metadata router yet
      return Promise.resolve(createErrorResult(new Error('updateMangaMetadata not implemented yet')));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create manga from provider mutation - stub implementation
  const createMangaFromProvider = useCallback((
    _providerId: string,
    _sourceId: string,
    _libraryId: number
  ): Promise<AsyncResult<{ id: number; title: string }, Error>> => {
    setIsLoading(true);
    try {
      // This endpoint doesn't exist in metadata router yet
      return Promise.resolve(createErrorResult(new Error('createMangaFromProvider not implemented yet')));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get available providers using proper tRPC v11 pattern
  const getAvailableProviders = useCallback(async (): Promise<AsyncResult<string[], Error>> => {
    setIsLoading(true);
    try {
      // Use search.getProviders which exists in the router
      const providers = await utils.search.getProviders.fetch();

      if (!isArray(providers)) {
        return createSuccessResult<string[], Error>([]);
      }

      // Extract provider IDs from the response
      const providerIds: string[] = [];
      for (const p of providers) {
        if (isObject(p) && 'id' in p) {
          const id = (p as { id: unknown }).id;
          if (isString(id)) {
            providerIds.push(id);
          }
        }
      }

      return createSuccessResult<string[], Error>(providerIds);
    } catch (error) {
      return createErrorResult(new Error(`Failed to get providers: ${createErrorMessage(error)}`));
    } finally {
      setIsLoading(false);
    }
  }, [utils.search.getProviders]);

  return {
    searchManga,
    getMangaDetails,
    updateMangaMetadata,
    createMangaFromProvider,
    getAvailableProviders,
    isLoading
  };
}
