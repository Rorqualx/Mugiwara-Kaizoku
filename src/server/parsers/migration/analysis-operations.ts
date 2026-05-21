/**
 * Analysis Operations Module
 *
 * Analyzes parser usage across the codebase.
 * Identifies files using old parsers and methods that need migration.
 *
 * Extracted from: MigrationScript.ts (lines 175-217, 443-462, 464-486)
 *
 * @module parsers/migration/analysis-operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { PARSER_MAPPINGS } from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Scan directory recursively and execute callback on each file
 *
 * @param dir - Directory to scan
 * @param callback - Function to execute on each file
 */
async function scanDirectory(
  dir: string,
  callback: (filePath: string) => Promise<void>
): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules'
      ) {
        // eslint-disable-next-line no-await-in-loop -- Sequential file system operations required for recursive directory scanning
        await scanDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        // eslint-disable-next-line no-await-in-loop -- Sequential file system operations required for file processing
        await callback(fullPath);
      }
    }
  } catch (_error: unknown) {
    // Directory might not exist
  }
}

// ============================================================================
// Analysis Operations
// ============================================================================

/**
 * Analysis result structure
 */
export interface ParserUsageAnalysis {
  /** Map of parser filenames to usage count */
  parsers: Map<string, number>;

  /** Map of method names to usage count */
  methods: Map<string, number>;

  /** List of files using old parsers */
  files: string[];
}

/**
 * Analyze existing parser usage across the codebase
 *
 * Scans source files for parser imports and method usage.
 * Returns detailed statistics about parser and method usage.
 *
 * Note: Uses await-in-loop for file reading - this is required
 * as each file must be read sequentially to count usage.
 *
 * @param log - Array to append log messages to
 * @returns Parser and method usage statistics
 */
export async function analyzeParserUsage(
  log: string[]
): Promise<ParserUsageAnalysis> {
  const parsers = new Map<string, number>();
  const methods = new Map<string, number>();
  const files: string[] = [];

  // Scan source files for parser imports and usage
  const srcDir = path.join(process.cwd(), 'src');
  await scanDirectory(srcDir, async (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for parser imports
      for (const [oldParser] of Object.entries(PARSER_MAPPINGS)) {
        if (content.includes(oldParser)) {
          parsers.set(oldParser, (parsers.get(oldParser) ?? 0) + 1);
          if (!files.includes(filePath)) {
            files.push(filePath);
          }
        }
      }

      // Check for method usage
      const methodRegex =
        /\b(parseFandomWiki|parseWikipedia|extractMangaData|getMetadata|parseVolumes|parseChapters)\b/g;
      let match;
      while ((match = methodRegex.exec(content)) !== null) {
        const methodName = match[1];
        if (methodName) {
          methods.set(methodName, (methods.get(methodName) ?? 0) + 1);
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.push(`Warning: Failed to read ${filePath}: ${errorMessage}`);
    }
  });

  log.push(`Found ${parsers.size} parsers used in ${files.length} files`);
  log.push(`Found ${methods.size} parser methods in use`);

  return { parsers, methods, files };
}

/**
 * Find all files that import old parser modules
 *
 * Scans the src directory for TypeScript files containing
 * imports from deprecated parser modules.
 *
 * @returns List of file paths with old imports
 */
export async function findFilesWithOldImports(): Promise<string[]> {
  const files: string[] = [];
  const srcDir = path.join(process.cwd(), 'src');

  await scanDirectory(srcDir, async (filePath) => {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (
        content.includes('fandomParser') ||
        content.includes('wikipediaParser') ||
        content.includes('mangadexParser')
      ) {
        files.push(filePath);
      }
    } catch (_error: unknown) {
      // Silently skip files that can't be read
    }
  });

  return files;
}
