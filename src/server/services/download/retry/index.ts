/**
 * Download Retry Module
 *
 * Provides automatic retry logic for failed downloads:
 * - Failure detection (stalled, no seeds, client errors, NZB failures)
 * - Automatic blocklisting of failed releases
 * - Alternative release finding via Prowlarr
 * - Retry orchestration with configurable limits
 *
 * @module server/services/download/retry
 */

// Types
export {
  DownloadFailureReason,
  DEFAULT_RETRY_CONFIG,
  RETRY_CONFIG_KEYS,
} from './types';

export type {
  DownloadRetryConfig,
  FailedDownloadInfo,
  RetryAttemptResult,
  DownloadClientStatus,
} from './types';

// Failure Detection
export {
  detectFailure,
  isStalled,
  hasNoSeeders,
  isExplicitError,
  isNzbFailed,
  isDownloadHealthy,
  normalizeClientStatus,
} from './failure-detector';

export type { FailureDetectionResult } from './failure-detector';

// Retry Service
export { DownloadRetryService, getRetryService } from './retry-service';
