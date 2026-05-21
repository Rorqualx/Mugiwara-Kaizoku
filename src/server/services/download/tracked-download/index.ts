/**
 * Tracked Download Module
 *
 * Formal state machine for download lifecycle management.
 *
 * @module server/services/download/tracked-download
 */

// Types
export {
  TrackedDownloadState,
  TrackedDownloadEvent,
} from './types';
export type {
  TrackedDownload,
  TransitionResult,
  CreateTrackedDownloadParams,
} from './types';

// State machine (pure functions)
export {
  transition,
  canTransition,
  getValidEvents,
  isTerminalState,
} from './state-machine';

// Service (singleton)
export {
  trackedDownloadService,
  TrackedDownloadService,
} from './tracked-download-service';

// Database sync
export {
  mapStateToJobStatus,
  mapStateToChapterStatus,
  mapStateToPackStatus,
  mapClientStatusToEvent,
  hydrateFromDatabase,
  syncToDatabase,
} from './db-sync';
