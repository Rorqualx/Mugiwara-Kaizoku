/**
 * Per-User Config Override Service
 *
 * A thin per-user layer over the global {@link configService}. A
 * `UserConfig(userId, key)` row overrides the global `Config` value for that
 * user; absence falls back to the global value. Only an explicit allow-list of
 * user-overridable keys (download/language/content preferences) may be written
 * here — infrastructure keys stay global/admin-only.
 *
 * Reuses the global config's value (de)serialization and the settings key
 * validators so per-user values are validated and typed exactly like global
 * ones.
 *
 * @module server/services/config/user-config-service
 */
import { ConfigValueType } from '@prisma/client';

import { prisma } from '@/server/db';
import { validateConfigKey } from '@/server/trpc/routers/settings/config-key-validators';
import { logger } from '@/utils/logger';

import { configService } from './configService';
import { detectValueType, parseValue, stringifyValue } from './helpers/value-converters';

/**
 * Keys a user may override. Everything else is global/admin-only. Kept tight on
 * purpose — adding a key here makes it per-user-settable.
 */
export const USER_OVERRIDABLE_KEYS = [
  'download.mode',
  'mangadex.preferredLanguage',
  'comicvine.preferredLanguage',
  'anilist.filterAdultContent',
  'anilist.filterWebtoons',
  'anilist.filterKoreanManhwa',
  'mangadex.includeAdult',
  'mangadex.defaultContentRating',
] as const;

export type UserOverridableKey = (typeof USER_OVERRIDABLE_KEYS)[number];

/**
 * Authoritative default for each overridable key — the value a user falls back
 * to when neither a personal override NOR an admin global row exists. These
 * mirror the read-site defaults (`DEFAULT_DOWNLOAD_MODE`, `DEFAULT_MANGADEX_CONFIG`,
 * the AniList filter defaults) so the "My Preferences" UI seeds real values
 * instead of blanks, and "Set" starts from the true default. Keep in sync with
 * those sources if a default ever changes.
 */
export const USER_CONFIG_DEFAULTS: Record<UserOverridableKey, unknown> = {
  'download.mode': 'mix',
  'mangadex.preferredLanguage': 'en',
  'comicvine.preferredLanguage': 'en',
  'anilist.filterAdultContent': true,
  'anilist.filterWebtoons': false,
  'anilist.filterKoreanManhwa': false,
  'mangadex.includeAdult': false,
  'mangadex.defaultContentRating': ['safe', 'suggestive'],
};

const OVERRIDABLE = new Set<string>(USER_OVERRIDABLE_KEYS);

/** True if `key` is in the per-user allow-list. */
export function isUserOverridableKey(key: string): key is UserOverridableKey {
  return OVERRIDABLE.has(key);
}

/**
 * Effective value for a user: their override if present (and the key is
 * overridable), otherwise the global value. Pass `userId = undefined` for
 * pure system/background reads to get the global value unchanged.
 */
export async function getUserConfigValue<T = unknown>(
  userId: string | undefined,
  key: string,
  fallback?: T,
): Promise<T> {
  if (userId !== undefined && isUserOverridableKey(key)) {
    const row = await prisma.userConfig.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (row) return parseValue(row.value, row.valueType) as T;
  }
  // When the caller passes no explicit fallback, seed the overridable key's
  // authoritative default so a missing global row still resolves to a real
  // value rather than undefined.
  const effectiveFallback =
    fallback === undefined && isUserOverridableKey(key)
      ? (USER_CONFIG_DEFAULTS[key] as T)
      : (fallback as T);
  return configService.get<T>(key, effectiveFallback);
}

/**
 * The user's OWN override for a key, or `undefined` if they haven't set one —
 * with NO global fallback. Use when the caller wants to apply the global value
 * via a different key/semantics when the user hasn't personalised (e.g. the
 * home rails map a missing `anilist.filterAdultContent` override onto the
 * legacy global `search.includeAdult` instead).
 */
export async function getUserConfigOverride<T = unknown>(
  userId: string | undefined,
  key: string,
): Promise<T | undefined> {
  if (userId === undefined || !isUserOverridableKey(key)) return undefined;
  const row = await prisma.userConfig.findUnique({
    where: { userId_key: { userId, key } },
  });
  return row ? (parseValue(row.value, row.valueType) as T) : undefined;
}

export interface EffectiveUserConfig {
  key: string;
  /** Effective value — the user's override if set, else the global value. */
  value: unknown;
  /** The admin's global value (what the user reverts to). */
  globalValue: unknown;
  /** Whether the user has set their own override for this key. */
  isOverride: boolean;
}

/**
 * Effective + global values for a set of keys — powers the "My Preferences" UI
 * so it can show the current value and whether it's a personal override or the
 * inherited default. Non-overridable keys are ignored.
 */
export async function getUserEffectiveConfig(
  userId: string,
  keys: readonly string[],
): Promise<EffectiveUserConfig[]> {
  const overridable = keys.filter(isUserOverridableKey);
  const rows = await prisma.userConfig.findMany({
    where: { userId, key: { in: [...overridable] } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return Promise.all(
    overridable.map(async (key): Promise<EffectiveUserConfig> => {
      // Fall back to the authoritative default so the UI shows the real value
      // (and "reset" target) even before an admin has written a global row.
      const globalValue = await configService.get(key, USER_CONFIG_DEFAULTS[key]);
      const row = byKey.get(key);
      return {
        key,
        globalValue,
        value: row ? parseValue(row.value, row.valueType) : globalValue,
        isOverride: row !== undefined,
      };
    }),
  );
}

/** Upsert a user's override for an allow-listed key (validated + typed). */
export async function setUserConfig(userId: string, key: string, value: unknown): Promise<void> {
  if (!isUserOverridableKey(key)) {
    throw new Error(`Config key "${key}" is not user-overridable`);
  }
  const validated = validateConfigKey(key, value);
  const valueType: ConfigValueType = detectValueType(validated);
  const stringValue = stringifyValue(validated, valueType);
  await prisma.userConfig.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, value: stringValue, valueType },
    update: { value: stringValue, valueType },
  });
  logger.info(`[UserConfig] set ${key} for user ${userId}`);
}

/** Remove a user's override → reverts to the global value. */
export async function resetUserConfig(userId: string, key: string): Promise<void> {
  await prisma.userConfig.deleteMany({ where: { userId, key } });
  logger.info(`[UserConfig] reset ${key} for user ${userId}`);
}
