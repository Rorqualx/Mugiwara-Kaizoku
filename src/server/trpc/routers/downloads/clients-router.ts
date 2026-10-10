/**
 * Downloads Clients Router
 *
 * Handles download client management operations including listing,
 * configuration, and testing of download clients.
 *
 * Procedures:
 * - list: List available download clients
 * - getConfig: Get current client configuration
 * - updateConfig: Update client configuration
 * - test: Test client connection
 *
 * Extracted from: downloads.ts (lines 161-294)
 *
 * ESLint fixes applied:
 * - no-await-in-loop in getConfig: Fixed (uses getEnabledClients)
 * - no-await-in-loop in updateConfig: Fixed (uses Promise.all)
 */

import { z } from 'zod';

import { toTRPCError } from '@/server/trpc/errors';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { getConfiguredClient, getEnabledClients } from './client-config';
import { downloadClientConfigSchema } from './utils';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Available download client info
 */
interface DownloadClientInfo {
  id: string;
  name: string;
  supported: boolean;
}

/**
 * Client test result
 */
interface ClientTestResult {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================================================
// Router Definition
// ============================================================================

/**
 * Clients management router
 *
 * Provides operations for managing download client configuration
 * and testing connections.
 */
/** Config keys under `download.<type>.` that hold credentials. */
const SECRET_CONFIG_KEY = /(password|apikey|api_key|token|secret)$/i;

export const downloadsClientsRouter = router({
  /**
   * List available download clients
   *
   * Returns a static list of supported download client types
   * with their names and support status.
   */
  list: protectedProcedure.query((): DownloadClientInfo[] => {
    return [
      { id: 'transmission', name: 'Transmission', supported: true },
      { id: 'deluge', name: 'Deluge', supported: true },
      { id: 'nzbget', name: 'NZBGet', supported: true },
      { id: 'sabnzbd', name: 'SABnzbd', supported: true },
    ];
  }),

  /**
   * Get current client configuration
   *
   * Reads from Config table for all enabled clients.
   * Returns the first enabled client as primary (for backwards compatibility).
   *
   * ESLint fix: Uses getEnabledClients() which uses Promise.all
   * instead of await-in-loop pattern.
   */
  getConfig: adminProcedure.query(async (): Promise<{
    type: string;
    enabled: boolean;
    config: Record<string, string>;
  } | null> => {
    try {
      // Use the refactored helper to avoid await-in-loop
      const clients = await getEnabledClients();
      // Return first enabled client as primary (for backwards compatibility)
      const firstClient = clients[0];
      if (!firstClient) return null;
      // Never send stored credentials back to a browser; updateConfig only
      // overwrites them when a new value is supplied.
      return {
        ...firstClient,
        config: Object.fromEntries(
          Object.entries(firstClient.config).filter(([key]) => !SECRET_CONFIG_KEY.test(key))
        ),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        '[downloads.ts] Failed to get download config:',
        errorMessage
      );
      return null;
    }
  }),

  /**
   * Update client configuration
   *
   * Writes to Config table using proper keys.
   * Uses upsert to create or update config entries.
   *
   * ESLint fix: Uses Promise.all for parallel upserts
   * instead of await-in-loop pattern.
   *
   * @returns true when the configuration was persisted
   * @throws TRPCError when the configuration could not be saved
   */
  updateConfig: adminProcedure
    .input(downloadClientConfigSchema)
    .mutation(
      async ({ input, ctx }): Promise<boolean> => {
        try {
          const clientType = input.type;
          const prefix = `download.${clientType}.`;

          // Build updates array
          const updates: Array<{ key: string; value: string }> = [
            { key: `${prefix}enabled`, value: 'true' },
            {
              key: `${prefix}baseURL`,
              value: `${input.ssl ? 'https' : 'http'}://${input.host}:${input.port}${input.path ?? ''}`,
            },
          ];

          if (input.username) {
            updates.push({ key: `${prefix}username`, value: input.username });
          }
          if (input.password) {
            updates.push({ key: `${prefix}password`, value: input.password });
          }
          if (input.ssl !== undefined) {
            updates.push({ key: `${prefix}ssl`, value: String(input.ssl) });
          }

          // Use upsert with Promise.all to avoid await-in-loop
          await Promise.all(
            updates.map(({ key, value }) =>
              ctx.prisma.config.upsert({
                where: { key },
                create: {
                  key,
                  value,
                  valueType: 'STRING',
                  scope: 'SYSTEM',
                },
                update: { value },
              })
            )
          );

          logger.info(
            `[downloads.ts] Download client configured: ${input.type}`
          );
          return true;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(
            '[downloads.ts] Failed to update download config:',
            errorMessage
          );
          throw toTRPCError(error);
        }
      }
    ),

  /**
   * Test client connection
   *
   * Tests the connection to a download client.
   * If input is provided, tests that specific client configuration.
   * Otherwise, tests the first enabled client.
   */
  test: adminProcedure
    .input(z.union([downloadClientConfigSchema, z.undefined()]).optional())
    .mutation(async ({ input }): Promise<ClientTestResult> => {
      try {
        const client = input
          ? await getConfiguredClient(input.type)
          : await getConfiguredClient();

        if (!client) {
          return {
            success: false,
            error: 'No download client configured',
          };
        }

        const connectionResult = await client.testConnection();

        // Check if connection was successful using AsyncResult pattern
        if (isSuccess(connectionResult)) {
          logger.info('Download client test successful');
          return {
            success: true,
            message: 'Connection successful',
          };
        }

        logger.warn('Download client test failed');
        return {
          success: false,
          error: 'Connection failed',
        };
      } catch (error: unknown) {
        logger.error('Download client test failed', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Test failed',
        };
      }
    }),
});
