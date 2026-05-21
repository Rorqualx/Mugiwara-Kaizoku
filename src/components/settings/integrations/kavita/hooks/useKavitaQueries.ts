/**
 * Kavita Integration Queries Hook
 *
 * Consolidates all tRPC queries for Kavita integration.
 * Provides settings, status, and libraries data with refetch functions.
 *
 * @module kavita/hooks/useKavitaQueries
 */

import { trpc } from '@/utils/trpc-client/index';

import type { KavitaQueriesData } from '../types';

/**
 * Custom hook for managing Kavita integration queries
 *
 * @returns Query data and refetch functions
 */
export function useKavitaQueries(): KavitaQueriesData {
  const { data: settingsData, refetch: refetchSettings } = trpc.settings.getIntegration.useQuery({
    type: 'kavita'
  });

  const { data: statusData, refetch: refetchStatus } = trpc.integrations.kavita.getStatus.useQuery(undefined, {
    refetchInterval: 30_000
  });

  // Type guard to check if statusData has configured and enabled properties
  const isConfiguredAndEnabled = (data: unknown): data is { configured: boolean; enabled: boolean } => {
    return typeof data === 'object' && data !== null && 'configured' in data && 'enabled' in data;
  };

  const { data: librariesData, refetch: refetchLibraries } = trpc.integrations.kavita.getLibraries.useQuery(
    undefined,
    {
      enabled: isConfiguredAndEnabled(statusData) && statusData.configured && statusData.enabled
    }
  );

  // Transform the libraries data to match the expected type
  const transformedLibrariesData = librariesData
    ? {
        libraries: librariesData.libraries.map((lib) => ({
          ...lib,
          id: String(lib.id), // Convert numeric ID to string
          lastScanned: lib.lastScanned || '' // Convert undefined to empty string
        }))
      }
    : undefined;

  return {
    settingsData,
    statusData,
    librariesData: transformedLibrariesData,
    refetch: {
      settings: refetchSettings,
      status: refetchStatus,
      libraries: refetchLibraries
    }
  };
}
