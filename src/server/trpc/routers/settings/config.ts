/**
 * Config Operations Router
 *
 * Core configuration get/set operations using GlobalConfigService.
 *
 * Procedures: getBatch, get, set
 * Extracted from: settings.ts (lines 364-582)
 */

import { randomUUID } from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { cacheProvider } from '@/server/cache/UnifiedCacheProvider';
import { prisma } from '@/server/db';
import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { unifiedProviderRegistry } from '@/server/services/search/UnifiedProviderRegistry';
import { toTRPCError } from '@/server/trpc/errors';
import { adminProcedure, settingsProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createContextualError } from '@/utils/async-result';
import { logger } from '@/utils/logging';
import { isObject, hasProperty } from '@/utils/type-guards';

import { validateConfigKey } from './config-key-validators';

// ============================================================================
// Helper Functions
// ============================================================================

/** Handle 'all' key - returns all configurations */
async function handleGetAllConfig(
  cacheKey: string
): Promise<Record<string, unknown>> {
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
  return values;
}

/** Handle 'metadata' key - returns metadata config */
async function handleGetMetadataConfig(
  cacheKey: string,
  defaultValue: unknown
): Promise<unknown> {
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
  return value;
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


/**
 * Fetch a single config key, swallowing per-key failures (a bad key must
 * not fail the whole batch). Returns the key/value pair, or null when the
 * key is missing or its lookup failed.
 */
async function fetchConfigValue(
  key: string,
): Promise<[string, unknown] | null> {
  try {
    const configService = getGlobalConfigService();
    const value = await configService.get(key);
    return value !== undefined ? [key, value] : null;
  } catch (error: unknown) {
    logger.warn(`Error getting config key '${key}':`, error);
    return null;
  }
}

// ============================================================================
// Router Definition
// ============================================================================

export const settingsConfigRouter = router({
  /** Get multiple configuration values in a batch */
  getBatch: settingsProcedure
    .input(z.object({ keys: z.array(z.string()) }))
    .query(async ({ input }): Promise<Record<string, unknown>> => {
      try {
        const entries = await Promise.all(input.keys.map(async (key) => fetchConfigValue(key)));
        return Object.fromEntries(
          entries.filter((entry): entry is [string, unknown] => entry !== null)
        );
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error getting batch configuration: ${errorMessage}`);
        throw toTRPCError(createContextualError(errorMessage, 'CONFIGURATION_ERROR'));
      }
    }),

  /** Get a specific configuration value by key */
  get: settingsProcedure
    .input(z.object({ key: z.string(), defaultValue: z.unknown().optional() }))
    .query(async ({ input }): Promise<unknown> => {
      try {
        const cacheKey = `settings:get:${input.key}`;

        const cached = await cacheProvider.get(cacheKey);
        if (cached) {
          logger.debug(`Cache hit for settings.get key: ${input.key}`);
          return cached;
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

        return value;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error getting configuration: ${errorMessage}`);
        throw toTRPCError(createContextualError(errorMessage, 'CONFIGURATION_ERROR'));
      }
    }),

  /** Set a specific configuration value */
  set: adminProcedure
    .input(z.object({ key: z.string(), value: z.unknown() }))
    .mutation(async ({ input, ctx }): Promise<boolean> => {
      const userId = ctx.user.id;
      let validatedValue: unknown;
      try {
        validatedValue = validateConfigKey(input.key, input.value);
      } catch (validationError: unknown) {
        const message = validationError instanceof Error ? validationError.message : String(validationError);
        logger.warn(`[settings.set] Rejected key=${input.key}: ${message}`);
        // Throw a real TRPCError instead of returning a successful response
        // with an AsyncResult error inside. The previous shape required every
        // caller to inspect result.status manually; none of the 5 existing
        // settings.set callers did, so validation rejections were silently
        // ignored and only surfaced after a reboot when the unchanged DB
        // value loaded back. BAD_REQUEST trips the tRPC mutation's `onError`
        // (or `isError`) the same way a network error does, so every caller's
        // existing error path now gets the message.
        throw new TRPCError({ code: 'BAD_REQUEST', message });
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

        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error setting configuration: ${errorMessage}`);
        throw toTRPCError(createContextualError(errorMessage, 'CONFIGURATION_ERROR'));
      }
    }),
  /** Set multiple configuration values atomically */
  setBatch: adminProcedure
    .input(z.object({ items: z.array(z.object({ key: z.string(), value: z.unknown() })) }))
    .mutation(async ({ input, ctx }): Promise<boolean> => {
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
        throw new TRPCError({ code: 'BAD_REQUEST', message });
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

        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error setting batch configuration: ${errorMessage}`);
        throw toTRPCError(createContextualError(errorMessage, 'CONFIGURATION_ERROR'));
      }
    }),
});
