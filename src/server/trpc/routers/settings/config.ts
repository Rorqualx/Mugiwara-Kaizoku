/**
 * Config Operations Router
 *
 * Core configuration get/set operations using GlobalConfigService.
 *
 * Procedures: getBatch, get, set
 * Extracted from: settings.ts (lines 364-582)
 */

import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { prisma } from '@/server/db';
import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { unifiedProviderRegistry } from '@/server/services/search/UnifiedProviderRegistry';
import { protectedProcedure, settingsProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  createContextualError,
} from '@/utils/async-result';
import { logger } from '@/utils/logging';
import { isObject, hasProperty } from '@/utils/type-guards';

import { validateConfigKey } from './config-key-validators';

// ============================================================================
// Helper Functions
// ============================================================================

/** Handle 'all' key - returns all configurations */
async function handleGetAllConfig(
  cacheKey: string
): Promise<AsyncResult<Record<string, unknown>, Error>> {
  const configService = getGlobalConfigService();
  const allConfig = await configService.getAll();

  const values: Record<string, unknown> = {};
  for (const [key, config] of Object.entries(allConfig)) {
    if (typeof config.value === 'object' && config.value !== null && !Array.isArray(config.value)) {
      logger.debug(`Settings 'all' returning object for key ${key}:`, {
        key,
        valueType: typeof config.value,
        keys: Object.keys(config.value),
      });
    }
    values[key] = config.value;
  }

  logger.debug('Settings.get returning all config:', {
    totalKeys: Object.keys(values).length,
    integrationKeys: Object.keys(values).filter(
      (k) => k.includes('suwayomi') || k.includes('komga') || k.includes('kavita') || k.includes('prowlarr')
    ),
  });

  await cacheProvider.set(cacheKey, values, { ttl: 600, namespace: 'settings', tags: ['settings', 'all'] });
  return createSuccessResult(values);
}

/** Handle 'metadata' key - returns metadata config */
async function handleGetMetadataConfig(
  cacheKey: string,
  defaultValue: unknown
): Promise<AsyncResult<unknown, Error>> {
  const configService = getGlobalConfigService();
  let value = await configService.get('metadata', defaultValue);

  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
      logger.debug('Parsed metadata from JSON string');
    } catch (e) {
      logger.error('Failed to parse metadata JSON:', e);
      value = defaultValue ?? {};
    }
  }

  logger.debug(`Settings.get for 'metadata' key, returning:`, {
    type: typeof value,
    hasProviders: value && typeof value === 'object' && 'providers' in value,
    providers:
      isObject(value) && hasProperty(value, 'providers') && isObject(value['providers'])
        ? Object.keys(value['providers'])
        : [],
  });

  await cacheProvider.set(cacheKey, value, { ttl: 600, namespace: 'settings', tags: ['settings', 'metadata'] });
  return createSuccessResult(value);
}

/**
 * Substring patterns that signal a config key is sensitive. Values for these
 * keys are redacted in the audit log to keep secrets out of SystemEvent
 * `details` (which may be exported, viewed by other operators, or sent to
 * downstream log sinks).
 */
const SENSITIVE_KEY_PATTERNS = ['password', 'secret', 'token', 'apikey'];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Per-provider enabled keys whose writes must invalidate the in-memory
 * provider-state cache held by `UnifiedProviderRegistry`. Without this, a
 * toggle in the metadata-settings UI persists to the Config table but the
 * search registry keeps the stale value until the next process restart.
 */
const PROVIDER_ENABLED_KEYS = new Set<string>([
  'anilist.enabled',
  'mangadex.enabled',
  'comicvine.enabled',
  'comicvine.apiKey',
  'fandom.enabled',
  'wikipedia.enabled',
]);

function shouldReloadProviderStates(key: string): boolean {
  return PROVIDER_ENABLED_KEYS.has(key);
}

/**
 * Persist a `SystemEvent` row recording a settings change. Best-effort —
 * a failure here logs and swallows so the user-visible mutation still
 * succeeds (we should not roll back a successful Config write because the
 * audit-log write failed).
 */
async function recordSettingsAuditEvent(
  type: 'config.settings.updated' | 'config.settings.batch.updated',
  message: string,
  details: Record<string, unknown>,
  userId: string | undefined,
): Promise<void> {
  try {
    await prisma.systemEvent.create({
      data: {
        id: randomUUID(),
        type,
        source: 'settingsConfigRouter',
        level: 'info',
        message,
        details: {
          ...details,
          ...(userId !== undefined ? { userId } : {}),
        },
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`[settings.set] Failed to record audit event: ${errorMessage}`);
  }
}


// ============================================================================
// Router Definition
// ============================================================================

export const settingsConfigRouter = router({
  /** Get multiple configuration values in a batch */
  getBatch: settingsProcedure
    .input(z.object({ keys: z.array(z.string()) }))
    .query(async ({ input }): Promise<AsyncResult<Record<string, unknown>, Error>> => {
      try {
        const configService = getGlobalConfigService();
        const results: Record<string, unknown> = {};

        await Promise.all(
          input.keys.map(async (key) => {
            try {
              const value = await configService.get(key);
              if (value !== undefined) {
                results[key] = value;
              }
            } catch (error: unknown) {
              logger.warn(`Error getting config key '${key}':`, error);
            }
          })
        );

        return createSuccessResult(results);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error getting batch configuration: ${errorMessage}`);
        return createErrorResult(createContextualError(errorMessage, 'CONFIGURATION_ERROR'));
      }
    }),

  /** Get a specific configuration value by key */
  get: settingsProcedure
    .input(z.object({ key: z.string(), defaultValue: z.unknown().optional() }))
    .query(async ({ input }): Promise<AsyncResult<unknown, Error>> => {
      try {
        const cacheKey = `settings:get:${input.key}`;

        const cached = await cacheProvider.get(cacheKey);
        if (cached) {
          logger.debug(`Cache hit for settings.get key: ${input.key}`);
          return createSuccessResult(cached);
        }

        if (input.key === 'all') {
          return await handleGetAllConfig(cacheKey);
        }

        if (input.key === 'metadata') {
          return await handleGetMetadataConfig(cacheKey, input.defaultValue);
        }

        const configService = getGlobalConfigService();
        const value = await configService.get(input.key, input.defaultValue);

        await cacheProvider.set(cacheKey, value, { ttl: 600, namespace: 'settings', tags: ['settings', input.key] });
        logger.debug(`Cache miss for settings.get key: ${input.key}, cached for 600s`);

        return createSuccessResult(value);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error getting configuration: ${errorMessage}`);
        return createErrorResult(createContextualError(errorMessage, 'CONFIGURATION_ERROR'));
      }
    }),

  /** Set a specific configuration value */
  set: protectedProcedure
    .input(z.object({ key: z.string(), value: z.unknown() }))
    .mutation(async ({ input, ctx }): Promise<AsyncResult<boolean, Error>> => {
      const userId = ctx.user.id;
      let validatedValue: unknown;
      try {
        validatedValue = validateConfigKey(input.key, input.value);
      } catch (validationError: unknown) {
        const message = validationError instanceof Error ? validationError.message : String(validationError);
        logger.warn(`[settings.set] Rejected key=${input.key}: ${message}`);
        return createErrorResult(createContextualError(message, "INVALID_CONFIG_VALUE"));
      }
      try {
        const configService = getGlobalConfigService();
        await configService.set(input.key, validatedValue);

        const cacheKey = `settings:get:${input.key}`;
        await cacheProvider.del(cacheKey);
        await cacheProvider.del('settings:get:all');
        logger.debug(`Cache invalidated for settings.set key: ${input.key}`);

        if (shouldReloadProviderStates(input.key)) {
          void unifiedProviderRegistry.reloadProviderStates();
        }

        // Emit WebSocket event for settings update
        void realtimeEmitter.emitSystemEvent({
          eventType: "settings:updated",
          source: "settingsConfigRouter",
          message: `Setting "${input.key}" updated`,
          data: { key: input.key }
        });

        // Persistent audit trail. Sensitive values are redacted.
        await recordSettingsAuditEvent(
          "config.settings.updated",
          `Setting "${input.key}" updated`,
          {
            key: input.key,
            value: isSensitiveKey(input.key) ? "<redacted>" : validatedValue,
          },
          userId,
        );

        const result = createSuccessResult(true);

        // Safety check for contaminated result
        if (typeof result === 'object' && 'data' in result && typeof result.data !== 'boolean') {
          logger.error(`[settings.set] WARNING: Result data is not boolean for key ${input.key}!`);
          return createSuccessResult(true);
        }

        return result;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error setting configuration: ${errorMessage}`);
        return createErrorResult(createContextualError(errorMessage, 'CONFIGURATION_ERROR'));
      }
    }),
  /** Set multiple configuration values atomically */
  setBatch: protectedProcedure
    .input(z.object({ items: z.array(z.object({ key: z.string(), value: z.unknown() })) }))
    .mutation(async ({ input, ctx }): Promise<AsyncResult<boolean, Error>> => {
      const userId = ctx.user.id;
      let validatedItems: { key: string; value: unknown }[];
      try {
        validatedItems = input.items.map((item) => ({
          key: item.key,
          value: validateConfigKey(item.key, item.value),
        }));
      } catch (validationError: unknown) {
        const message = validationError instanceof Error ? validationError.message : String(validationError);
        logger.warn(`[settings.setBatch] Rejected batch: ${message}`);
        return createErrorResult(createContextualError(message, "INVALID_CONFIG_VALUE"));
      }
      try {
        const configService = getGlobalConfigService();
        await configService.setBatch(validatedItems);

        // Invalidate cache for each key and 'all'
        /* eslint-disable no-await-in-loop */
        for (const item of input.items) {
          const cacheKey = `settings:get:${item.key}`;
          await cacheProvider.del(cacheKey);
        }
        /* eslint-enable no-await-in-loop */
        await cacheProvider.del('settings:get:all');
        logger.debug(`Cache invalidated for ${input.items.length} settings keys atomically`);

        if (input.items.some((item) => shouldReloadProviderStates(item.key))) {
          void unifiedProviderRegistry.reloadProviderStates();
        }

        // Emit WebSocket event for batch settings update
        const keys = input.items.map(item => item.key);
        void realtimeEmitter.emitSystemEvent({
          eventType: "settings:batch:updated",
          source: "settingsConfigRouter",
          message: `${keys.length} settings updated`,
          data: { keys, count: keys.length }
        });

        // Persistent audit trail for the batch. Sensitive values redacted per-item.
        await recordSettingsAuditEvent(
          "config.settings.batch.updated",
          `${keys.length} settings updated`,
          {
            count: keys.length,
            items: validatedItems.map((item) => ({
              key: item.key,
              value: isSensitiveKey(item.key) ? "<redacted>" : item.value,
            })),
          },
          userId,
        );

        const result = createSuccessResult(true);

        // Safety check for contaminated result
        if (typeof result === 'object' && 'data' in result && typeof result.data !== 'boolean') {
          logger.error(`[settings.setBatch] WARNING: Result data is not boolean!`);
          return createSuccessResult(true);
        }

        return result;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error setting batch configuration: ${errorMessage}`);
        return createErrorResult(createContextualError(errorMessage, 'CONFIGURATION_ERROR'));
      }
    }),
});
