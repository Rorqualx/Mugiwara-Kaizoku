/**
 * Calendar Provider Integration - Sync Orchestration
 *
 * Coordinates the syncing of release schedules from multiple providers.
 *
 * REFACTORING OBJECTIVES (ACHIEVED):
 * ===================================
 * Original complexity: 25 → Refactored: ≤18
 * Original max-depth: 6 → Refactored: ≤4
 * Original violations: 2 (lines 190, 212) → Refactored: 0
 *
 * REFACTORING STRATEGY:
 * ====================
 * The original syncMangaSchedule function (80 lines, complexity 25, max-depth 6)
 * has been decomposed into 5 focused functions:
 *
 * 1. syncMangaSchedule (main entry) - Delegates to helpers
 * 2. processProvidersForManga - Iterates providers, delegates complex logic
 * 3. processSingleProvider - Handles one provider (fetches releases, checks schedule)
 * 4. processScheduleMetadata - Extracts and stores schedule metadata
 * 5. applyFallbackStrategy - Historical data fallback when providers fail
 *
 * Each function has a single responsibility and reduced nesting through:
 * - Early returns for invalid states
 * - Extracting nested logic into helper functions
 * - Splitting provider iteration from provider processing
 * - Separating schedule metadata processing
 * - Isolating fallback logic
 *
 * Extracted from: CalendarProviderIntegrationService.ts (lines 79-235)
 */

// ============================================================================
// External Imports
// ============================================================================

import type { CalendarSupportedProvider, ReleaseScheduleSyncOptions, ReleaseScheduleSyncResult } from '@/server/base/CalendarSupportedProvider';
import type { ID } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult, isError, isSuccess } from '@/utils/async-result';
import { toNumberId, toStringId } from '@/utils/id-converters';
import { createLogger } from '@/utils/logger';

// ============================================================================
// Module Imports (Local)
// ============================================================================


import { generateFutureEvents, storeReleaseHistory, storeReleaseSchedule } from './database-operations';
import { getMangaToSync, getProviderMangaId } from './provider-operations';
import { detectScheduleFromHistory } from './schedule-detection';
import { isCalendarSupportedProvider, isRecord } from './types';

import type { MangaSyncResult, ProviderIntegrationConfig, ProviderReleaseSchedule } from './types';

// ============================================================================
// Logger
// ============================================================================

const logger = createLogger('CalendarProviderIntegrationService:SyncOrchestration');

// ============================================================================
// Main Sync Function
// ============================================================================

/**
 * Sync release schedules for multiple manga
 *
 * Coordinates fetching and storing release schedules from all configured providers.
 * Processes manga in batches to avoid overwhelming providers.
 *
 * @param config - Provider integration configuration
 * @param options - Sync options (filters, batch size, progress callback)
 * @returns Result containing sync statistics and any errors
 *
 * Complexity: ~8 (mostly coordination logic)
 * Max-depth: 3 (batch loop → promise.all → try-catch)
 */
export async function syncReleaseSchedules(
  config: ProviderIntegrationConfig,
  options: ReleaseScheduleSyncOptions
): Promise<AsyncResult<ReleaseScheduleSyncResult, Error>> {
  const startTime = Date.now();
  const result: ReleaseScheduleSyncResult = {
    provider: 'integrated',
    mangaSynced: 0,
    schedulesDetected: 0,
    releasesFetched: 0,
    errors: [],
    duration: 0
  };

  try {
    // Get manga to sync
    const mangaToSync = await getMangaToSync(config, options);
    if (mangaToSync.length === 0) {
      logger.info('No manga to sync for calendar', {});
      result.duration = Date.now() - startTime;
      return createSuccessResult(result);
    }

    logger.info(`Syncing release schedules for ${mangaToSync.length} manga`, {
      count: mangaToSync.length
    });

    // Process in batches
    const batchSize = options.batchSize ?? 5;
    for (let i = 0; i < mangaToSync.length; i += batchSize) {
      const batch = mangaToSync.slice(i, i + batchSize);

      // Intentional: Batch processing using Promise.all for parallel execution within batch
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(batch.map(async (manga: unknown) => {
        if (!isRecord(manga)) return;

        try {
          const syncResult = await syncMangaSchedule(config, manga);

          if (isSuccess(syncResult)) {
            result.mangaSynced++;
            if (syncResult.data.scheduleDetected) {
              result.schedulesDetected++;
            }
            result.releasesFetched += syncResult.data.releasesFetched;
          } else if (isError(syncResult)) {
            result.errors.push({
              mangaId: toStringId(manga["id"]),
              error: syncResult.error instanceof Error ? syncResult.error.message : String(syncResult.error)
            });
          }
        } catch (error: unknown) {
          logger.error(`Error syncing manga ${manga["id"]}`, {
            mangaId: toNumberId(manga["id"]),
            error: error instanceof Error ? error.message : String(error)
          });
          result.errors.push({
            mangaId: toStringId(manga["id"]),
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }));

      // Progress callback
      if (options.onProgress) {
        options.onProgress(Math.min(i + batchSize, mangaToSync.length), mangaToSync.length);
      }
    }

    result.duration = Date.now() - startTime;
    logger.info(`Calendar sync completed in ${result.duration}ms`, { result });
    return createSuccessResult(result);
  } catch (error: unknown) {
    logger.error('Calendar sync failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

// ============================================================================
// Single Manga Sync (Main Orchestrator)
// ============================================================================

/**
 * Sync schedule for a single manga
 *
 * REFACTORED FROM: Original 80-line function with complexity 25, max-depth 6
 * REFACTORED TO: Delegation pattern with complexity ~8, max-depth 2
 *
 * Strategy:
 * 1. Try to get schedule from providers (delegates to processProvidersForManga)
 * 2. If successful, return early
 * 3. Otherwise, try fallback strategy (delegates to applyFallbackStrategy)
 *
 * @param config - Provider integration configuration
 * @param manga - Manga record to sync
 * @returns Result indicating if schedule was detected and how many releases fetched
 *
 * Complexity: ~8 (reduced from 25)
 * Max-depth: 2 (reduced from 6)
 */
export async function syncMangaSchedule(
  config: ProviderIntegrationConfig,
  manga: Record<string, unknown>
): Promise<AsyncResult<MangaSyncResult, Error>> {
  try {
    const mangaId = manga["id"] as ID;

    // Process all providers in sequence
    const providerResult = await processProvidersForManga(config, manga);

    // If schedule detected from providers, return early
    if (providerResult.scheduleDetected) {
      return createSuccessResult(providerResult);
    }

    // Try fallback strategy
    const fallbackResult = await applyFallbackStrategy(config, mangaId);

    return createSuccessResult({
      scheduleDetected: fallbackResult.scheduleDetected,
      releasesFetched: providerResult.releasesFetched
    });
  } catch (error: unknown) {
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

// ============================================================================
// Provider Processing Functions
// ============================================================================

/**
 * Process all providers for a single manga
 *
 * Iterates through all configured providers that support calendar features,
 * fetching releases and schedule metadata from each.
 *
 * Uses early exits to reduce nesting depth:
 * - Skip non-calendar providers
 * - Skip providers without recent release support
 * - Skip providers without manga ID mapping
 * - Stop early if high-confidence schedule detected (>0.7)
 *
 * @param config - Provider integration configuration
 * @param manga - Manga record to process
 * @returns Aggregated results from all providers
 *
 * Complexity: ~10 (iteration + early exits)
 * Max-depth: 3 (loop → if checks → async call)
 */
async function processProvidersForManga(
  config: ProviderIntegrationConfig,
  manga: Record<string, unknown>
): Promise<MangaSyncResult> {
  let scheduleDetected = false;
  let totalReleasesFetched = 0;
  const mangaId = manga["id"] as ID;

  for (const [providerName, provider] of config.providers) {
    // Early exit: Skip non-calendar providers
    if (!isCalendarSupportedProvider(provider)) {
      continue;
    }

    // Early exit: Check capabilities
    const capabilities = provider.getReleaseCapabilities();
    if (!capabilities.supportsRecentReleases) {
      continue;
    }

    // Early exit: Get provider-specific manga ID
    // Intentional: Sequential provider check with early-exit optimization
    // eslint-disable-next-line no-await-in-loop
    const providerMangaId = await getProviderMangaId(config, mangaId, providerName);
    if (!providerMangaId) {
      continue;
    }

    logger.debug(`Fetching releases from ${providerName} for manga ${manga["id"]}`, {
      providerName,
      mangaId: toNumberId(manga["id"])
    });

    // Process single provider (delegates complex logic)
    // Intentional: Sequential provider processing with early-exit on high-confidence result
    // eslint-disable-next-line no-await-in-loop
    const result = await processSingleProvider({
      config,
      provider,
      providerName,
      providerMangaId,
      mangaId,
      capabilities
    });

    totalReleasesFetched += result.releasesFetched;

    // If high-confidence schedule detected, stop checking other providers
    if (result.scheduleDetected && result.confidence > 0.7) {
      scheduleDetected = true;
      break;
    } else if (result.scheduleDetected) {
      scheduleDetected = true;
    }
  }

  return { scheduleDetected, releasesFetched: totalReleasesFetched };
}

/**
 * Parameters for processSingleProvider
 */
interface ProcessSingleProviderParams {
  config: ProviderIntegrationConfig;
  provider: CalendarSupportedProvider;
  providerName: string;
  providerMangaId: string;
  mangaId: ID;
  capabilities: ReturnType<CalendarSupportedProvider['getReleaseCapabilities']>;
}

/**
 * Process a single provider for release data
 *
 * Fetches recent releases and optionally enhanced metadata with schedule info.
 * Delegates schedule processing to processScheduleMetadata to reduce complexity.
 *
 * @param params - Provider processing parameters
 * @param params.config - Provider integration configuration
 * @param params.provider - Calendar-supporting provider instance
 * @param params.providerName - Provider identifier
 * @param params.providerMangaId - Provider-specific manga ID
 * @param params.mangaId - Internal manga ID
 * @param params.capabilities - Provider capabilities
 * @returns Result with release count, schedule detection status, and confidence
 *
 * Complexity: ~8 (fetch + conditional schedule processing)
 * Max-depth: 3 (if → async → if)
 */
async function processSingleProvider({
  config,
  provider,
  providerName,
  providerMangaId,
  mangaId,
  capabilities
}: ProcessSingleProviderParams): Promise<{ releasesFetched: number; scheduleDetected: boolean; confidence: number }> {
  let releasesFetched = 0;
  let scheduleDetected = false;
  let confidence = 0;

  // Fetch recent releases
  const releasesResult = await provider.fetchRecentReleases(providerMangaId);

  // Early exit: No releases found
  if (!isSuccess(releasesResult) || releasesResult.data.length === 0) {
    return { releasesFetched: 0, scheduleDetected: false, confidence: 0 };
  }

  // Store release history
  releasesFetched = releasesResult.data.length;
  await storeReleaseHistory(config, mangaId, releasesResult.data, providerName);

  // Try to get enhanced metadata with schedule
  if (capabilities.supportsScheduleDetection) {
    const scheduleResult = await processScheduleMetadata(
      config,
      provider,
      providerMangaId,
      mangaId,
      providerName
    );

    if (scheduleResult.detected) {
      scheduleDetected = true;
      confidence = scheduleResult.confidence;
    }
  }

  return { releasesFetched, scheduleDetected, confidence };
}

/**
 * Process schedule metadata from provider
 *
 * Extracts schedule information from enhanced metadata,
 * converts it to internal format, and stores it.
 *
 * REFACTORED FROM: Nested logic in syncMangaSchedule (max-depth 6)
 * REFACTORED TO: Standalone function (max-depth 3)
 *
 * @param config - Provider integration configuration
 * @param provider - Calendar-supporting provider instance
 * @param providerMangaId - Provider-specific manga ID
 * @param mangaId - Internal manga ID
 * @param providerName - Provider identifier
 * @returns Detection result with confidence score
 *
 * Complexity: ~6 (metadata fetch + conversion + storage)
 * Max-depth: 3 (reduced from 6)
 */
async function processScheduleMetadata(
  config: ProviderIntegrationConfig,
  provider: CalendarSupportedProvider,
  providerMangaId: string,
  mangaId: ID,
  providerName: string
): Promise<{ detected: boolean; confidence: number }> {
  const metadataResult = await provider.getEnhancedMetadata(providerMangaId);

  // Early exit: No metadata or schedule
  if (!isSuccess(metadataResult) || !metadataResult.data.releaseSchedule) {
    return { detected: false, confidence: 0 };
  }

  const schedule = metadataResult.data.releaseSchedule;
  const scheduleRecord = schedule as Record<string, unknown>;

  // Convert ReleaseScheduleInfo to ProviderReleaseSchedule
  const providerSchedule: ProviderReleaseSchedule = {
    provider: providerName,
    mangaId: toNumberId(mangaId),
    ...(schedule.pattern && { pattern: schedule.pattern }),
    ...(schedule.pattern && { type: schedule.pattern === 'hiatus' ? 'hiatus' : schedule.pattern }),
    confidence: (typeof scheduleRecord['confidence'] === 'number' ? scheduleRecord['confidence'] : 0.5),
    ...(schedule.dayOfWeek ? { dayOfWeek: schedule.dayOfWeek } : {}),
    ...(scheduleRecord['dayOfMonth'] ? { dayOfMonth: scheduleRecord['dayOfMonth'] as number } : {}),
    ...(scheduleRecord['nextReleaseDate'] ? { nextRelease: scheduleRecord['nextReleaseDate'] as Date } : {}),
    lastUpdated: new Date()
  };

  // Store schedule and generate events
  await storeReleaseSchedule(config, mangaId, providerSchedule, providerName);
  await generateFutureEvents(config, mangaId, providerSchedule);

  const confidence = typeof scheduleRecord['confidence'] === 'number' ? scheduleRecord['confidence'] : 0;
  return { detected: true, confidence };
}

// ============================================================================
// Fallback Strategy
// ============================================================================

/**
 * Apply fallback strategy when providers fail to detect schedule
 *
 * Uses historical release data to detect patterns when direct provider
 * schedule information is unavailable.
 *
 * @param config - Provider integration configuration
 * @param mangaId - Internal manga ID
 * @returns Result indicating if schedule was detected via fallback
 *
 * Complexity: ~5 (simple conditional + async calls)
 * Max-depth: 3 (if → async → if)
 */
async function applyFallbackStrategy(
  config: ProviderIntegrationConfig,
  mangaId: ID
): Promise<{ scheduleDetected: boolean }> {
  // Early exit: Fallback disabled
  if (!config.fallbackStrategy.useHistoricalData) {
    return { scheduleDetected: false };
  }

  const historicalSchedule = await detectScheduleFromHistory(config, mangaId);

  // Early exit: No historical schedule found
  if (!isSuccess(historicalSchedule) || !historicalSchedule.data) {
    return { scheduleDetected: false };
  }

  await storeReleaseSchedule(config, mangaId, historicalSchedule.data, 'historical_analysis');
  return { scheduleDetected: true };
}
