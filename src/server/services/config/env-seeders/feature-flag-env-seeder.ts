/**
 * Feature Flag Environment Seeder
 *
 * Seeds feature flag configuration from environment variables
 * into the Config table. Idempotent: only writes if the key
 * doesn't already exist in the DB.
 */

import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import type { ConfigService } from '../configService';

interface FlagEntry {
  key: string;
  envVar: string;
  /** If true, env value 'true' enables the flag. If false, env value disables it. */
  enabledWhen: 'true' | 'false';
}

const FEATURE_FLAG_KEYS: FlagEntry[] = [
  // Performance
  { key: 'featureFlags.enableCaching', envVar: 'DISABLE_CACHING', enabledWhen: 'false' },

  // Admin
  { key: 'featureFlags.metricsCollection', envVar: 'ENABLE_METRICS', enabledWhen: 'true' },

  // Experimental
  { key: 'featureFlags.aiAgentEnrichment', envVar: 'USE_AI_AGENT', enabledWhen: 'true' },

  // Client-side feature flags
  { key: 'featureFlags.newStatusSystem', envVar: 'ENABLE_NEW_STATUS_SYSTEM', enabledWhen: 'true' },
  { key: 'featureFlags.enhancedSearch', envVar: 'ENABLE_ENHANCED_SEARCH', enabledWhen: 'true' },
  { key: 'featureFlags.advancedFiltering', envVar: 'ENABLE_ADVANCED_FILTERING', enabledWhen: 'true' },
  { key: 'featureFlags.batchOperations', envVar: 'ENABLE_BATCH_OPERATIONS', enabledWhen: 'true' },
  { key: 'featureFlags.calendarIntegration', envVar: 'ENABLE_CALENDAR_INTEGRATION', enabledWhen: 'true' },
];

/**
 * Seed a single feature flag from an env var
 */
async function seedSingleFlag(configService: ConfigService, entry: FlagEntry): Promise<void> {
  const envVal = process.env[entry.envVar];
  if (envVal === undefined) return;

  // Skip if key already has a value in DB
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- get() can return undefined at runtime
  const existing = String(await configService.get<string>(entry.key) ?? '');
  if (existing) return;

  // Determine boolean value
  const enabled = entry.enabledWhen === 'true'
    ? envVal === 'true'
    : envVal !== 'false';

  await configService.set(entry.key, enabled, {
    scope: ConfigScope.FEATURE,
    valueType: ConfigValueType.BOOLEAN,
  });
  logger.info(`[FeatureFlagSeeder] Seeded ${entry.key}=${String(enabled)} from env ${entry.envVar}=${envVal}`);
}

/**
 * Seed feature flag configuration from environment variables
 */
export async function seedFeatureFlagsFromEnv(configService: ConfigService): Promise<void> {
  try {
    await Promise.all(FEATURE_FLAG_KEYS.map(entry => seedSingleFlag(configService, entry)));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`[FeatureFlagSeeder] Failed to seed feature flags: ${errorMessage}`);
  }
}
