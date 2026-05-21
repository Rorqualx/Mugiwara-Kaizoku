/**
 * Path Mapping Router - Main Aggregator
 *
 * Manages path mappings for network storage configurations.
 * Provides CRUD operations and filesystem browsing capabilities.
 *
 * This router aggregates all path mapping sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - pathMapping/utils.ts - Foundation utilities (0 procedures)
 *   - 5 Zod schemas (validation)
 *   - 1 interface (DirectoryEntry)
 *   - 2 type guards (isPathMapping, isPathMappingArray)
 *   - 2 database operations (load, save)
 *
 * - pathMapping/management.ts - CRUD operations (4 procedures)
 *   - getAll: Retrieve all mappings with accessibility metadata
 *   - add: Add new path mapping (protected)
 *   - update: Update existing mapping (protected)
 *   - remove: Remove mapping (protected)
 *
 * - pathMapping/accessibility.ts - Path testing & browsing (2 procedures)
 *   - testPath: Test if path is accessible
 *   - browse: Browse filesystem with path mapping support
 *
 * Total: 6 procedures across 2 routers
 *
 * Original file: 546 lines → Refactored: ~100 lines (81% reduction)
 *
 * Fixes:
 * - TypeScript errors (2): Property access from index signature (fixed in utils.ts)
 * - ESLint violation (1): File exceeds 500 lines (all modules now under limit)
 */

import { router } from '../trpc';

// Import all sub-routers
import { pathMappingAccessibilityRouter } from './pathMapping/accessibility';
import { pathMappingDiagnosticsRouter } from './pathMapping/diagnostics';
import { pathMappingManagementRouter } from './pathMapping/management';

/**
 * Main path mapping router
 *
 * Merges all sub-routers to expose all 6 procedures at the top level.
 * Maintains backward compatibility with existing API consumers.
 *
 * Procedures by Category:
 *
 * CRUD Operations (4 procedures from management.ts):
 * - getAll: Retrieve all path mappings with accessibility status
 *   - Type: query (public)
 *   - Returns: Array of mappings with source, index, and accessible flags
 *   - Features: Merges database + environment mappings, tests accessibility
 *
 * - add: Add new path mapping
 *   - Type: mutation (protected)
 *   - Returns: Success boolean
 *   - Features: Allows duplicates (multiple download clients), database persistence
 *
 * - update: Update existing mapping by index
 *   - Type: mutation (protected)
 *   - Returns: Success boolean
 *   - Features: Index validation, allows duplicates
 *
 * - remove: Remove mapping by index
 *   - Type: mutation (protected)
 *   - Returns: Success boolean
 *   - Features: Index validation, safe removal
 *
 * Path Accessibility (2 procedures from accessibility.ts):
 * - testPath: Test if path is accessible from server
 *   - Type: query (public)
 *   - Returns: Accessibility status with optional error message
 *   - Features: File system read validation
 *
 * - browse: Browse filesystem with directory listing
 *   - Type: query (uncached public)
 *   - Returns: Directory entries with accessibility status
 *   - Features: Path mapping resolution, common mount points, hidden file filtering
 */
export const pathMappingRouter = router({
  // Merge all sub-routers using tRPC's procedure spreading
  ...pathMappingManagementRouter._def.procedures,
  ...pathMappingAccessibilityRouter._def.procedures,
  ...pathMappingDiagnosticsRouter._def.procedures,
});
