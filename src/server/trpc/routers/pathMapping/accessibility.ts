/**
 * Path Mapping Accessibility Router
 *
 * Provides path accessibility testing and filesystem browsing
 * capabilities with path mapping resolution support.
 *
 * Procedures:
 * - testPath: Test if a path is accessible from the server
 * - browse: Browse filesystem with directory listing
 *
 * Features:
 * - Path accessibility validation
 * - Path mapping resolution (remote → local)
 * - Directory browsing with permissions check
 * - Common mount points discovery
 * - Hidden file filtering
 *
 * Extracted from: pathMapping.ts (lines 152-266, 489-544)
 */

import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

import { TRPCError } from '@trpc/server';

import { getPathMapper } from '@/server/services/download/pathMapper';
import { toTRPCError } from '@/server/trpc/errors';
import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { createContextualError } from '@/utils/async-result';
import { logger } from '@/utils/logger';


// Import from foundation utils
import {
  testPathSchema,
  browsePathSchema,
  type DirectoryEntry,
} from './utils';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Test if a path is accessible
 */
async function testPathAccessibility(pathToTest: string): Promise<{ accessible: boolean; error?: string }> {
  try {
    await fs.access(pathToTest, fs.constants.R_OK);
    return { accessible: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { accessible: false, error: errorMessage };
  }
}

/**
 * Get common starting points for browsing when no path is provided
 */
async function getBrowseStartingPoints(): Promise<DirectoryEntry[]> {
  const homeDir = os.homedir();
  const commonPaths = [
    { name: 'Home Directory', path: homeDir },
    { name: 'Root', path: '/' },
    { name: 'Volumes (macOS)', path: '/Volumes' },
    { name: 'Mounts', path: '/mnt' },
    { name: 'Media', path: '/media' }
  ];

  const entryPromises = commonPaths.map(async (commonPath) => {
    try {
      await fs.access(commonPath.path, fs.constants.R_OK);
      const stats = await fs.stat(commonPath.path);
      return {
        name: commonPath.name,
        path: commonPath.path,
        isDirectory: stats.isDirectory(),
        isAccessible: true
      };
    } catch {
      // Skip inaccessible paths
      return null;
    }
  });

  const results = await Promise.all(entryPromises);
  return results.filter((entry): entry is DirectoryEntry => entry !== null);
}

/**
 * Process and read directory at the specified path
 */
async function processBrowsePath(inputPath: string): Promise<{
  currentPath: string;
  parent: string | null;
  entries: DirectoryEntry[];
}> {
  // Apply path mapping for remote/download client paths
  const pathMapper = getPathMapper();
  const mappedPath = pathMapper.mapPath(inputPath);

  if (mappedPath !== inputPath) {
    logger.info(`[PathMapping Accessibility] Browse path mapped: ${inputPath} -> ${mappedPath}`);
  }

  // Resolve the path
  const currentPath = path.resolve(mappedPath);

  // Check if path exists and is accessible. Server-side log keeps the resolved
  // path for diagnosis; the error returned to the client is intentionally generic
  // so that an admin probing this endpoint cannot easily enumerate the filesystem.
  try {
    await fs.access(currentPath, fs.constants.R_OK);
  } catch {
    logger.warn(`[PathMapping Accessibility] Browse access denied: ${currentPath}${mappedPath !== inputPath ? ` (mapped from ${inputPath})` : ''}`);
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Path not accessible',
    });
  }

  // Get parent directory
  const parent = currentPath === '/' ? null : path.dirname(currentPath);

  // Read directory contents
  const dirEntries = await fs.readdir(currentPath, { withFileTypes: true });

  // Process entries in parallel
  const entryPromises = dirEntries
    .filter((entry) => !entry.name.startsWith('.')) // Skip hidden files
    .map(async (entry) => {
      const entryPath = path.join(currentPath, entry.name);
      // Dirent d_type is often DT_UNKNOWN on NFS/SMB/FUSE, which makes
      // entry.isDirectory() return false for real directories. Defer to stat()
      // (which follows symlinks-to-directories the way users expect when
      // browsing) and only fall back to the dirent flag if stat fails.
      let isDirectory = entry.isDirectory();
      let isAccessible = false;
      try {
        const stats = await fs.stat(entryPath);
        isDirectory = stats.isDirectory();
        await fs.access(entryPath, fs.constants.R_OK);
        isAccessible = true;
      } catch {
        // Entry stays at dirent-reported isDirectory and is marked inaccessible.
      }

      return {
        name: entry.name,
        path: entryPath,
        isDirectory,
        isAccessible
      };
    });

  const entries = await Promise.all(entryPromises);

  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  logger.info(`[PathMapping Accessibility] Browsed directory: ${currentPath} (${entries.length} entries)`);

  return { currentPath, parent, entries };
}

// ============================================================================
// Router
// ============================================================================

export const pathMappingAccessibilityRouter = router({
  /**
   * Test path accessibility
   *
   * Checks if a given path is accessible from the server by attempting to read it.
   * Returns accessibility status and error message if not accessible.
   *
   * @param path - The path to test
   * @returns Accessibility status and error message if not accessible
   */
  testPath: adminProcedure
    .input(testPathSchema)
    .query(async ({ input }): Promise<{ accessible: boolean; error?: string }> => {
      try {
        const result = await testPathAccessibility(input.path);
        logger.info(`[PathMapping Accessibility] Path accessibility test for ${input.path}: ${result.accessible}`);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[PathMapping Accessibility] Failed to test path: ${errorMessage}`);
        throw toTRPCError(
          createContextualError(errorMessage, 'PATH_MAPPING_ERROR')
        );
      }
    }),

  /**
   * Browse filesystem
   *
   * Lists directories and files at the specified path. If no path is provided,
   * returns common starting points (home directory, root, common mount points).
   *
   * Note: gated to adminProcedure — recursive directory listings are filesystem
   * inspection and should only be exposed to administrators configuring path mappings.
   *
   * @param path - The path to browse (optional)
   * @returns List of directory entries with accessibility status
   */
  browse: adminProcedure
    .input(browsePathSchema)
    .query(async ({ input }): Promise<{ currentPath: string; parent: string | null; entries: DirectoryEntry[] }> => {
      try {
        // If no path provided, return common starting points
        if (!input.path) {
          const entries = await getBrowseStartingPoints();
          return {
            currentPath: '',
            parent: null,
            entries
          };
        }

        // Process and read the specified path
        return await processBrowsePath(input.path);
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[PathMapping Accessibility] Failed to browse path: ${errorMessage}`);
        throw toTRPCError(
          createContextualError(errorMessage, 'PATH_MAPPING_ERROR')
        );
      }
    })
});
