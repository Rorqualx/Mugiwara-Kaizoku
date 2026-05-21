/**
 * Transmission Credentials Cleanup Migration
 *
 * One-shot migration: the Transmission "Session ID / API key" and basic-auth
 * username fields were never read at runtime. `directRequest` (the actual RPC
 * path) only sets `Content-Type` and the auto-negotiated
 * `X-Transmission-Session-Id` header — it never sent an Authorization header
 * or an `X-Api-Key`. The UI surface, defaults, and updaters were removed; this
 * migration deletes any lingering Config rows so they don't reappear in the
 * generic config browser.
 *
 * Guarded by the `download.transmission.credentialsCleanupV1Applied` marker
 * key — runs exactly once per database.
 */
import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import type { ConfigService } from './configService';
import type { PrismaClient } from '@prisma/client';

const MARKER_KEY = 'download.transmission.credentialsCleanupV1Applied';
const KEYS_TO_DELETE = ['download.transmission.apiKey', 'download.transmission.username'];

export async function runTransmissionCredentialsCleanupMigration(
  configService: ConfigService,
  prisma: PrismaClient,
): Promise<void> {
  try {
    const alreadyApplied = await configService.get<boolean>(MARKER_KEY, false);
    if (alreadyApplied) {
      return;
    }

    const { count } = await prisma.config.deleteMany({
      where: { key: { in: KEYS_TO_DELETE } },
    });

    await configService.set(MARKER_KEY, true, {
      scope: ConfigScope.SYSTEM,
      valueType: ConfigValueType.BOOLEAN,
      metadata: {
        label: 'Transmission credentials cleanup v1 applied',
        description:
          'Marker: download.transmission.apiKey / download.transmission.username Config rows have been removed (the Transmission RPC path does not authenticate requests).',
        category: 'Download Clients',
      },
    });

    logger.info('[Migration] Removed unused Transmission credential Config rows (v1)', {
      deleted: count,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Migration] Transmission credentials cleanup failed', { error: errorMessage });
    throw error;
  }
}
