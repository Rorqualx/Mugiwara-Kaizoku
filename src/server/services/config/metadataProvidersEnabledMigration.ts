/**
 * Metadata Providers — Enabled Backfill Migration
 *
 * Backfills per-provider `{provider}.enabled` config keys from the legacy
 * `metadata` blob (`metadata.providers.{id}.enabled`). Idempotent: only writes
 * a key when it is currently unset.
 *
 * Companion to `comicvineMigration.ts` (which already covers `comicvine.enabled`)
 * — extends coverage to the other 6 metadata providers so the entire grid can
 * be driven from per-provider keys instead of the JSON blob.
 *
 * Special cases:
 *   - `mangadex.enabled` mirrors the existing `search.providers.MANGADEX.enabled`
 *     when the new key is absent (so toggling either remains backwards-compatible
 *     during the transition).
 *   - `mal` and `mangaupdates` had no per-provider keys before; they are seeded
 *     from the blob (or from defaults if the blob is missing).
 */
import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import type { ConfigService } from './configService';

const PROVIDERS = ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia', 'mal', 'mangaupdates', 'kitsu'] as const;
type ProviderId = typeof PROVIDERS[number];

const DEFAULT_ENABLED: Record<ProviderId, boolean> = {
  anilist: true,
  mangadex: true,
  comicvine: false,
  fandom: true,
  wikipedia: true,
  mal: false,
  mangaupdates: true,
  // Default off for soak — flip after Phase 2A coverage shows non-zero kitsu.
  kitsu: false,
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  anilist: 'AniList',
  mangadex: 'MangaDex',
  comicvine: 'ComicVine',
  fandom: 'Fandom',
  wikipedia: 'Wikipedia',
  mal: 'MyAnimeList',
  mangaupdates: 'MangaUpdates',
  kitsu: 'Kitsu',
};

interface BlobProviderEntry {
  enabled?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMetadataBlob(raw: unknown): Record<string, BlobProviderEntry> | null {
  let parsed: unknown = raw;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!isRecord(parsed)) return null;
  const providers = parsed['providers'];
  if (!isRecord(providers)) return null;
  const out: Record<string, BlobProviderEntry> = {};
  for (const [id, value] of Object.entries(providers)) {
    if (isRecord(value)) {
      const enabled = value['enabled'];
      out[id] = typeof enabled === 'boolean' ? { enabled } : {};
    }
  }
  return out;
}

async function resolveEnabledForProvider(
  configService: ConfigService,
  id: ProviderId,
  blob: Record<string, BlobProviderEntry> | null,
): Promise<boolean> {
  const blobValue = blob?.[id]?.enabled;
  if (typeof blobValue === 'boolean') return blobValue;

  if (id === 'mangadex') {
    const legacy = await configService.get<unknown>('search.providers.MANGADEX.enabled', undefined);
    if (typeof legacy === 'boolean') return legacy;
  }

  return DEFAULT_ENABLED[id];
}

async function seedProvider(
  configService: ConfigService,
  id: ProviderId,
  enabled: boolean,
): Promise<void> {
  await configService.set(`${id}.enabled`, enabled, {
    scope: ConfigScope.INTEGRATION,
    valueType: ConfigValueType.BOOLEAN,
    metadata: {
      label: `Enable ${PROVIDER_LABELS[id]}`,
      description: `Use ${PROVIDER_LABELS[id]} as a metadata provider`,
      category: 'Metadata Providers',
    },
  });
}

/**
 * Run the backfill. Idempotent — re-runnable on every startup.
 */
export async function migrateMetadataProvidersEnabled(configService: ConfigService): Promise<void> {
  try {
    logger.info('Starting metadata providers enabled migration...');

    const blobRaw = await configService.get<unknown>('metadata', undefined);
    const blob = parseMetadataBlob(blobRaw);

    /* eslint-disable no-await-in-loop -- one-shot startup migration over ~5 providers; sequential keeps the seed log readable and avoids any chance of racing on the same config rows */
    for (const id of PROVIDERS) {
      const existing = await configService.get<unknown>(`${id}.enabled`, undefined);
      if (existing !== undefined && existing !== null) continue;

      const enabled = await resolveEnabledForProvider(configService, id, blob);
      await seedProvider(configService, id, enabled);
      logger.info(`Seeded ${id}.enabled = ${enabled}`);
    }
    /* eslint-enable no-await-in-loop */

    logger.info('Metadata providers enabled migration completed');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Metadata providers enabled migration failed: ${errorMessage}`);
    throw error;
  }
}
