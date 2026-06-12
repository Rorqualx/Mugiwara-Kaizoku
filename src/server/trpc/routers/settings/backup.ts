/**
 * Backup Settings Router
 *
 * Handles backup configuration only: get / update settings.
 * Manual backup creation and restore live in services/backup and are invoked
 * via the queue (`handlers/backup.ts`) and via `routers/backup.ts` /
 * `routers/system/backup.ts`. The `backupDatabase` / `restoreDatabase`
 * procedures that used to live here were stubs returning hardcoded success
 * and have been removed.
 */

import { TRPCError } from '@trpc/server';

import {
  getGeneralConfigService,
  type BackupSettings,
} from '@/server/services/config/generalConfigService';
import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { toTRPCError } from '@/server/trpc/errors';
import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createContextualError } from '@/utils/async-result';
import { logger } from '@/utils/logging';

import { backupSettingsSchema } from './utils';

export const settingsBackupRouter = router({
  /** Get backup settings - retrieves current backup configuration */
  getBackupSettings: adminProcedure.query(async (): Promise<BackupSettings> => {
    try {
      const configService = getGlobalConfigService();
      const generalConfigService = getGeneralConfigService(configService);
      return await generalConfigService.getBackupSettings();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error getting backup settings: ${errorMessage}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: errorMessage,
      });
    }
  }),

  /** Update backup settings - updates backup configuration */
  updateBackupSettings: adminProcedure
    .input(backupSettingsSchema)
    .mutation(async ({ input }): Promise<boolean> => {
      try {
        const configService = getGlobalConfigService();
        const generalConfigService = getGeneralConfigService(configService);
        await generalConfigService.updateBackupSettings(input);

        // Emit WebSocket event for backup settings update
        void realtimeEmitter.emitSystemEvent({
          eventType: 'backup:settings:updated',
          source: 'settingsBackupRouter',
          message: 'Backup settings updated',
          data: { autoBackup: input.autoBackup }
        });

        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error updating backup settings: ${errorMessage}`);
        throw toTRPCError(
          createContextualError(errorMessage, 'CONFIGURATION_ERROR')
        );
      }
    }),

  // backupDatabase / restoreDatabase used to live here as exposed adminProcedure
  // mutations whose bodies were "// For now, it's a stub" — they returned
  // hardcoded success without actually backing up or restoring. They've been
  // removed: the real backup pipeline is in services/backup/* and is invoked
  // via the queue (handlers/backup.ts) for create and via routers/backup.ts /
  // routers/system/backup.ts for direct calls. No UI code referenced these
  // stubs, so removal is non-breaking.
});
