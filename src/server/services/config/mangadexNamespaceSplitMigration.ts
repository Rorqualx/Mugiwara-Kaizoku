/**
 * MangaDex Namespace Split Migration
 *
 * One-shot, idempotent migration that moves MangaDex config from the legacy
 * `search.providers.MANGADEX.*` keys into the new `mangadex.*` namespace and
 * seeds the new download-side toggle (`mangadex.download.enabled`).
 *
 * Runs AFTER `metadataProvidersEnabledMigration` so that the metadata-side
 * `mangadex.enabled` key is already populated by the time we read it.
 *
 * Steps:
 * 1. For each legacy key, copy its value into the new key only when the new
 *    key is unset — never overwrite a user-edited new value.
 * 2. Seed `mangadex.download.enabled` from the legacy enable flag (or from
 *    `mangadex.enabled` if the legacy key is missing).
 * 3. Delete every `search.providers.MANGADEX.*` row.
 *
 * Re-running is a no-op (legacy rows are gone after the first successful run).
 */
import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import type { ConfigService } from './configService';
import type { PrismaClient } from '@prisma/client';

const log = logger.child('mangadexNamespaceSplitMigration');

const LEGACY_PREFIX = 'search.providers.MANGADEX.';

interface KeyMapping {
  legacy: string;
  next: string;
  valueType: ConfigValueType;
  parse?: (raw: unknown) => unknown;
}

const SCALAR_MIGRATIONS: KeyMapping[] = [
  { legacy: `${LEGACY_PREFIX}preferredLanguage`, next: 'mangadex.preferredLanguage', valueType: ConfigValueType.STRING },
  { legacy: `${LEGACY_PREFIX}includeAdult`, next: 'mangadex.includeAdult', valueType: ConfigValueType.BOOLEAN, parse: parseBooleanLike },
  { legacy: `${LEGACY_PREFIX}defaultContentRating`, next: 'mangadex.defaultContentRating', valueType: ConfigValueType.JSON, parse: parseJsonArrayLike },
  { legacy: `${LEGACY_PREFIX}dataSaverMode`, next: 'mangadex.dataSaverMode', valueType: ConfigValueType.BOOLEAN, parse: parseBooleanLike },
  { legacy: `${LEGACY_PREFIX}rateLimit.maxRequests`, next: 'mangadex.rateLimit.maxRequests', valueType: ConfigValueType.NUMBER, parse: parseNumberLike },
  { legacy: `${LEGACY_PREFIX}rateLimit.perMilliseconds`, next: 'mangadex.rateLimit.perMilliseconds', valueType: ConfigValueType.NUMBER, parse: parseNumberLike },
];

function parseBooleanLike(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === '1' || raw === 1) return true;
  if (raw === 'false' || raw === '0' || raw === 0) return false;
  return undefined;
}

function parseNumberLike(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseJsonArrayLike(raw: unknown): unknown[] | undefined {
  if (Array.isArray(raw)) return raw as unknown[];
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as unknown[];
    } catch {
      // ignore
    }
  }
  return undefined;
}

async function migrateScalarKey(
  configService: ConfigService,
  mapping: KeyMapping,
): Promise<void> {
  const existingNew = await configService.get<unknown>(mapping.next, undefined);
  if (existingNew !== undefined && existingNew !== null) return;

  const legacyRaw = await configService.get<unknown>(mapping.legacy, undefined);
  if (legacyRaw === undefined || legacyRaw === null) return;

  const value = mapping.parse ? mapping.parse(legacyRaw) : legacyRaw;
  if (value === undefined) {
    log.warn(`Skipping migration of ${mapping.legacy} — value did not parse`, { legacyRaw });
    return;
  }

  await configService.set(mapping.next, value, {
    scope: ConfigScope.INTEGRATION,
    valueType: mapping.valueType,
  });
  log.info(`Migrated ${mapping.legacy} -> ${mapping.next}`);
}

async function seedDownloadEnabled(configService: ConfigService): Promise<void> {
  const existing = await configService.get<unknown>('mangadex.download.enabled', undefined);
  if (existing !== undefined && existing !== null) return;

  // Prefer the legacy key (which historically meant "MangaDex on/off"
  // for both roles); fall back to the new metadata-side key seeded by
  // metadataProvidersEnabledMigration; default to true.
  const legacy = parseBooleanLike(await configService.get<unknown>(`${LEGACY_PREFIX}enabled`, undefined));
  const metadataNew = parseBooleanLike(await configService.get<unknown>('mangadex.enabled', undefined));
  const seed = legacy ?? metadataNew ?? true;

  await configService.set('mangadex.download.enabled', seed, {
    scope: ConfigScope.INTEGRATION,
    valueType: ConfigValueType.BOOLEAN,
    metadata: {
      label: 'Enable MangaDex Downloads',
      description: 'Use MangaDex as a chapter download source',
      category: 'Indexers',
    },
  });
  log.info(`Seeded mangadex.download.enabled = ${seed}`);
}

async function deleteLegacyRows(prisma: PrismaClient): Promise<number> {
  const result = await prisma.config.deleteMany({
    where: { key: { startsWith: LEGACY_PREFIX } },
  });
  return result.count;
}

/**
 * Run the migration. Idempotent — safe to invoke on every server start.
 */
export async function migrateMangadexNamespaceSplit(
  configService: ConfigService,
  prisma: PrismaClient,
): Promise<void> {
  try {
    log.info('Starting MangaDex namespace split migration...');

    for (const mapping of SCALAR_MIGRATIONS) {
      // eslint-disable-next-line no-await-in-loop -- sequential, ordering matters for predictable logs
      await migrateScalarKey(configService, mapping);
    }

    await seedDownloadEnabled(configService);

    const deleted = await deleteLegacyRows(prisma);
    if (deleted > 0) {
      log.info(`Deleted ${deleted} legacy search.providers.MANGADEX.* row(s)`);
    }

    log.info('MangaDex namespace split migration completed');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`MangaDex namespace split migration failed: ${message}`);
    throw error;
  }
}
