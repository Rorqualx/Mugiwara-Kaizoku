/**
 * Experimental JP-Filter Reset Migration
 *
 * One-shot migration: the AniList "filter webtoons / filter Korean manhwa"
 * toggles were previously default-on, which meant every user silently ran with
 * them enabled. They are now default-off (opt-in, experimental). To move
 * existing users onto the new default, this migration deletes any lingering
 * Config rows for those two keys so `configService.get()` falls through to the
 * new code-level default (`false`).
 *
 * Guarded by the `anilist.filterResetV1Applied` marker key — runs exactly once
 * per database.
 */
import { ConfigScope, ConfigValueType } from '@prisma/client';

import { logger } from '@/utils/logger';

import type { ConfigService } from './configService';
import type { PrismaClient } from '@prisma/client';

const MARKER_KEY = 'anilist.filterResetV1Applied';
const KEYS_TO_RESET = ['anilist.filterWebtoons', 'anilist.filterKoreanManhwa'];

export async function runExperimentalFilterResetMigration(
  configService: ConfigService,
  prisma: PrismaClient
): Promise<void> {
  try {
    const alreadyApplied = await configService.get<boolean>(MARKER_KEY, false);
    if (alreadyApplied) {
      return;
    }

    const { count } = await prisma.config.deleteMany({
      where: { key: { in: KEYS_TO_RESET } },
    });

    await configService.set(MARKER_KEY, true, {
      scope: ConfigScope.SYSTEM,
      valueType: ConfigValueType.BOOLEAN,
      metadata: {
        label: 'Experimental JP-filter reset v1 applied',
        description: 'Marker: anilist.filterWebtoons / filterKoreanManhwa Config rows have been reset to the new default-off.',
        category: 'AniList',
      },
    });

    logger.info('[Migration] Reset experimental JP-filter Config rows (v1)', { deleted: count });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Migration] Experimental JP-filter reset failed', { error: errorMessage });
    throw error;
  }
}
