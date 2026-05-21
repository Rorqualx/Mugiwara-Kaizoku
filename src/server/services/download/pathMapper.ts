/**
 * Path Mapper - Maps remote/download client paths to local mount points
 *
 * This utility helps translate paths reported by remote download clients
 * to locally accessible mount points.
 *
 * Example:
 *   Download client reports: /data/downloads/manga.cbz
 *   Local mount point: /mnt/nas-downloads
 *   Mapped path: /mnt/nas-downloads/manga.cbz
 */

import { promises as fs, constants as fsConstants } from 'fs';

import { z } from 'zod';

import { logger } from '@/utils/logger';

export interface PathMapping {
  /** Remote path as reported by download client */
  remotePath: string;
  /** Local mount point where the remote path is accessible */
  localPath: string;
  /** Optional description for this mapping */
  description?: string | undefined;
}

// Zod schema for validating path mappings
const PathMappingSchema = z.object({
  remotePath: z.string(),
  localPath: z.string(),
  description: z.string().optional()
});

const PathMappingsArraySchema = z.array(PathMappingSchema);

/**
 * Result returned by {@link PathMapper.mapAndProbe}. The `accessible` field
 * tells the caller whether the mapped path actually answered an `R_OK` probe
 * within the cache TTL; consumers that previously trusted `mapPath()` and then
 * called `fs.readdir()` blind should switch to this helper so failure modes
 * become loud instead of silent zero-result imports.
 */
export interface MapAndProbeResult {
  /** The mapped local path (or the original path when no mapping matched). */
  localPath: string;
  /** True if `fs.access(localPath, R_OK)` succeeded within the TTL window. */
  accessible: boolean;
  /** Which mapping rule the resolver picked (undefined when no rule matched). */
  mappingUsed?: PathMapping;
  /** Human-readable failure reason when `accessible` is false. */
  error?: string;
}

/** Module-level access-probe cache. Mirrors the 60s window used elsewhere
 *  (e.g. `isSuwayomiReachable`) so a burst of consumers doesn't fan out into
 *  many filesystem stat calls on slow SMB mounts. */
const ACCESS_PROBE_TTL_MS = 60_000;
interface AccessProbeCacheEntry {
  accessible: boolean;
  error?: string;
  expiresAt: number;
}
const accessProbeCache = new Map<string, AccessProbeCacheEntry>();

/** Force the next mapAndProbe call to re-probe a given local path. Exposed
 *  for tests and for manual recovery flows (e.g. after the user has fixed a
 *  mapping or remounted a share). */
export function invalidatePathAccessProbeCache(localPath?: string): void {
  if (localPath === undefined) {
    accessProbeCache.clear();
    return;
  }
  accessProbeCache.delete(localPath);
}

export class PathMapper {
  private mappings: PathMapping[] = [];

  /**
   * Add a path mapping
   *
   * @param mapping - Path mapping configuration
   */
  addMapping(mapping: PathMapping): void {
    // Normalize paths (remove trailing slashes)
    const normalized: PathMapping = {
      remotePath: mapping.remotePath.replace(/\/$/, ''),
      localPath: mapping.localPath.replace(/\/$/, ''),
      description: mapping.description
    };

    // Check for duplicate
    const existing = this.mappings.find(m => m.remotePath === normalized.remotePath);
    if (existing) {
      logger.warn(`[PathMapper] Replacing existing mapping for ${normalized.remotePath}`);
      this.mappings = this.mappings.filter(m => m.remotePath !== normalized.remotePath);
    }

    this.mappings.push(normalized);
    logger.info(`[PathMapper] Added mapping: ${normalized.remotePath} -> ${normalized.localPath}`);
  }

  /**
   * Remove a path mapping
   *
   * @param remotePath - Remote path to remove mapping for
   */
  removeMapping(remotePath: string): void {
    const normalized = remotePath.replace(/\/$/, '');
    this.mappings = this.mappings.filter(m => m.remotePath !== normalized);
    logger.info(`[PathMapper] Removed mapping for ${normalized}`);
  }

  /**
   * Clear all path mappings
   */
  clearMappings(): void {
    this.mappings = [];
    logger.info('[PathMapper] Cleared all path mappings');
  }

  /**
   * Map a remote path to a local path
   *
   * Tries to find a matching path mapping and translates the path.
   * If no mapping matches, returns the original path.
   *
   * @param remotePath - Path to map
   * @returns Mapped local path, or original path if no mapping found
   */
  mapPath(remotePath: string): string {
    // Try each mapping, starting with most specific (longest) paths first
    const sortedMappings = [...this.mappings].sort((a, b) =>
      b.remotePath.length - a.remotePath.length
    );

    for (const mapping of sortedMappings) {
      // Check if remote path starts with the mapping's remote path
      if (remotePath.startsWith(mapping.remotePath)) {
        // Extract the relative portion
        const relativePath = remotePath.substring(mapping.remotePath.length);

        // Build local path
        const localPath = mapping.localPath + relativePath;

        logger.debug(`[PathMapper] Mapped ${remotePath} -> ${localPath}`);
        return localPath;
      }
    }

    // No mapping found, return original path
    logger.debug(`[PathMapper] No mapping found for ${remotePath}, using original path`);
    return remotePath;
  }

  /**
   * Get all configured mappings
   *
   * @returns Array of path mappings
   */
  getMappings(): PathMapping[] {
    return [...this.mappings];
  }

  /**
   * Internal: which mapping rule matches `remotePath`, if any. Returns
   * undefined when the remote path doesn't start with any configured rule
   * (in which case `mapPath` returns the input unchanged). Kept private to
   * the class; consumers use {@link mapAndProbe} which already surfaces it.
   */
  private findMatchingMapping(remotePath: string): PathMapping | undefined {
    const sorted = [...this.mappings].sort((a, b) => b.remotePath.length - a.remotePath.length);
    return sorted.find(m => remotePath.startsWith(m.remotePath));
  }

  /**
   * Map a remote path AND probe the resulting local path for accessibility.
   * Consumers should prefer this over `mapPath()` when they are about to
   * read or stat the resulting path — it short-circuits cleanly when the
   * SMB/NFS/host volume that the mapping points at isn't actually reachable.
   *
   * Access results are cached for {@link ACCESS_PROBE_TTL_MS} per local path
   * so a burst of consumers (e.g. many torrents finishing at once) doesn't
   * fan out into many filesystem stats on a slow network mount.
   */
  async mapAndProbe(remotePath: string): Promise<MapAndProbeResult> {
    const localPath = this.mapPath(remotePath);
    const mappingUsed = this.findMatchingMapping(remotePath);
    const result: MapAndProbeResult = { localPath, accessible: false };
    if (mappingUsed) result.mappingUsed = mappingUsed;

    const now = Date.now();
    const cached = accessProbeCache.get(localPath);
    if (cached && cached.expiresAt > now) {
      result.accessible = cached.accessible;
      if (cached.error !== undefined) result.error = cached.error;
      return result;
    }

    try {
      await fs.access(localPath, fsConstants.R_OK);
      accessProbeCache.set(localPath, { accessible: true, expiresAt: now + ACCESS_PROBE_TTL_MS });
      result.accessible = true;
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      accessProbeCache.set(localPath, {
        accessible: false,
        error: errorMessage,
        expiresAt: now + ACCESS_PROBE_TTL_MS,
      });
      result.error = errorMessage;
      return result;
    }
  }

  /**
   * Load mappings from environment or configuration
   *
   * Supports two environment variables:
   * - DOWNLOAD_FOLDER: Simple download folder path (added as identity mapping)
   * - PATH_MAPPINGS: Complex mappings in format /remote/path1:/local/path1,/remote/path2:/local/path2
   */
  loadFromEnvironment(): void {
    // Load simple DOWNLOAD_FOLDER first
    const downloadFolder = process.env['DOWNLOAD_FOLDER'];
    if (downloadFolder) {
      // Add identity mapping so the download folder is recognized as a valid local path
      this.addMapping({
        remotePath: downloadFolder,
        localPath: downloadFolder,
        description: 'Download folder from DOWNLOAD_FOLDER environment variable'
      });
      logger.info(`[PathMapper] Added download folder from environment: ${downloadFolder}`);
    }

    // Load complex PATH_MAPPINGS
    const mappingsEnv = process.env['PATH_MAPPINGS'];
    if (!mappingsEnv) {
      if (!downloadFolder) {
        logger.debug('[PathMapper] No PATH_MAPPINGS or DOWNLOAD_FOLDER environment variables found');
      }
      return;
    }

    try {
      const pairs = mappingsEnv.split(',');
      for (const pair of pairs) {
        const [remotePath, localPath] = pair.split(':');
        if (remotePath && localPath) {
          this.addMapping({ remotePath, localPath, description: 'From PATH_MAPPINGS environment' });
        } else {
          logger.warn(`[PathMapper] Invalid mapping format: ${pair}`);
        }
      }
      logger.info(`[PathMapper] Loaded ${this.mappings.length} total mappings from environment`);
    } catch (error) {
      logger.error('[PathMapper] Failed to load path mappings from environment:', error);
    }
  }

  /**
   * Get the download folder from environment if set
   *
   * @returns Download folder path or undefined
   */
  getDownloadFolderFromEnv(): string | undefined {
    return process.env['DOWNLOAD_FOLDER'];
  }

  /**
   * Load mappings from database
   *
   * Loads path mappings from the Config table. This method is async and should
   * be called after environment mappings are loaded (database takes precedence).
   */
  async loadFromDatabase(): Promise<void> {
    try {
      // Dynamically import to avoid circular dependency
      const { getGlobalConfigService } = await import('../config/globalConfigService');
      const configService = getGlobalConfigService();

      const mappingsJson = await configService.get<string>('path_mappings', '[]');

      // Parse and validate JSON if it's a string
      let mappings: PathMapping[];
      if (typeof mappingsJson === 'string') {
        try {
          const parsed: unknown = JSON.parse(mappingsJson);
          const result = PathMappingsArraySchema.safeParse(parsed);

          if (!result.success) {
            logger.error('[PathMapper] Invalid path mappings format in database:', result.error);
            return;
          }

          mappings = result.data;
        } catch (parseError) {
          logger.error('[PathMapper] Failed to parse path mappings JSON from database:', parseError);
          return;
        }
      } else {
        // Validate the object format
        const result = PathMappingsArraySchema.safeParse(mappingsJson);
        if (!result.success) {
          logger.error('[PathMapper] Invalid path mappings format in database:', result.error);
          return;
        }
        mappings = result.data;
      }

      // Add each mapping
      for (const mapping of mappings) {
        if (mapping.remotePath && mapping.localPath) {
          this.addMapping(mapping);
        } else {
          logger.warn('[PathMapper] Skipping invalid mapping from database:', mapping);
        }
      }

      logger.info(`[PathMapper] Loaded ${mappings.length} mappings from database`);
    } catch (error) {
      logger.error('[PathMapper] Failed to load path mappings from database:', error);
    }
  }

  /**
   * Save mappings to a serializable format
   *
   * @returns JSON string of mappings
   */
  serialize(): string {
    return JSON.stringify(this.mappings, null, 2);
  }

  /**
   * Load mappings from a serialized format
   *
   * @param json - JSON string of mappings
   */
  deserialize(json: string): void {
    try {
      const parsed: unknown = JSON.parse(json);
      const result = PathMappingsArraySchema.safeParse(parsed);

      if (!result.success) {
        logger.error('[PathMapper] Invalid path mappings format:', result.error);
        throw new Error('Invalid path mappings JSON format');
      }

      const mappings = result.data;
      this.clearMappings();
      for (const mapping of mappings) {
        this.addMapping(mapping);
      }
      logger.info(`[PathMapper] Loaded ${this.mappings.length} mappings from JSON`);
    } catch (error) {
      logger.error('[PathMapper] Failed to deserialize path mappings:', error);
      throw new Error('Invalid path mappings JSON format');
    }
  }
}

// Singleton instance
let pathMapperInstance: PathMapper | null = null;
let pathMapperInitialized = false;

/**
 * Get the global path mapper instance
 *
 * @returns PathMapper singleton
 */
export function getPathMapper(): PathMapper {
  if (!pathMapperInstance) {
    pathMapperInstance = new PathMapper();
    // Auto-load from environment (synchronous)
    pathMapperInstance.loadFromEnvironment();

    // Load from database asynchronously (only once)
    if (!pathMapperInitialized) {
      pathMapperInitialized = true;
      pathMapperInstance.loadFromDatabase().catch(error => {
        logger.error('[PathMapper] Failed to load mappings from database on initialization:', error);
      });
    }
  }
  return pathMapperInstance;
}

/**
 * Reset the path mapper instance (mainly for testing)
 */
export function resetPathMapper(): void {
  pathMapperInstance = null;
  pathMapperInitialized = false;
}
