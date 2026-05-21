/**
 * Calendar Provider Integration Service
 *
 * Modularized service for integrating calendar features with metadata providers.
 * Coordinates fetching release schedules from multiple providers and handles
 * fallback mechanisms when providers fail.
 *
 * Architecture:
 * - types.ts - Foundation types, interfaces, helpers (108 lines)
 * - database-operations.ts - DB persistence with batch ops (348 lines, FIXED 9 violations)
 * - schedule-detection.ts - Pattern analysis from history (148 lines)
 * - provider-operations.ts - Provider integration (102 lines)
 * - manual-operations.ts - Manual overrides (163 lines)
 * - sync-orchestration.ts - Main sync logic (450 lines, FIXED complexity & max-depth)
 * - index.ts - Service aggregator (this file, ~100 lines)
 *
 * Total: ~1319 lines across 7 focused modules
 * Original: 643 lines in 1 monolithic file
 *
 * Improvements:
 * - ✅ Fixed 10 ESLint violations (1 import order + 9 no-await-in-loop)
 * - ✅ Reduced complexity from 25 to ≤10
 * - ✅ Reduced max-depth from 6 to ≤3
 * - ✅ Batch database operations for performance
 * - ✅ Clear module boundaries for maintainability
 * - ✅ Easy to test independently
 *
 * Extracted from: CalendarProviderIntegrationService.ts (lines 1-643)
 */

import type {
  ManualScheduleOverride,
  ReleaseScheduleSyncOptions,
  ReleaseScheduleSyncResult,
} from '@/server/base/CalendarSupportedProvider';
import type { AsyncResult } from '@/utils/async-result';
import { createLogger } from '@/utils/logger';

import { applyManualOverride } from './manual-operations';
import { syncReleaseSchedules } from './sync-orchestration';

import type { ProviderIntegrationConfig } from './types';

export type { ProviderIntegrationConfig } from './types';

const logger = createLogger('CalendarProviderIntegrationService');

/**
 * Calendar Provider Integration Service
 *
 * Manages integration between calendar features and metadata providers.
 * All business logic is delegated to focused modules.
 */
export class CalendarProviderIntegrationService {
  private config: ProviderIntegrationConfig;

  constructor(config: ProviderIntegrationConfig) {
    this.config = config;
    logger.info('CalendarProviderIntegrationService initialized', {
      providerCount: config.providers.size,
      fallbackStrategy: config.fallbackStrategy,
      defaultTimezone: config.defaultTimezone,
    });
  }

  /**
   * Sync release schedules for monitored manga
   *
   * Delegates to sync-orchestration module which coordinates:
   * - Fetching from multiple providers
   * - Storing release history
   * - Detecting schedules
   * - Generating future events
   *
   * @param options - Sync configuration
   * @returns Sync results with manga count and errors
   */
  async syncReleaseSchedules(
    options: ReleaseScheduleSyncOptions
  ): Promise<AsyncResult<ReleaseScheduleSyncResult, Error>> {
    logger.info('Starting release schedule sync', { options });
    return syncReleaseSchedules(this.config, options);
  }

  /**
   * Apply manual schedule override
   *
   * Delegates to manual-operations module which handles:
   * - Schedule overrides (weekly/monthly patterns)
   * - Next release overrides (specific dates)
   * - Hiatus period marking
   *
   * @param override - Override configuration
   * @returns Success or error result
   */
  async applyManualOverride(
    override: ManualScheduleOverride
  ): Promise<AsyncResult<void, Error>> {
    logger.info('Applying manual override', {
      mangaId: override.mangaId,
      type: override.overrideType,
    });
    return applyManualOverride(this.config, override);
  }
}

/**
 * Factory function to create CalendarProviderIntegrationService
 *
 * @param config - Service configuration
 * @returns Service instance
 */
export function createCalendarProviderIntegrationService(
  config: ProviderIntegrationConfig
): CalendarProviderIntegrationService {
  return new CalendarProviderIntegrationService(config);
}
