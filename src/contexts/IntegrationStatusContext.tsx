/**
 * Context for managing and sharing integration status across components
 * 
 * This context provides a centralized state management solution for 
 * integration status in the application. It offers a single source of truth
 * for the enabled/disabled state and connection status of all integrations.
 * 
 * Features:
 * - Centralized integration status state
 * - Status refresh mechanism
 * - Loading state tracking
 * - Error handling
 * - Context provider with caching
 */

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
// AsyncResult imports removed - not used in this file
import { logger } from '@/utils/logger';

import { trpc } from '../utils/trpc-client/index';

import type { IntegrationStatusData, SystemStatusResponse } from '../types/system-status';

/**
 * Context interface for integration status
 */
interface IntegrationStatusContextType {
  /** Integration status data */
  data: IntegrationStatusData | null;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Any error that occurred during data fetching */
  error: Error | null;
  /** Function to manually refresh integration status */
  refresh: () => Promise<void>;
  /** Update the enabled state of a metadata provider */
  updateMetadataProviderState: (providerId: string, enabled: boolean) => void;
}

/**
 * Default context value
 */
const defaultContextValue: IntegrationStatusContextType = {
  data: null,
  isLoading: false,
  error: null,
  refresh: (): Promise<void> => Promise.resolve(),
  updateMetadataProviderState: () => {}
};

// Create the context with default values
const IntegrationStatusContext = createContext<IntegrationStatusContextType>(defaultContextValue);

/**
 * Type guard for SystemStatusResponse
 */
function isSystemStatusResponse(data: unknown): data is SystemStatusResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  // Type assertion is needed here for property access
  const objData = data as Record<string, unknown>;

  // Check for the database, system, docker, and application properties
  return (
    'database' in objData && typeof objData['database'] === 'object' &&
    'system' in objData && typeof objData['system'] === 'object' &&
    'docker' in objData && typeof objData['docker'] === 'object' &&
    'application' in objData && typeof objData['application'] === 'object'
    // Note: integrations property is optional so we don't check for it
  );
}

/**
 * Hook for consuming the integration status context
 * 
 * @returns Integration status context values and functions
 */
export const useIntegrationStatus = (): IntegrationStatusContextType => useContext(IntegrationStatusContext);

/**
 * Provider component for the integration status context
 * 
 * @param props - Component props
 * @param props.children - Child components
 * @returns Context provider component
 */
export function IntegrationStatusProvider({ children }: {children: ReactNode;}): React.ReactElement {
  const [integrationData, setIntegrationData] = useState<IntegrationStatusData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Use actual tRPC query for system status with WebSocket + polling fallback
  const systemStatusQuery = trpc.system.getStatus.useQuery(undefined, {
    refetchInterval: isConnected ? false : 60000, // Only poll when WebSocket disconnected
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, // Prevent refetching on window focus
    staleTime: 50000 // Consider data fresh for 50 seconds
  });

  // Subscribe to WebSocket system status events for real-time updates
  // Note: Using refetch function directly as dependency to avoid infinite loop
  const { refetch: refetchSystemStatus } = systemStatusQuery;
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('system:status', () => {
      void refetchSystemStatus();
    });

    return unsubscribe;
  }, [isConnected, subscribe, refetchSystemStatus]);

  // Get tRPC utils for invalidation
  const trpcUtils = trpc.useUtils();

  // Consolidated effect: handle all query state changes in one effect
  useEffect(() => {
    // Handle data
    if (systemStatusQuery.data) {
      if (isSystemStatusResponse(systemStatusQuery.data)) {
        const newData = 'integrations' in systemStatusQuery.data ? systemStatusQuery.data.integrations : null;
        setIntegrationData((prevData) => {
          if (JSON.stringify(prevData) !== JSON.stringify(newData)) {
            return newData;
          }
          return prevData;
        });
        setIsLoading(false);
        setError(null);
      } else {
        logger.warn('System status response has unexpected structure', systemStatusQuery.data);
        setIsLoading(false);
      }
    } else if (systemStatusQuery.isLoading) {
      setIsLoading(true);
    } else if (systemStatusQuery.error) {
      setError(systemStatusQuery.error instanceof Error ? systemStatusQuery.error : new Error(String(systemStatusQuery.error)));
      setIsLoading(false);
    }
  }, [systemStatusQuery.data, systemStatusQuery.isLoading, systemStatusQuery.error]);

  /**
   * Force refresh of integration status data
   */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      await trpcUtils.system.getStatus.invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [trpcUtils]);

  /**
   * Update the enabled state of a metadata provider in the context
   */
  const updateMetadataProviderState = useCallback((providerId: string, enabled: boolean): void => {
    setIntegrationData((prevData) => {
      if (!prevData?.metadata) return prevData;

      // Create a deep copy of the current state to avoid mutation
      const updatedData: IntegrationStatusData = JSON.parse(JSON.stringify(prevData)) as IntegrationStatusData;

      // Update the provider state with proper type checking
      if (providerId === 'anilist' && updatedData.metadata?.anilist) {
        updatedData.metadata.anilist.enabled = enabled;
      } else if (providerId === 'comicvine' && updatedData.metadata?.comicvine) {
        updatedData.metadata.comicvine.enabled = enabled;
      }

      return updatedData;
    });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<IntegrationStatusContextType>(() => ({
    data: integrationData,
    isLoading,
    error,
    refresh,
    updateMetadataProviderState
  }), [integrationData, isLoading, error, refresh, updateMetadataProviderState]);

  return (
    <IntegrationStatusContext.Provider value={contextValue}>
      {children}
    </IntegrationStatusContext.Provider>
  );
}