/**
 * Import Blocked Handler
 *
 * Creates a user-facing notification when an import fails or is blocked.
 * This ensures the user is informed and can take corrective action
 * (e.g. fixing file permissions, freeing disk space).
 *
 * @module server/services/pipeline/handlers/import-blocked-handler
 */

import { pipelineEventBus } from '@/server/services/pipeline/pipeline-event-bus';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { PIPELINE_EVENTS } from '@/types/domain/pipeline-events';
import { logger } from '@/utils/logger';

const TAG = '[ImportBlockedHandler]';

/**
 * Register handler that emits user notifications for import failures
 */
export function registerImportBlockedHandler(): void {
  pipelineEventBus.on(PIPELINE_EVENTS.IMPORT_FAILED, (event) => {
    void realtimeEmitter.emitNotification({
      title: 'Import Failed',
      message: `Import failed for manga ${event.mangaId}: ${event.error}`,
      level: 'error',
      action: {
        label: 'View Details',
        url: '/jobs/active',
      },
    });
  });

  pipelineEventBus.on(PIPELINE_EVENTS.IMPORT_BLOCKED, (event) => {
    void realtimeEmitter.emitNotification({
      title: 'Import Blocked',
      message: `Import blocked for manga ${event.mangaId}: ${event.reason}`,
      level: 'warning',
      action: {
        label: 'Resolve',
        url: event.actionUrl ?? '/jobs/active',
      },
    });
  });

  logger.debug(`${TAG} Import blocked handler registered`);
}
