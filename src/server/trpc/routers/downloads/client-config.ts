/**
 * Download Client Configuration
 *
 * Provides utility functions for resolving and creating download clients
 * based on configuration stored in the database.
 *
 * Extracted from: downloads.ts (lines 80-157)
 *
 * ESLint fixes applied:
 * - no-param-reassign: Use local variable instead of modifying parameter
 * - no-await-in-loop: Use Promise.all for parallel config checks
 * - max-depth: Use early returns and extract helper functions
 */

import { prisma } from '@/server/db';
import { ClientDownloadService } from '@/server/services/download/clientDownload';
import { getConfigBoolean, getConfigByPrefix } from '@/server/utils/configReader';
import type { AsyncResult } from '@/utils/async-result';
import { isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { hasMethod, type DownloadClient } from './utils';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Supported torrent client types
 */
const TORRENT_CLIENTS = ['transmission', 'deluge'] as const;

/**
 * Supported usenet client types
 */
const USENET_CLIENTS = ['nzbget', 'sabnzbd'] as const;

/**
 * All supported download client types
 */
const ALL_CLIENT_TYPES = [...TORRENT_CLIENTS, ...USENET_CLIENTS] as const;

type TorrentClientType = (typeof TORRENT_CLIENTS)[number];
type UsenetClientType = (typeof USENET_CLIENTS)[number];
export type DownloadClientType = TorrentClientType | UsenetClientType;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if multiple client types are enabled in parallel
 *
 * Uses Promise.all to avoid await-in-loop ESLint violation
 */
async function checkClientsEnabled(
  clientTypes: readonly string[]
): Promise<Array<{ type: string; enabled: boolean }>> {
  return Promise.all(
    clientTypes.map(async (type) => ({
      type,
      enabled: await getConfigBoolean(`download.${type}.enabled`, false),
    }))
  );
}

/**
 * Find the first enabled client type from a list
 *
 * @param clientTypes - Array of client types to check
 * @returns The first enabled client type, or null if none enabled
 */
async function findEnabledClientType(
  clientTypes: readonly string[]
): Promise<string | null> {
  const results = await checkClientsEnabled(clientTypes);
  const enabled = results.find((r) => r.enabled);
  return enabled?.type ?? null;
}

/**
 * Resolve which client type to use
 *
 * If no specific type requested, finds first enabled client:
 * 1. Torrent clients (transmission, deluge)
 * 2. Usenet clients (nzbget, sabnzbd)
 *
 * @param requestedType - Optionally requested specific client type
 * @returns Resolved client type or null if none available
 */
async function resolveClientType(
  requestedType?: string
): Promise<string | null> {
  // If specific type requested, use it
  if (requestedType) {
    return requestedType;
  }

  // Try torrent clients first
  const torrentType = await findEnabledClientType(TORRENT_CLIENTS);
  if (torrentType) {
    return torrentType;
  }

  // If no torrent client, try usenet clients
  const usenetType = await findEnabledClientType(USENET_CLIENTS);
  if (usenetType) {
    return usenetType;
  }

  // No enabled clients found
  return null;
}

/**
 * Create a download client from the service
 *
 * Extracted to reduce nesting depth in main function
 */
async function createClientFromService(
  clientService: ClientDownloadService,
  clientType: string
): Promise<DownloadClient | null> {
  const clientServiceUnknown = clientService as unknown;

  // Check for getClientConfig method
  if (!hasMethod(clientServiceUnknown, 'getClientConfig')) {
    logger.error(
      '[downloads.ts] getClientConfig method not found on client service'
    );
    return null;
  }

  // Get client configuration
  const configResult = await (
    clientServiceUnknown['getClientConfig'] as (
      type: string
    ) => Promise<AsyncResult<unknown>>
  )(clientType);

  if (isError(configResult)) {
    const errorMsg =
      configResult.error instanceof Error
        ? configResult.error.message
        : String(configResult.error);
    logger.error(`[downloads.ts] Failed to get client config: ${errorMsg}`);
    return null;
  }

  if (!isSuccess(configResult)) {
    logger.error('[downloads.ts] No config result returned');
    return null;
  }

  // Check for createClient method
  if (!hasMethod(clientServiceUnknown, 'createClient')) {
    logger.error(
      '[downloads.ts] createClient method not found on client service'
    );
    return null;
  }

  // Create client instance
  const clientResult = await (
    clientServiceUnknown['createClient'] as (
      config: unknown
    ) => Promise<AsyncResult<unknown>>
  )(configResult.data);

  if (isError(clientResult)) {
    const errorMsg =
      clientResult.error instanceof Error
        ? clientResult.error.message
        : String(clientResult.error);
    logger.error(`[downloads.ts] Failed to create client: ${errorMsg}`);
    return null;
  }

  if (!isSuccess(clientResult)) {
    logger.error('[downloads.ts] No client result returned');
    return null;
  }

  return clientResult.data as DownloadClient;
}

// ============================================================================
// Main Exports
// ============================================================================

/**
 * Get a configured download client
 *
 * If no specific client type is requested, tries all enabled clients in order:
 * 1. Torrent clients (transmission, deluge)
 * 2. Usenet clients (nzbget, sabnzbd)
 *
 * @param requestedType - Optional specific client type to use
 * @returns Configured download client or null if none available
 */
export async function getConfiguredClient(
  requestedType?: string
): Promise<DownloadClient | null> {
  try {
    const clientService = new ClientDownloadService(prisma);

    // Resolve the client type to use (using local variable, not modifying parameter)
    const resolvedType = await resolveClientType(requestedType);

    if (!resolvedType) {
      logger.warn('[downloads.ts] No download clients enabled');
      return null;
    }

    return await createClientFromService(clientService, resolvedType);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      '[downloads.ts] Failed to get configured client:',
      errorMessage
    );
    return null;
  }
}

/**
 * Get all enabled clients with their configurations
 *
 * Uses Promise.all to check all clients in parallel (no await-in-loop)
 *
 * @returns Array of enabled clients with their configuration
 */
export async function getEnabledClients(): Promise<
  Array<{
    type: string;
    enabled: boolean;
    config: Record<string, string>;
  }>
> {
  // Check all client types in parallel
  const enabledResults = await checkClientsEnabled(ALL_CLIENT_TYPES);

  // Get configs for enabled clients in parallel
  const enabledTypes = enabledResults
    .filter((r) => r.enabled)
    .map((r) => r.type);

  if (enabledTypes.length === 0) {
    return [];
  }

  const clientConfigs = await Promise.all(
    enabledTypes.map(async (clientType) => {
      const config = await getConfigByPrefix(`download.${clientType}.`);
      return {
        type: clientType,
        enabled: true,
        config: Object.fromEntries(config),
      };
    })
  );

  return clientConfigs;
}

/**
 * Get the primary (first) enabled client
 *
 * For backwards compatibility with code expecting a single client
 *
 * @returns First enabled client with config, or null if none
 */
export async function getPrimaryEnabledClient(): Promise<{
  type: string;
  enabled: boolean;
  config: Record<string, string>;
} | null> {
  const clients = await getEnabledClients();
  return clients[0] ?? null;
}

// Export constants for use in other modules
export { TORRENT_CLIENTS, USENET_CLIENTS, ALL_CLIENT_TYPES };
