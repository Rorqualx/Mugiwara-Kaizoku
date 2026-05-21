/**
 * Komga Status Builder
 *
 * Builds Komga integration status with connection testing
 */

import { KomgaClient } from '@/server/utils/integration/komga';
import type { KomgaConfig } from '@/types/config.types';

export interface KomgaStatus {
  enabled: boolean;
  configured: boolean;
  host: string | null;
  authMethod: 'basic' | 'apikey';
  lastSync?: string;
  autoSync: boolean;
  syncInterval: number;
  syncDirection: 'bidirectional' | 'to-komga' | 'from-komga';
  selectedLibraries: string[];
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'not-configured';
  connectionError?: string | null;
}

/**
 * Map sync direction from config format to status format
 */
function mapSyncDirection(
  direction: 'toKomga' | 'fromKomga' | 'bidirectional' | undefined
): 'bidirectional' | 'to-komga' | 'from-komga' {
  if (direction === 'toKomga') return 'to-komga';
  if (direction === 'fromKomga') return 'from-komga';
  return 'bidirectional';
}

/**
 * Build base status object from config
 */
export function buildBaseStatus(
  config: KomgaConfig | null,
  enabled: boolean,
  host: string | null,
  selectedLibraries: string[]
): KomgaStatus {
  const base = {
    enabled,
    configured: !!(config && (config.username ?? config.apiKey)),
    host,
    authMethod: (config?.authMethod ?? 'basic') as 'basic' | 'apikey',
    autoSync: config?.autoSync ?? false,
    syncInterval: config?.syncInterval ?? 60,
    syncDirection: mapSyncDirection(config?.syncDirection),
    selectedLibraries,
    connectionStatus: 'not-configured' as const
  };

  // Only include lastSync if it exists (exactOptionalPropertyTypes: true)
  const lastSyncValue = config?.lastSync instanceof Date
    ? config.lastSync.toISOString()
    : config?.lastSync;

  if (lastSyncValue !== undefined) {
    return { ...base, lastSync: lastSyncValue };
  }

  return base;
}

/**
 * Test connection and update status
 */
export async function testConnectionStatus(
  status: KomgaStatus,
  config: KomgaConfig
): Promise<KomgaStatus> {
  try {
    const client = new KomgaClient(config);
    const isConnected = await client.testConnection();

    return {
      ...status,
      connectionStatus: isConnected ? 'connected' : 'disconnected',
      connectionError: isConnected ? null : 'Unable to connect to server'
    };
  } catch (error: unknown) {
    return {
      ...status,
      connectionStatus: 'error',
      connectionError: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Build complete Komga status with optional connection test
 */
export async function buildKomgaStatus(
  config: KomgaConfig | null,
  enabled: boolean,
  host: string | null,
  selectedLibraries: string[]
): Promise<KomgaStatus> {
  const baseStatus = buildBaseStatus(config, enabled, host, selectedLibraries);

  // If configured and enabled, test connection
  if (baseStatus.configured && baseStatus.enabled && config) {
    return testConnectionStatus(baseStatus, config);
  }

  return baseStatus;
}
