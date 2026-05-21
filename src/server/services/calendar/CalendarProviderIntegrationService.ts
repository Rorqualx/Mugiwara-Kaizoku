/**
 * DEPRECATED: This file is maintained for backward compatibility.
 * The service has been refactored into focused modules.
 *
 * See: src/server/services/calendar/calendar-provider-integration/
 *
 * Architecture:
 * - types.ts - Foundation types, interfaces, helpers (108 lines)
 * - database-operations.ts - DB persistence with batch ops (348 lines)
 * - schedule-detection.ts - Pattern analysis from history (148 lines)
 * - provider-operations.ts - Provider integration (102 lines)
 * - manual-operations.ts - Manual overrides (163 lines)
 * - sync-orchestration.ts - Main sync logic (450 lines)
 * - index.ts - Service aggregator (120 lines)
 *
 * Total: ~1439 lines across 7 focused modules
 * Original: 643 lines in 1 monolithic file
 *
 * Improvements:
 * - ✅ Fixed 10 ESLint violations
 * - ✅ Reduced complexity from 25 to ≤10
 * - ✅ Reduced max-depth from 6 to ≤3
 * - ✅ Batch database operations for performance
 * - ✅ Clear module boundaries for maintainability
 */

export {
  CalendarProviderIntegrationService,
  createCalendarProviderIntegrationService,
  type ProviderIntegrationConfig,
} from './calendar-provider-integration';
