/**
 * Cover Layers router
 *
 * Admin controls for the "Living Covers" feature: the global enable switch,
 * on-demand ONNX model download, and a library-wide processing trigger. Status
 * is read by the settings page and the client render gate.
 */

import { z } from 'zod';

import { prisma } from '@/server/db';
import { configService } from '@/server/services/config/configService';
import {
  LIVING_COVERS_ENABLED_KEY,
  downloadCoverModels,
  isDownloadingModels,
  isLivingCoversEnabled,
  modelDownloadProgress,
  modelsPresent,
  type ModelDownloadProgress,
} from '@/server/services/coverLayers/coverLayerizer';
import { isProcessing, processLibraryCovers, processProgress, type ProcessProgress } from '@/server/services/coverLayers/processLibrary';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

interface CoverLayersStatus {
  enabled: boolean;
  modelsPresent: boolean;
  downloadingModels: boolean;
  download: ModelDownloadProgress;
  total: number;
  ready: number;
  layered: number;
  flat: number;
  pending: number;
  failed: number;
  progress: ProcessProgress;
}

export const coverLayersRouter = router({
  /** Feature state + library coverage counts (consumed by settings + render gate). */
  status: protectedProcedure.query(async (): Promise<CoverLayersStatus> => {
    const [enabled, models, total, ready, pending, failed, layered, flat] = await Promise.all([
      isLivingCoversEnabled(),
      modelsPresent(),
      prisma.manga.count(),
      prisma.coverLayerSet.count({ where: { status: 'ready' } }),
      prisma.coverLayerSet.count({ where: { status: 'pending' } }),
      prisma.coverLayerSet.count({ where: { status: 'failed' } }),
      prisma.coverLayerSet.count({ where: { status: 'ready', mode: 'layered' } }),
      prisma.coverLayerSet.count({ where: { status: 'ready', mode: 'flat' } }),
    ]);
    return {
      enabled,
      modelsPresent: models,
      downloadingModels: isDownloadingModels(),
      download: modelDownloadProgress(),
      total,
      ready,
      layered,
      flat,
      pending,
      failed,
      progress: processProgress(),
    };
  }),

  /** Flip the global Living Covers master switch. */
  setEnabled: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }): Promise<{ enabled: boolean }> => {
      await configService.set(LIVING_COVERS_ENABLED_KEY, input.enabled);
      logger.info('[cover-layers] enabled set', { enabled: input.enabled });
      return { enabled: input.enabled };
    }),

  /** Kick off the ONNX model download (idempotent; self-guards against re-entry). */
  downloadModels: adminProcedure.mutation((): { started: boolean } => {
    if (isDownloadingModels()) {
      return { started: false };
    }
    void downloadCoverModels().then((r) => {
      if (r.ok) {
        logger.info('[cover-layers] models downloaded');
      } else {
        logger.warn('[cover-layers] model download failed', { error: r.error });
      }
    });
    return { started: true };
  }),

  /** Start a library-wide layerize run (refuses if models missing or already running). */
  processLibrary: adminProcedure
    .input(z.object({ libraryId: z.number().int().positive().optional(), force: z.boolean().optional() }).optional())
    .mutation(async ({ input }): Promise<{ started: boolean; reason?: string }> => {
      if (isProcessing()) {
        return { started: false, reason: 'already-running' };
      }
      if (!(await modelsPresent())) {
        return { started: false, reason: 'models-missing' };
      }
      void processLibraryCovers({ libraryId: input?.libraryId, force: input?.force, concurrency: 2 }).catch(
        (err: unknown) => {
          logger.error('[cover-layers] processLibrary threw', {
            error: err instanceof Error ? err.message : String(err),
          });
        },
      );
      return { started: true };
    }),
});
