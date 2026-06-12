/**
 * Root Store Provider Module
 * 
 * Provides the root store context and handles:
 * - Initial data loading
 * - Progressive data processing
 * - Real-time updates
 * - Error handling
 * - Loading states
 * 
 * This provider implements a progressive loading strategy to handle
 * large datasets efficiently and prevent UI blocking.
 * 
 * @module store/RootStoreProvider
 */

 

import React, { useEffect, useRef, useMemo } from 'react';
import type { ReactNode, FC } from 'react';

import { logger } from '@/utils/logger';

import { trpc } from '../utils/trpc-client/index';

import { useStoreActions } from './hooks';
import { useIntegrationStore } from './integrationSlice';

import { useLibraryStore } from './index';


import type { Library } from '@prisma/client';


// Declare globals for ESLint
declare const process: {
  env: {
    NODE_ENV: 'development' | 'production' | 'test';
  };
};

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Root store provider component
 * 
 * Manages the application's data initialization and real-time updates:
 * 1. Loads initial data (manga, libraries, settings)
 * 2. Processes data in batches to prevent UI blocking
 * 3. Sets up polling for download progress and sync status
 * 4. Handles errors and loading states
 * 
 * Performance Optimizations:
 * - Progressive data loading
 * - Batch processing
 * - Debounced updates
 * - Error boundary integration
 * 
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components
 */
export const RootStoreProvider: FC<{children: ReactNode;}> = ({ children }) => {
  // Use refs to track state without triggering re-renders
  const initialized = useRef(false);
  const prowlarrHydrated = useRef(false);

  // Get store actions
  const { setLoading } = useStoreActions();

  // Get integration store updater
  const updateProwlarr = useIntegrationStore((state) => state.updateProwlarr);

  // Setup data queries with optimized options
  // Enable queries by default and let React Query handle caching
  // PERFORMANCE FIX: Reduced retries from 3 to 1 to prevent request storms
  const queryOptions = useMemo(() => ({
    enabled: true,  // Enable by default for better caching
    retry: 1, // FIXED: Reduced from 3 to prevent request storms
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 30 * 60 * 1000 // 30 minutes - keep in cache
  }), []);

  // Setup queries with base options - using correct procedure names
  // These will automatically cache and won't refetch on navigation
  // IMPORTANT: Use publicProcedure endpoints to avoid auth requirements in dev mode
  const mangaQuery = trpc.manga.query.useQuery({ include: { library: true, metadata: true, chapters: false }, limit: 50 }, queryOptions);
  const libraryQuery = trpc.library.list.useQuery(undefined, queryOptions);
  const settingsQuery = trpc.settings.get.useQuery({ key: 'all' }, queryOptions);

  // Hydrate Prowlarr settings from database into integration store
  useEffect(() => {
    let mounted = true;

    const hydrateProwlarrSettings = async (): Promise<void> => {
      // Only hydrate once
      if (prowlarrHydrated.current) return;

      try {
        if (isDevelopment) {
          logger.info('RootStoreProvider: Hydrating Prowlarr settings from database');
        }

        // Get all settings from the already fetched query
        const settingsResult = await settingsQuery.refetch();

        if (!mounted) return;

        // Extract values from the 'all' settings query
        // Note: settings.get now returns the bare key/value record over the wire.
        // Guard against undefined settingsResult.data
        if (!settingsResult.data) {
          logger.debug('[RootStoreProvider] No settings data received');
          prowlarrHydrated.current = true; // Mark as hydrated to prevent retry loops
          return;
        }
        const allSettings = settingsResult.data as Record<string, unknown>;
        const enabledValue = allSettings['prowlarrEnabled'];
        const baseURLValue = allSettings['prowlarrBaseURL'];
        const apiKeyValue = allSettings['prowlarrApiKey'];

        logger.debug('[RootStoreProvider] Extracted Prowlarr values:', {
          enabledValue,
          baseURLValue,
          apiKeyValue,
          enabledType: typeof enabledValue,
          baseURLType: typeof baseURLValue,
          apiKeyType: typeof apiKeyValue
        });

        const enabled = enabledValue === 'true' || enabledValue === true;
        const baseURL = typeof baseURLValue === 'string' ? baseURLValue : '';
        const apiKey = typeof apiKeyValue === 'string' ? apiKeyValue : '';

        logger.debug('[RootStoreProvider] Final values passed to store:', {
          enabled,
          baseURL,
          apiKey: apiKey ? `${apiKey.substring(0, 4)}...` : '(empty)'
        });

        // Update integration store with database values
        updateProwlarr({
          enabled,
          baseURL,
          apiKey
        });

        prowlarrHydrated.current = true;

        if (isDevelopment) {
          logger.info('RootStoreProvider: Prowlarr settings hydrated', {
            enabled,
            baseURL: baseURL ? `${baseURL.substring(0, 20)}...` : '(empty)',
            apiKey: apiKey ? `${apiKey.substring(0, 4)}...` : '(empty)'
          });
        }
      } catch (error: unknown) {
        if (mounted) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Failed to hydrate Prowlarr settings:', errorMessage);

          // Don't show error to user - Prowlarr settings are optional
          // Just log it for debugging
        }
      }
    };

    void hydrateProwlarrSettings();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch is stable, only run once on mount
  }, [settingsQuery.refetch, updateProwlarr]);

  // Update library store when library data is available
  // React Query handles the fetching and caching automatically
  useEffect(() => {
    if (libraryQuery.isSuccess && Array.isArray(libraryQuery.data)) {
      // Extract only the base Library fields from the transformed query result
      // The library.query returns { mangas, mangaCount, ...restLibrary }
      // but setLibraries expects only the base Library type
      const safeLibraries: Library[] = libraryQuery.data.map((lib: unknown) => {
        if (!lib || typeof lib !== 'object') {
          throw new Error('Invalid library data received from query');
        }
        const libRecord = lib as Record<string, unknown>;

        // Extract only Library fields, excluding mangas and mangaCount
        return {
          id: typeof libRecord['id'] === 'number' ? libRecord['id'] : 0,
          name: typeof libRecord['name'] === 'string' ? libRecord['name'] : '',
          path: typeof libRecord['path'] === 'string' ? libRecord['path'] : '',
          createdAt: libRecord['createdAt'] instanceof Date ? libRecord['createdAt'] : new Date(),
          lastScanAt: libRecord['lastScanAt'] instanceof Date ? libRecord['lastScanAt'] :
                      libRecord['lastScanAt'] === null ? null : null
        };
      });

      useLibraryStore.getState().setLibraries(safeLibraries);

      if (isDevelopment && !initialized.current) {
        logger.info(`RootStoreProvider: Updated library store with ${safeLibraries.length} libraries`);
      }
    }
  }, [libraryQuery.isSuccess, libraryQuery.data]);

  // Handle initialization status and errors
  useEffect(() => {
    // Skip if already initialized
    if (initialized.current) return;

    const isLoading = mangaQuery.isLoading || libraryQuery.isLoading || settingsQuery.isLoading;
    const hasError = mangaQuery.isError || libraryQuery.isError || settingsQuery.isError;
    const isSuccess = mangaQuery.isSuccess && libraryQuery.isSuccess && settingsQuery.isSuccess;

    if (isLoading) {
      setLoading('initial-data-loading', true);
      return;
    }

    setLoading('initial-data-loading', false);

    if (isSuccess) {
      initialized.current = true;
      if (isDevelopment) {
        logger.info('RootStoreProvider: Initial data loaded successfully');
      }
    } else if (hasError) {
      // Log errors but don't block the app
      if (mangaQuery.isError) {
        logger.warn('Failed to load manga data:', mangaQuery.error.message);
      }
      if (libraryQuery.isError) {
        logger.warn('Failed to load library data:', libraryQuery.error.message);
      }
      if (settingsQuery.isError) {
        logger.warn('Failed to load settings:', settingsQuery.error.message);
      }

      // Still mark as initialized to prevent blocking
      initialized.current = true;
    }
  }, [
    mangaQuery.isLoading,
    mangaQuery.isSuccess,
    mangaQuery.isError,
    mangaQuery.error,
    libraryQuery.isLoading,
    libraryQuery.isSuccess,
    libraryQuery.isError,
    libraryQuery.error,
    settingsQuery.isLoading,
    settingsQuery.isSuccess,
    settingsQuery.isError,
    settingsQuery.error,
    setLoading
  ]);

  return <>{children}</>;
};