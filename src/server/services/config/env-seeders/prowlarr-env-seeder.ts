/**
 * Prowlarr Environment Seeder
 *
 * Seeds Prowlarr configuration from environment variables into the Config table.
 * Idempotent: only writes if the key doesn't already exist in the DB.
 * Also migrates legacy keys (prowlarrBaseURL → prowlarr.baseUrl).
 */

import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import type { ConfigService } from '../configService';

interface ProwlarrKeyEntry {
  key: string;
  envVar: string;
  legacyKey?: string;
}

/** Mapping: new config key → { envVar, legacyKey? } */
const PROWLARR_KEYS: ProwlarrKeyEntry[] = [
  { key: 'prowlarr.baseUrl', envVar: 'PROWLARR_URL', legacyKey: 'prowlarrBaseURL' },
  { key: 'prowlarr.apiKey', envVar: 'PROWLARR_API_KEY', legacyKey: 'prowlarrApiKey' },
  { key: 'prowlarr.username', envVar: 'PROWLARR_USERNAME', legacyKey: 'prowlarrUsername' },
  { key: 'prowlarr.password', envVar: 'PROWLARR_PASSWORD', legacyKey: 'prowlarrPassword' },
];

/**
 * Try to migrate a value from a legacy Config key to the new key
 */
async function tryMigrateLegacyKey(
  configService: ConfigService,
  newKey: string,
  legacyKey: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- get() can return undefined at runtime
  const legacyValue = String(await configService.get<string>(legacyKey) ?? '');
  if (!legacyValue) return false;

  await configService.set(newKey, legacyValue, {
    scope: ConfigScope.INTEGRATION,
    valueType: ConfigValueType.STRING,
  });
  logger.info(`[ProwlarrSeeder] Migrated ${legacyKey} → ${newKey}`);
  return true;
}

/**
 * Try to seed a value from an environment variable
 */
async function trySeedFromEnv(
  configService: ConfigService,
  key: string,
  envVar: string
): Promise<void> {
  const envVal = process.env[envVar];
  if (!envVal) return;

  await configService.set(key, envVal, {
    scope: ConfigScope.INTEGRATION,
    valueType: ConfigValueType.STRING,
  });
  logger.info(`[ProwlarrSeeder] Seeded ${key} from env ${envVar}`);
}

/**
 * Seed a single Prowlarr config key from legacy key or env var
 */
async function seedSingleKey(configService: ConfigService, entry: ProwlarrKeyEntry): Promise<void> {
  // Skip if new key already has a non-empty value
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- get() can return undefined at runtime
  const existing = String(await configService.get<string>(entry.key) ?? '');
  if (existing) return;

  // Try legacy key migration first
  if (entry.legacyKey) {
    const migrated = await tryMigrateLegacyKey(configService, entry.key, entry.legacyKey);
    if (migrated) return;
  }

  // Fall back to env var
  await trySeedFromEnv(configService, entry.key, entry.envVar);
}

/**
 * Seed Prowlarr configuration from environment variables.
 * Also migrates from legacy Config keys if they exist.
 */
export async function seedProwlarrFromEnv(configService: ConfigService): Promise<void> {
  try {
    await Promise.all(PROWLARR_KEYS.map(entry => seedSingleKey(configService, entry)));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`[ProwlarrSeeder] Failed to seed Prowlarr config: ${errorMessage}`);
  }
}
