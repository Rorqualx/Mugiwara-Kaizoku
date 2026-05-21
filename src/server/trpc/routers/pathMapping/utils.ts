/**
 * Path Mapping Utilities Module
 *
 * Shared schemas, type definitions, type guards, and database operations
 * used across all pathMapping modules.
 *
 * Extracted from: pathMapping.ts (lines 14-149)
 *
 * Exports:
 * - 5 Zod schemas (validation)
 * - 1 interface (DirectoryEntry)
 * - 2 type guards (isPathMapping, isPathMappingArray)
 * - 2 database operations (load, save)
 */

import { promises as fs, constants as fsConstants } from 'fs';

import { z } from 'zod';

import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { getPathMapper, type PathMapping } from '@/server/services/download/pathMapper';
import { logger } from '@/utils/logger';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Path mapping schema for validation
 */
export const pathMappingSchema = z.object({
  remotePath: z.string().min(1, 'Remote path is required'),
  localPath: z.string().min(1, 'Local path is required'),
  description: z.string().optional()
});

/**
 * Schema for updating a path mapping by index
 */
export const updatePathMappingSchema = z.object({
  index: z.number().int().min(0, 'Index must be non-negative'),
  mapping: pathMappingSchema
});

/**
 * Schema for removing a path mapping by index
 */
export const removePathMappingSchema = z.object({
  index: z.number().int().min(0, 'Index must be non-negative')
});

/**
 * Schema for testing path accessibility
 */
export const testPathSchema = z.object({
  path: z.string().min(1, 'Path is required')
});

/**
 * Schema for browsing filesystem
 */
export const browsePathSchema = z.object({
  path: z.string().optional()
});

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Interface for directory entry
 */
export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isAccessible: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to validate PathMapping structure
 */
export function isPathMapping(value: unknown): value is PathMapping {
  return (
    typeof value === 'object' &&
    value !== null &&
    'remotePath' in value &&
    'localPath' in value &&
    typeof (value as Record<string, unknown>)['remotePath'] === 'string' &&
    typeof (value as Record<string, unknown>)['localPath'] === 'string'
  );
}

/**
 * Type guard to validate PathMapping array
 */
export function isPathMappingArray(value: unknown): value is PathMapping[] {
  return Array.isArray(value) && value.every(isPathMapping);
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Load path mappings from database
 */
export async function loadMappingsFromDatabase(): Promise<PathMapping[]> {
  try {
    const configService = getGlobalConfigService();
    const mappingsJson = await configService.get<string>('path_mappings', '[]');

    // Parse JSON if it's a string
    let parsedData: unknown;
    if (typeof mappingsJson === 'string') {
      parsedData = JSON.parse(mappingsJson) as unknown;
    } else {
      parsedData = mappingsJson;
    }

    // Validate structure
    if (!isPathMappingArray(parsedData)) {
      logger.warn('[PathMapping Utils] Invalid mappings format in database, returning empty array');
      return [];
    }

    return parsedData;
  } catch (error) {
    logger.error('[PathMapping Utils] Failed to load mappings from database:', error);
    return [];
  }
}

/**
 * Probe a mapping's `localPath` to surface whether it currently resolves to
 * a readable filesystem entry. Used by the `add` and `update` mutations to
 * tell the caller (the settings UI) when a saved mapping won't actually
 * resolve at runtime, without rejecting the save — a Docker-target path may
 * legitimately not yet exist on the host that's editing the config.
 */
export async function validateMappingAccessibility(
  mapping: PathMapping,
): Promise<{ accessible: boolean; reason?: string }> {
  try {
    await fs.access(mapping.localPath, fsConstants.R_OK);
    return { accessible: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { accessible: false, reason };
  }
}

/**
 * Save path mappings to database
 */
export async function saveMappingsToDatabase(mappings: PathMapping[]): Promise<void> {
  const configService = getGlobalConfigService();
  await configService.set('path_mappings', JSON.stringify(mappings));

  // Reload PathMapper to apply changes
  const pathMapper = getPathMapper();
  pathMapper.clearMappings();
  pathMapper.loadFromEnvironment();

  // Load from database
  for (const mapping of mappings) {
    pathMapper.addMapping(mapping);
  }
}
