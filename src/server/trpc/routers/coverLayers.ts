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
  type CoverSegmenter,
  LIVING_COVERS_ENABLED_KEY,
  LIVING_COVERS_SEGMENTER_KEY,
  LIVING_COVERS_SMART_EFFECTS_KEY,
  coverMotionSpeed,
  coverSegmenter,
  downloadCoverModels,
  groundedSamAvailable,
  isDownloadingModels,
  isLivingCoversEnabled,
  LIVING_COVERS_MOTION_SPEED_KEY,
  modelDownloadProgress,
  modelsPresent,
  smartEffectsEnabled,
  type ModelDownloadProgress,
} from '@/server/services/coverLayers/coverLayerizer';
import { isProcessing, processLibraryCovers, processProgress, type ProcessProgress } from '@/server/services/coverLayers/processLibrary';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

interface CoverLayersStatus {
  enabled: boolean;
  segmenter: CoverSegmenter;
  smartEffects: boolean;
  motionSpeed: number;
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
    const [enabled, segmenter, smart, speed, models, total, ready, pending, failed, layered, flat] = await Promise.all([
      isLivingCoversEnabled(),
      coverSegmenter(),
      smartEffectsEnabled(),
      coverMotionSpeed(),
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
      segmenter,
      smartEffects: smart,
      motionSpeed: speed,
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

  /**
   * Whether the GPU `grounded-sam` tier can actually run here (torch +
   * GroundingDINO weights). Spawns a probe subprocess (cached), so it is a
   * dedicated query — kept off the hot `status` path used by the render gate.
   */
  groundedSamAvailable: protectedProcedure.query(async (): Promise<{ available: boolean }> => ({
    available: await groundedSamAvailable(),
  })),

  /** Flip the global Living Covers master switch. */
  setEnabled: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }): Promise<{ enabled: boolean }> => {
      await configService.set(LIVING_COVERS_ENABLED_KEY, input.enabled);
      logger.info('[cover-layers] enabled set', { enabled: input.enabled });
      return { enabled: input.enabled };
    }),

  /** Choose the segmenter / quality tier (re-process to apply). */
  setSegmenter: adminProcedure
    .input(z.object({ segmenter: z.enum(['standard', 'sam', 'grounded-sam']) }))
    .mutation(async ({ input }): Promise<{ segmenter: CoverSegmenter }> => {
      await configService.set(LIVING_COVERS_SEGMENTER_KEY, input.segmenter);
      logger.info('[cover-layers] segmenter set', { segmenter: input.segmenter });
      return { segmenter: input.segmenter };
    }),

  /** Toggle tag-driven mood motion (re-process to apply). */
  setSmartEffects: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }): Promise<{ smartEffects: boolean }> => {
      await configService.set(LIVING_COVERS_SMART_EFFECTS_KEY, input.enabled);
      logger.info('[cover-layers] smartEffects set', { enabled: input.enabled });
      return { smartEffects: input.enabled };
    }),

  /** Set the global cover-motion speed multiplier (render-time — applies without re-processing). */
  setMotionSpeed: adminProcedure
    .input(z.object({ speed: z.number().min(0.3).max(2) }))
    .mutation(async ({ input }): Promise<{ motionSpeed: number }> => {
      await configService.set(LIVING_COVERS_MOTION_SPEED_KEY, input.speed);
      logger.info('[cover-layers] motionSpeed set', { speed: input.speed });
      return { motionSpeed: input.speed };
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
