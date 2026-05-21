/**
 * Component for displaying integration status with external manga servers
 *
 * This component shows the current status of integrations with Komga and Kavita
 * manga servers. It displays sync status, errors, and last sync times for each
 * enabled integration.
 *
 * @remarks
 * Status States:
 * - Syncing: Active sync in progress (blue badge)
 * - Error: Sync error occurred (red badge with message)
 * - Synced: Last successful sync time (green badge)
 * - Disabled: Integration not enabled (gray badge)
 *
 * Integrations:
 * - Komga: Self-hosted manga/comic server
 * - Kavita: Self-hosted manga/comic/book server
 *
 * Error Handling:
 * - Displays error messages in badge
 * - Updates sync status on error
 * - Preserves last sync timestamp
 *
 * @example
 * ```tsx
 * // Basic usage in a settings or status page
 * function StatusPage() {
 *   return (
 *     <Box>
 *       <Title>Integration Status</Title>
 *       <IntegrationStatus />
 *     </Box>
 *   );
 * }
 * ```
 */
import React from "react";

import { Box, Text, Badge, Group } from '@mantine/core';

import { useStoreActions } from '@/store/useStoreActions';
import { useStoreSelectors } from '@/store/useStoreSelectors';
export function IntegrationStatus(): React.ReactElement {
    /** Get integration status from store */
    const storeSelectors = useStoreSelectors();
    const { integrationStatus } = storeSelectors;
    /** Get store actions for updating sync status and settings */
    const storeActions = useStoreActions();
    const { setstring: _setstring, handleUpdateSettings: _handleUpdateSettings } = storeActions;
    /**
     * Render sync status badge based on current state
     *
     * This function:
     * 1. Checks sync status
     * 2. Returns appropriate badge
     * 3. Handles null/undefined states
     *
     * @param status - Current sync status
     * @returns Badge component or null
     */
    const renderstring = (status: {
        syncing: boolean;
        error: string | null;
        lastSync: Date | null;
    } | undefined): React.ReactElement | null => {
        if (!status)
            return null;
        return (<Box>
        {status.syncing && (<Badge color="blue">Syncing</Badge>)}
        {status.error && (<Badge color="red">Error: {status.error}</Badge>)}
        {status.lastSync && !status.syncing && !status.error && (<Badge color="green">
            Last Synced: {new Date(status.lastSync).toLocaleString()}
          </Badge>)}
      </Box>);
    };
    /**
     * Handle sync error
     * Updates sync status with error message
     *
     * @param error - Error message to display
     */
    const _handleError = (error: string): void => {
        // Type guard for setstring action
        const actionFn = storeActions['setstring'];
        if (typeof actionFn === 'function') {
            (actionFn as (updates: { syncing: boolean; error: string; lastSync: Date }) => void)({
                syncing: false,
                error: error,
                lastSync: new Date()
            });
        }
    };
    return (<Box>
      <Group gap="md">
        {/* Komga Integration Status */}
        <Box>
          <Text fw={500}>Komga</Text>
          {integrationStatus.komgaEnabled ? (renderstring(integrationStatus.syncStatus.komga)) : (<Badge color="gray">Disabled</Badge>)}
        </Box>

        {/* Kavita Integration Status */}
        <Box>
          <Text fw={500}>Kavita</Text>
          {integrationStatus.kavitaEnabled ? (renderstring(integrationStatus.syncStatus.kavita)) : (<Badge color="gray">Disabled</Badge>)}
        </Box>
      </Group>
    </Box>);
}
