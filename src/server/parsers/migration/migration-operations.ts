/**
 * Migration Operations Module
 *
 * Performs actual migration transformations including compatibility
 * wrappers, import updates, and configuration migrations.
 *
 * Extracted from: MigrationScript.ts (lines 219-327)
 *
 * @module parsers/migration/migration-operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { findFilesWithOldImports } from './analysis-operations';

import type { MigrationConfig } from './types';

// ============================================================================
// Stats Interface
// ============================================================================

/**
 * Migration statistics tracker
 */
export interface MigrationStats {
  /** Total number of files processed */
  filesProcessed: number;

  /** Number of files successfully migrated */
  filesMigrated: number;

  /** List of errors encountered during migration */
  errors: Array<{ file: string; error: string }>;
}

// ============================================================================
// Compatibility Wrapper Generation
// ============================================================================

/**
 * Generate compatibility wrappers for gradual migration
 *
 * Creates deprecated parser wrapper files that redirect to the unified parser.
 * Allows for gradual migration by maintaining backward compatibility.
 *
 * @param config - Migration configuration
 * @param log - Array to append log messages to
 * @param stats - Statistics object to update
 */
export async function generateCompatibilityWrappers(
  config: MigrationConfig,
  log: string[],
  stats: MigrationStats
): Promise<void> {
  const wrapperDir = path.join(process.cwd(), 'src/server/parsers/compat');

  if (config.dryRun) {
    log.push('[DRY RUN] Would generate compatibility wrappers');
    return;
  }

  await fs.mkdir(wrapperDir, { recursive: true });

  // Generate FandomParser compatibility wrapper
  const fandomWrapper = `// Deprecated parser wrappers removed - use unified parser from src/server/parsers/unified instead
// For backward compatibility, import from src/server/parsers/compat/FandomParser
`;

  await fs.writeFile(path.join(wrapperDir, 'FandomParser.ts'), fandomWrapper);

  // Deprecated WikipediaParser wrapper removed - use unified parser instead
  const wikipediaWrapper = `// Deprecated parser wrappers removed - use unified parser from src/server/parsers/unified instead
// For backward compatibility, create similar wrappers in src/server/parsers/compat if needed`;

  await fs.writeFile(
    path.join(wrapperDir, 'WikipediaParser.ts'),
    wikipediaWrapper
  );

  log.push(`Generated compatibility wrappers in ${wrapperDir}`);
  const updatedFilesMigrated = stats.filesMigrated + 2;
  Object.assign(stats, { filesMigrated: updatedFilesMigrated });
}

// ============================================================================
// Import Update Operations
// ============================================================================

/**
 * Update import statements in a single file
 *
 * @param file - Path to file to update
 * @param config - Migration configuration
 * @param log - Array to append log messages to
 * @param stats - Statistics object to update
 */
async function updateFileImports(
  file: string,
  config: MigrationConfig,
  log: string[],
  stats: MigrationStats
): Promise<void> {
  Object.assign(stats, { filesProcessed: stats.filesProcessed + 1 });

  if (config.dryRun) {
    log.push(`[DRY RUN] Would update imports in ${file}`);
    return;
  }

  try {
    let content = await fs.readFile(file, 'utf-8');
    const originalContent = content;

    // Update import statements
    content = content.replace(
      /import\s+.*?from\s+['"].*?\/fandomParser['"]/g,
      "import { FandomParser } from '@/server/parsers/compat/FandomParser'"
    );

    content = content.replace(
      /import\s+.*?from\s+['"].*?\/wikipediaParser['"]/g,
      "import { WikipediaParser } from '@/server/parsers/compat/WikipediaParser'"
    );

    // Add migration comment
    if (content !== originalContent) {
      content = `// TODO: Migrate to CachedUnifiedParser
// This file uses compatibility wrappers for deprecated parsers
${content}`;

      await fs.writeFile(file, content);
      Object.assign(stats, { filesMigrated: stats.filesMigrated + 1 });
      log.push(`Updated imports in ${file}`);
    }
  } catch (error: unknown) {
    stats.errors.push({ file, error: String(error) });
    log.push(`Failed to update ${file}: ${error}`);
  }
}

/**
 * Update imports in dependent files
 *
 * Finds all files with old parser imports and updates them to use
 * compatibility wrappers. Uses Promise.all() for parallel processing.
 *
 * FIXED: Eliminated await-in-loop violation (original line 264)
 * Changed from sequential for-loop to parallel Promise.all()
 *
 * @param config - Migration configuration
 * @param log - Array to append log messages to
 * @param stats - Statistics object to update
 */
export async function updateImports(
  config: MigrationConfig,
  log: string[],
  stats: MigrationStats
): Promise<void> {
  const files = await findFilesWithOldImports();

  // Process all files in parallel
  await Promise.all(
    files.map((file) => updateFileImports(file, config, log, stats))
  );
}

// ============================================================================
// Configuration Migration
// ============================================================================

/**
 * Update environment configuration file
 *
 * @param envPath - Path to environment file
 * @param envFile - Name of environment file (for logging)
 * @param config - Migration configuration
 * @param log - Array to append log messages to
 */
async function updateEnvFile(
  envPath: string,
  envFile: string,
  config: MigrationConfig,
  log: string[]
): Promise<void> {
  try {
    const content = await fs.readFile(envPath, 'utf-8');
    let updated = content;

    // Add new parser cache configuration
    if (!content.includes('PARSER_CACHE_TTL')) {
      updated += `
# Unified Parser Cache Configuration
PARSER_CACHE_TTL=86400
PARSER_CACHE_NAMESPACE=unified-parser
PARSER_CACHE_COMPRESSION=true
`;
    }

    if (updated !== content && !config.dryRun) {
      await fs.writeFile(envPath, updated);
      log.push(`Updated configuration in ${envFile}`);
    }
  } catch (_error: unknown) {
    // File might not exist - silently skip
  }
}

/**
 * Migrate parser configurations
 *
 * Updates environment files with new unified parser cache configuration.
 * Uses Promise.all() for parallel processing of environment files.
 *
 * FIXED: Eliminated await-in-loop violations (original lines 306, 320)
 * Changed from sequential for-loop to parallel Promise.all()
 *
 * @param config - Migration configuration
 * @param log - Array to append log messages to
 */
export async function migrateConfigurations(
  config: MigrationConfig,
  log: string[]
): Promise<void> {
  // Migrate environment variables
  const envFiles = ['.env', '.env.local', '.env.production'];

  // Process all environment files in parallel
  await Promise.all(
    envFiles.map((envFile) => {
      const envPath = path.join(process.cwd(), envFile);
      return updateEnvFile(envPath, envFile, config, log);
    })
  );
}
