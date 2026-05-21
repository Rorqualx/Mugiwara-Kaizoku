/**
 * Integration Selectors Module
 *
 * Provides memoized selectors for integration configuration and status.
 * Handles komga, kavita, and notification service status aggregation.
 *
 * Extracted from: useStoreSelectors.ts (lines 450-499)
 *
 * @module store/selectors/integration-selectors
 */

import { useMemo } from 'react';

import { useIntegrationStore, useLibraryStore } from '../index';

import type { IntegrationConfig } from '../index';

/**
 * Sync information for integration services
 *
 * Tracks synchronization status for external services (komga, kavita).
 *
 * @interface SyncInfo
 */
interface SyncInfo {
  lastSync: Date | null;
  syncing: boolean;
  error: string | null;
}

/**
 * Integration configuration with sync status
 *
 * Extends base integration config with optional sync status for
 * services that support synchronization operations.
 *
 * @interface IntegrationConfigWithSync
 */
type IntegrationConfigWithSync = IntegrationConfig & {
  syncStatus?: SyncInfo;
};

/**
 * Integration status aggregation
 *
 * Aggregates status from all integration services:
 * - komgaEnabled: Whether Komga integration is active
 * - kavitaEnabled: Whether Kavita integration is active
 * - hasNotifications: Whether any notification service is enabled
 * - isConfigured: Whether at least one library is configured
 * - syncStatus: Current synchronization status for komga/kavita
 *
 * @interface IntegrationStatus
 */
export interface IntegrationStatus {
  komgaEnabled: boolean;
  kavitaEnabled: boolean;
  hasNotifications: boolean;
  isConfigured: boolean;
  syncStatus: {
    komga?: SyncInfo;
    kavita?: SyncInfo;
  };
}

/**
 * Integration selectors interface
 *
 * Provides access to integration status selector.
 *
 * @interface IntegrationSelectors
 */
export interface IntegrationSelectors {
  integrationStatus: IntegrationStatus;
}

/**
 * Hook for integration selectors
 *
 * Provides memoized selectors for integration configuration and status.
 * Aggregates status from multiple integration services (komga, kavita,
 * telegram, apprise) and computes derived state.
 *
 * Performance:
 * - Memoized with integration state and library count dependencies
 * - Only recomputes when integration configs or library count changes
 * - Type-safe property access with runtime assertions
 *
 * @returns {IntegrationSelectors} Integration status selectors
 *
 * @example
 * ```typescript
 * const { integrationStatus } = useIntegrationSelectors();
 *
 * if (integrationStatus.komgaEnabled) {
 *   // Show Komga sync status
 *   const komgaSync = integrationStatus.syncStatus.komga;
 *   if (komgaSync?.syncing) {
 *     logger.info('Komga sync in progress');
 *   }
 * }
 * ```
 */
export function useIntegrationSelectors(): IntegrationSelectors {
  const integrationState = useIntegrationStore((state) => state);
  const libraryState = useLibraryStore((state) => ({
    libraries: state.libraries
  }));

  const integrationStatus = useMemo(() => {
    // Access all integration configs directly from the state
    const integrationsData = {
      komga: integrationState.komga,
      kavita: integrationState.kavita,
      telegram: integrationState.telegram,
      apprise: integrationState.apprise
    };

    // Safely access the syncStatus property from integration configs
    const komgaConfig = integrationsData.komga as IntegrationConfigWithSync | undefined;
    const kavitaConfig = integrationsData.kavita as IntegrationConfigWithSync | undefined;
    const komgaStatusData = komgaConfig?.syncStatus;
    const kavitaStatusData = kavitaConfig?.syncStatus;

    // Create proper sync info objects with required properties
    // Only include if syncStatus exists and has the 'syncing' property
    const komgaStatus = komgaStatusData && typeof komgaStatusData === 'object' && 'syncing' in komgaStatusData ? {
      syncing: komgaStatusData['syncing'] as boolean,
      error: null,
      // Spread the original data to preserve all properties
      ...(komgaStatusData as unknown as Record<string, unknown>)
    } as SyncInfo : undefined;

    const kavitaStatus = kavitaStatusData && typeof kavitaStatusData === 'object' && 'syncing' in kavitaStatusData ? {
      syncing: kavitaStatusData['syncing'] as boolean,
      error: null,
      // Spread the original data to preserve all properties
      ...(kavitaStatusData as unknown as Record<string, unknown>)
    } as SyncInfo : undefined;

    return {
      komgaEnabled: !!integrationsData.komga.enabled,
      kavitaEnabled: !!integrationsData.kavita.enabled,
      hasNotifications: !!integrationsData.telegram.enabled || !!integrationsData.apprise.enabled,
      isConfigured: libraryState.libraries.length > 0,
      syncStatus: {
        ...(komgaStatus ? { komga: komgaStatus } : {}),
        ...(kavitaStatus ? { kavita: kavitaStatus } : {})
      }
    };
  }, [integrationState, libraryState.libraries.length]);

  return { integrationStatus };
}
