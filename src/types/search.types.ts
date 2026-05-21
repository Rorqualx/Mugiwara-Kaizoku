/**
 * Search Types - Main Aggregator
 *
 * This file aggregates all search-related types from focused modules.
 * All types are re-exported at the top level for backward compatibility.
 *
 * Architecture:
 * - search-types/enums.types.ts - Enums, error classes, re-exports (157 lines, 36 exports)
 * - search-types/core-search.types.ts - Core search results (245 lines, 8 exports)
 * - search-types/provider.types.ts - Provider types (251 lines, 13 exports)
 * - search-types/configuration.types.ts - Config types (263 lines, 17 exports)
 * - search-types/calendar-release.types.ts - Calendar & release (139 lines, 13 exports)
 * - search-types/download-task.types.ts - Download & task (55 lines, 6 exports)
 * - search-types/wanted-missing.types.ts - Wanted & missing (114 lines, 6 exports)
 * - search-types/metadata.types.ts - Metadata types (316 lines, 28 exports)
 *
 * Total: 127+ types across 8 focused modules
 * Original: 1,246 lines → Refactored: ~40 lines aggregator (96% reduction)
 *
 * Benefits:
 * - Maintainability: Each module < 500 lines (ESLint compliant)
 * - Organization: Logical grouping by domain
 * - Type Safety: Shared enums prevent duplication
 * - Backward Compatible: All exports available at top level
 * - Performance: Identical runtime behavior
 * - Testability: Modules can be tested independently
 */

// ============================================================================
// Re-export All Types from Modules
// ============================================================================

// Foundation: Enums, error classes, basic types
export * from './search-types/enums.types';

// Core: Search results and metadata
export * from './search-types/core-search.types';

// Provider: Provider-specific types and responses
export * from './search-types/provider.types';

// Configuration: All configuration types
export * from './search-types/configuration.types';

// Calendar: Calendar events and release schedules
export * from './search-types/calendar-release.types';

// Download: Download and task management
export * from './search-types/download-task.types';

// Wanted: Wanted and missing chapter tracking
export * from './search-types/wanted-missing.types';

// Metadata: Unified metadata and validation
export * from './search-types/metadata.types';
