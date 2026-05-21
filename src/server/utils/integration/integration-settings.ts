/**
 * Integration Settings Helper
 *
 * This module provides helper functions for managing integration settings
 * now migrated to use the Config table instead of Settings metadata.
 */


import { prisma } from '@/server/db';
import { getConfig, getConfigBoolean } from '@/server/utils/configReader';
import type { KavitaConfig, KomgaConfig } from '@/types/config.types';


/**
 * Integration settings structure stored in metadata
 */
interface IntegrationMetadata {
  kavita?: {
    apiKey?: string;
    syncInterval?: number;
    autoSync?: boolean;
    syncDirection?: 'toKavita' | 'fromKavita' | 'bidirectional';
    lastSync?: Date | string;
  };
  komga?: {
    authMethod?: 'basic' | 'apikey';
    apiKey?: string;
    syncInterval?: number;
    autoSync?: boolean;
    syncDirection?: 'toKomga' | 'fromKomga' | 'bidirectional';
    lastSync?: Date | string;
  };
}


/**
 * Update integration settings in the Config table
 */
export async function updateIntegrationSettings(
  integrationKey: 'kavita' | 'komga',
  updates: Partial<IntegrationMetadata['kavita'] | IntegrationMetadata['komga']>
): Promise<void> {
  if (!updates) return;

  const prefix = `integration.${integrationKey}.`;

  // Update each field in Config table in parallel
  const updatePromises = (Object.entries(updates) as Array<[string, unknown]>)
    .filter((entry): entry is [string, NonNullable<unknown>] => entry[1] !== undefined)
    .map(([key, value]) => {
      const configKey = `${prefix}${key}`;
      return prisma.config.upsert({
        where: { key: configKey },
        create: {
          key: configKey,
          value: String(value),
          valueType: 'STRING',
          scope: 'INTEGRATION'
        },
        update: {
          value: String(value)
        }
      });
    });

  await Promise.all(updatePromises);
}

/**
 * Get Kavita configuration from Config table
 */
export async function getKavitaConfig(): Promise<KavitaConfig | null> {
  const [
    enabled,
    host,
    apiKey,
    syncInterval,
    autoSync,
    syncDirection,
    lastSync
  ] = await Promise.all([
    getConfigBoolean('integration.kavita.enabled', false),
    getConfig('integration.kavita.host'),
    getConfig('integration.kavita.apiKey'),
    getConfig('integration.kavita.syncInterval'),
    getConfigBoolean('integration.kavita.autoSync', false),
    getConfig('integration.kavita.syncDirection'),
    getConfig('integration.kavita.lastSync')
  ]);

  if (!enabled || !host) {
    return null;
  }

  const config: KavitaConfig = {
    type: 'kavita',
    enabled,
    host,
    apiKey: apiKey ?? '',
    libraries: [], // Libraries fetched separately if needed
    syncInterval: syncInterval ? parseInt(String(syncInterval)) : 60,
    autoSync,
    syncDirection: (syncDirection as 'toKavita' | 'fromKavita' | 'bidirectional' | null) ?? 'bidirectional'
  };

  if (lastSync) {
    config.lastSync = new Date(lastSync);
  }

  return config;
}

/**
 * Get Komga configuration from Config table
 */
export async function getKomgaConfig(): Promise<KomgaConfig | null> {
  const [
    enabled,
    host,
    user,
    password,
    authMethod,
    apiKey,
    syncInterval,
    autoSync,
    syncDirection,
    lastSync
  ] = await Promise.all([
    getConfigBoolean('integration.komga.enabled', false),
    getConfig('integration.komga.host'),
    getConfig('integration.komga.user'),
    getConfig('integration.komga.password'),
    getConfig('integration.komga.authMethod'),
    getConfig('integration.komga.apiKey'),
    getConfig('integration.komga.syncInterval'),
    getConfigBoolean('integration.komga.autoSync', false),
    getConfig('integration.komga.syncDirection'),
    getConfig('integration.komga.lastSync')
  ]);

  if (!enabled || !host) {
    return null;
  }

  const config: KomgaConfig = {
    type: 'komga',
    enabled,
    host,
    authMethod: (authMethod as 'basic' | 'apikey' | null) ?? 'basic',
    username: user ?? '',
    password: password ?? '',
    libraries: [], // Libraries fetched separately if needed
    syncInterval: syncInterval ? parseInt(String(syncInterval)) : 60,
    autoSync,
    syncDirection: (syncDirection as 'toKomga' | 'fromKomga' | 'bidirectional' | null) ?? 'bidirectional'
  };

  if (apiKey) {
    config.apiKey = apiKey;
  }

  if (lastSync) {
    config.lastSync = new Date(lastSync);
  }

  return config;
}