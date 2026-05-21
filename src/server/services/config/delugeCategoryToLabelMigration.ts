/**
 * Deluge Category → Label Key Migration
 *
 * One-shot migration: a previous version of `useDelugeConfig` wrote the
 * Deluge "Category (Label)" UI field to `download.deluge.category`, while the
 * legacy `DownloadClientConfigService` and the new runtime builder
 * (`config-builders.ts`) both expect `download.deluge.label`. Result: the UI
 * value never reached the dispatcher.
 *
 * This migration copies any `download.deluge.category` value into
 * `download.deluge.label` (only if `.label` doesn't already hold a non-empty
 * user value), then deletes the orphan `.category` row.
 *
 * Guarded by the `download.deluge.categoryToLabelV1Applied` marker key — runs
 * exactly once per database.
 */
import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import type { ConfigService } from './configService';
import type { PrismaClient } from '@prisma/client';

const MARKER_KEY = 'download.deluge.categoryToLabelV1Applied';
const ORPHAN_KEY = 'download.deluge.category';
const CANONICAL_KEY = 'download.deluge.label';

/**
 * Copies the orphan `download.deluge.category` value into the canonical
 * `download.deluge.label` key when the canonical key holds an unmodified
 * default. Returns whether a copy actually happened.
 */
async function copyOrphanIfCanonicalIsDefault(
  configService: ConfigService,
  prisma: PrismaClient,
  orphanValue: string,
): Promise<boolean> {
  const canonicalRow = await prisma.config.findUnique({ where: { key: CANONICAL_KEY } });
  const canonicalIsDefault =
    !canonicalRow || canonicalRow.value === '' || canonicalRow.value === 'manga';
  if (!canonicalIsDefault) {
    return false;
  }
  await configService.set<string>(CANONICAL_KEY, orphanValue, {
    scope: ConfigScope.INTEGRATION,
    valueType: ConfigValueType.STRING,
    metadata: {
      label: 'Deluge Label',
      description: 'Label assigned to torrents in Deluge',
      category: 'Download Clients',
    },
  });
  return true;
}

export async function runDelugeCategoryToLabelMigration(
  configService: ConfigService,
  prisma: PrismaClient,
): Promise<void> {
  try {
    const alreadyApplied = await configService.get<boolean>(MARKER_KEY, false);
    if (alreadyApplied) {
      return;
    }

    const orphanRow = await prisma.config.findUnique({ where: { key: ORPHAN_KEY } });
    const copied =
      orphanRow !== null && orphanRow.value !== ''
        ? await copyOrphanIfCanonicalIsDefault(configService, prisma, orphanRow.value)
        : false;

    const { count } = await prisma.config.deleteMany({ where: { key: ORPHAN_KEY } });

    await configService.set(MARKER_KEY, true, {
      scope: ConfigScope.SYSTEM,
      valueType: ConfigValueType.BOOLEAN,
      metadata: {
        label: 'Deluge category→label migration v1 applied',
        description:
          'Marker: download.deluge.category has been migrated into download.deluge.label and the orphan key removed.',
        category: 'Download Clients',
      },
    });

    logger.info('[Migration] Deluge category→label migration applied', {
      copied,
      orphansDeleted: count,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Migration] Deluge category→label migration failed', { error: errorMessage });
    throw error;
  }
}
