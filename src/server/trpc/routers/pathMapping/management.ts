/**
 * Path Mapping Management Router
 *
 * Provides CRUD operations for managing path mappings between remote
 * download client paths and local mount points.
 *
 * Procedures:
 * - getAll: Retrieve all mappings with accessibility status (query, public)
 * - add: Add new path mapping (mutation, protected)
 * - update: Update existing mapping (mutation, protected)
 * - remove: Remove mapping (mutation, protected)
 *
 * Features:
 * - Merges database and environment variable mappings
 * - Tests path accessibility for all mappings
 * - Allows duplicate paths (multiple download clients can share folders)
 * - Persists changes to database via Config table
 *
 * Extracted from: pathMapping.ts (lines 273-479)
 */

import { promises as fs } from 'fs';

import { TRPCError } from '@trpc/server';

import { getPathMapper, type PathMapping } from '@/server/services/download/pathMapper';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import {
  createSuccessResult,
  createErrorResult,
  createContextualError,
  type AsyncResult
} from '@/utils/async-result';
import { logger } from '@/utils/logger';


// Import from foundation utils
import {
  pathMappingSchema,
  updatePathMappingSchema,
  removePathMappingSchema,
  loadMappingsFromDatabase,
  saveMappingsToDatabase,
  validateMappingAccessibility,
} from './utils';

/**
 * Shape returned by `add` and `update` so the UI can surface a warning when
 * the saved mapping doesn't currently resolve to a readable path. The save
 * is NOT rejected — a Docker-target path may legitimately not yet exist on
 * the host editing the config.
 */
export interface MappingSaveResult {
  saved: true;
  accessible: boolean;
  reason?: string;
}

/**
 * Test if a path is accessible
 *
 * Attempts to read-access the specified path using Node.js fs.access.
 *
 * @param path - Path to test
 * @returns Object with accessible status and optional error message
 */
async function testPathAccessibility(path: string): Promise<{ accessible: boolean; error?: string }> {
  try {
    await fs.access(path, fs.constants.R_OK);
    return { accessible: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { accessible: false, error: errorMessage };
  }
}

/**
 * Path Mapping Management Router
 *
 * Handles CRUD operations for path mappings with database persistence.
 */
export const pathMappingManagementRouter = router({
  /**
   * Get all path mappings
   *
   * Returns mappings from both environment variables (read-only) and database (editable).
   * Environment mappings are marked with source: 'environment' and cannot be edited.
   *
   * @returns Array of path mappings with metadata
   */
  getAll: protectedProcedure
    .query(async (): Promise<AsyncResult<Array<PathMapping & { source: 'environment' | 'database'; index: number; accessible?: boolean }>, Error>> => {
      try {
        // Load database mappings first (always complete)
        const dbMappings = await loadMappingsFromDatabase();

        // Get PathMapper mappings (might not include DB yet due to async init race condition)
        const pathMapper = getPathMapper();
        const pathMapperMappings = pathMapper.getMappings();

        // Merge mappings: database mappings + environment-only mappings
        // This ensures DB mappings are always included, even if PathMapper hasn't loaded them yet
        const allMappingsWithSource: Array<PathMapping & { source: 'environment' | 'database' }> = [
          // Include all database mappings first
          ...dbMappings.map(mapping => ({
            ...mapping,
            source: 'database' as const
          })),
          // Include environment-only mappings (those not in database)
          ...pathMapperMappings
            .filter(pmMapping => {
              // Only include if NOT in database
              return !dbMappings.some(
                dbMapping =>
                  dbMapping.remotePath === pmMapping.remotePath &&
                  dbMapping.localPath === pmMapping.localPath
              );
            })
            .map(mapping => ({
              ...mapping,
              source: 'environment' as const
            }))
        ];

        // Add index and test accessibility for all mappings
        const mappingsWithMetadata = await Promise.all(
          allMappingsWithSource.map(async (mapping, index) => {
            // Test path accessibility
            const { accessible } = await testPathAccessibility(mapping.localPath);

            return {
              ...mapping,
              index,
              accessible
            };
          })
        );

        logger.info(`[PathMapping Router] Retrieved ${mappingsWithMetadata.length} path mappings (${dbMappings.length} from database, ${allMappingsWithSource.length - dbMappings.length} from environment)`);
        return createSuccessResult(mappingsWithMetadata);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[PathMapping Router] Failed to get path mappings: ${errorMessage}`);
        return createErrorResult(
          createContextualError(errorMessage, 'PATH_MAPPING_ERROR')
        );
      }
    }),

  /**
   * Add a new path mapping
   *
   * Adds a path mapping to the database and reloads the PathMapper service.
   *
   * @param mapping - The path mapping to add
   * @returns Success status
   */
  add: protectedProcedure
    .input(pathMappingSchema)
    .mutation(async ({ input }): Promise<AsyncResult<MappingSaveResult, Error>> => {
      try {
        // Load current mappings
        const mappings = await loadMappingsFromDatabase();

        // Allow duplicate paths - multiple download clients can share the same folder
        // Each mapping is distinguished by its description (e.g., "Transmission completed folder")

        // Add new mapping
        const newMapping: PathMapping = {
          remotePath: input.remotePath,
          localPath: input.localPath,
          description: input.description
        };

        mappings.push(newMapping);

        // Save to database
        await saveMappingsToDatabase(mappings);

        // Save-time accessibility probe — never rejects the save, just
        // reports whether the localPath currently resolves so the UI can
        // surface a yellow warning instead of silently accepting a
        // mapping that won't work at runtime.
        const probe = await validateMappingAccessibility(newMapping);
        const result: MappingSaveResult = { saved: true, accessible: probe.accessible };
        if (probe.reason !== undefined) result.reason = probe.reason;

        logger.info(
          `[PathMapping Router] Added path mapping: ${input.remotePath} -> ${input.localPath} (accessible: ${probe.accessible})`,
        );
        return createSuccessResult(result);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[PathMapping Router] Failed to add path mapping: ${errorMessage}`);
        return createErrorResult(
          createContextualError(errorMessage, 'PATH_MAPPING_ERROR')
        );
      }
    }),

  /**
   * Update an existing path mapping
   *
   * Updates a path mapping at the specified index.
   *
   * @param index - Index of the mapping to update
   * @param mapping - The updated mapping data
   * @returns Success status
   */
  update: protectedProcedure
    .input(updatePathMappingSchema)
    .mutation(async ({ input }): Promise<AsyncResult<MappingSaveResult, Error>> => {
      try {
        // Load current mappings
        const mappings = await loadMappingsFromDatabase();

        // Validate index
        if (input.index >= mappings.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid index: ${input.index}`
          });
        }

        // Allow duplicate paths - multiple download clients can share the same folder

        // Update mapping
        const updated: PathMapping = {
          remotePath: input.mapping.remotePath,
          localPath: input.mapping.localPath,
          description: input.mapping.description,
        };
        mappings[input.index] = updated;

        // Save to database
        await saveMappingsToDatabase(mappings);

        const probe = await validateMappingAccessibility(updated);
        const result: MappingSaveResult = { saved: true, accessible: probe.accessible };
        if (probe.reason !== undefined) result.reason = probe.reason;

        logger.info(
          `[PathMapping Router] Updated path mapping at index ${input.index} (accessible: ${probe.accessible})`,
        );
        return createSuccessResult(result);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[PathMapping Router] Failed to update path mapping: ${errorMessage}`);
        return createErrorResult(
          createContextualError(errorMessage, 'PATH_MAPPING_ERROR')
        );
      }
    }),

  /**
   * Remove a path mapping
   *
   * Removes a path mapping at the specified index.
   *
   * @param index - Index of the mapping to remove
   * @returns Success status
   */
  remove: protectedProcedure
    .input(removePathMappingSchema)
    .mutation(async ({ input }): Promise<AsyncResult<boolean, Error>> => {
      try {
        // Load current mappings
        const mappings = await loadMappingsFromDatabase();

        // Validate index
        if (input.index >= mappings.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Invalid index: ${input.index}`
          });
        }

        // Remove mapping
        const removed = mappings.splice(input.index, 1)[0];

        // Save to database
        await saveMappingsToDatabase(mappings);

        logger.info(`[PathMapping Router] Removed path mapping: ${removed?.remotePath} -> ${removed?.localPath}`);
        return createSuccessResult(true);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[PathMapping Router] Failed to remove path mapping: ${errorMessage}`);
        return createErrorResult(
          createContextualError(errorMessage, 'PATH_MAPPING_ERROR')
        );
      }
    }),
});
