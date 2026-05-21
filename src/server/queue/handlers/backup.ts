import { jobs, BackupContent, BackupType } from '@prisma/client';
import { z } from 'zod';

import { backupService } from '@/server/services/backup';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';

// Exported so a regression test can assert this schema matches the payload
// shape produced by services/backup/scheduling.ts. A divergence between the
// two is what made backup jobs silently no-op (see A3 in the audit).
export const BackupCreatePayloadSchema = z.object({
  type: z.nativeEnum(BackupType).optional(),
  contents: z.array(z.nativeEnum(BackupContent)).optional(),
  name: z.string().optional(),
  notes: z.string().optional(),
});

export async function handleBackupCreate(job: jobs): Promise<void> {
  const result = BackupCreatePayloadSchema.safeParse(job.payload);
  if (!result.success) {
    logger.error('Invalid backup create payload:', result.error);
    throw new Error(`Invalid job payload: ${result.error.message}`);
  }

  const { type, contents, name, notes } = result.data;
  const displayName = name ?? `Backup job ${String(job.id)}`;

  void realtimeEmitter.emitBackupOperation({
    operation: 'started',
    name: displayName,
  });

  try {
    const backupId = await backupService.createBackup({
      ...(type !== undefined && { type }),
      ...(contents !== undefined && { contents }),
      ...(name !== undefined && { name }),
      ...(notes !== undefined && { notes }),
    });

    logger.info(`Backup created successfully: backupId=${backupId} (job ${String(job.id)})`);

    void realtimeEmitter.emitBackupOperation({
      operation: 'completed',
      backupId,
      name: displayName,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Backup job ${String(job.id)} failed: ${errorMessage}`);
    void realtimeEmitter.emitBackupOperation({
      operation: 'failed',
      name: displayName,
      error: errorMessage,
    });
    throw error;
  }
}
