/**
 * Migration Script - Main Orchestrator
 *
 * Coordinates the unified parser migration workflow by orchestrating
 * specialized operation modules.
 *
 * Refactored from: 559-line monolithic file into focused modules
 * New structure: ~120 lines orchestrator + 6 specialized modules
 *
 * @module parsers/migration
 */

import { logger } from '@/server/utils/logger';

import { CachedUnifiedParser } from '../CachedUnifiedParser';

import { analyzeParserUsage } from './analysis-operations';
import { backupExistingParsers } from './file-operations';
import { saveMigrationLog, type MigrationStats } from './logging-operations';
import {
  generateCompatibilityWrappers,
  migrateConfigurations,
  updateImports,
} from './migration-operations';
import { generateRecommendations, runValidationTests } from './validation-operations';

import type { MigrationConfig, MigrationResult } from './types';

// ============================================================================
// Migration Script Implementation
// ============================================================================

/**
 * Main migration orchestrator class
 *
 * Coordinates the migration process by delegating to specialized operation modules.
 * Maintains migration state (log, stats) and provides the high-level migration workflow.
 */
export class ParserMigrationScript {
  private config: MigrationConfig;
  private parser: CachedUnifiedParser;
  private log: string[] = [];
  private stats: MigrationStats = {
    filesProcessed: 0,
    filesMigrated: 0,
    filesSkipped: 0,
    errors: [],
  };

  constructor(config: MigrationConfig = {}) {
    this.config = {
      dryRun: false,
      verbose: false,
      backupDir: './backups/parser-migration',
      migrationLog: './migration-log.json',
      preserveOldCode: true,
      testMode: false,
      ...config,
    };

    this.parser = new CachedUnifiedParser();
  }

  /**
   * Run full migration workflow
   *
   * Orchestrates the migration process by delegating to specialized operation modules.
   * Each step is executed in sequence, with state maintained across operations.
   *
   * @returns Promise resolving to migration result with success status and recommendations
   */
  async migrate(): Promise<MigrationResult> {
    this.log.push(`Starting parser migration at ${new Date().toISOString()}`);
    this.log.push(`Configuration: ${JSON.stringify(this.config)}`);

    try {
      // Step 1: Backup existing parsers
      const backupLocation = await backupExistingParsers(this.config, this.log);

      // Step 2: Analyze existing parser usage
      const analysis = await analyzeParserUsage(this.log);

      // Step 3: Generate compatibility wrappers
      await generateCompatibilityWrappers(this.config, this.log, this.stats);

      // Step 4: Update imports in dependent files
      await updateImports(
        this.config,
        this.log,
        this.stats
      );

      // Step 5: Migrate parser configurations
      await migrateConfigurations(this.config, this.log);

      // Step 6: Run validation tests
      const testResults = runValidationTests(this.config, this.log);

      // Step 7: Generate migration recommendations
      const recommendations = generateRecommendations(analysis as unknown as Record<string, unknown>, testResults);

      // Save migration log
      await saveMigrationLog(this.config, this.stats, this.log);

      return {
        success: this.stats.errors.length === 0,
        filesProcessed: this.stats.filesProcessed,
        filesMigrated: this.stats.filesMigrated,
        filesSkipped: this.stats.filesSkipped,
        errors: this.stats.errors,
        backupLocation,
        recommendations,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.push(`Migration failed: ${errorMessage}`);
      throw error;
    }
  }
}

// ============================================================================
// Migration CLI
// ============================================================================

/**
 * CLI runner for parser migration
 *
 * Provides command-line interface for executing the migration process.
 * Outputs formatted results and recommendations.
 *
 * @param config - Optional migration configuration
 * @returns Promise that resolves when migration completes
 */
export async function runMigration(config?: MigrationConfig): Promise<void> {
  logger.info('🚀 Starting Unified Parser Migration...\n');

  const migration = new ParserMigrationScript(config);

  try {
    const result = await migration.migrate();

    logger.info('\n✨ Migration completed!\n');
    logger.info(`Files processed: ${result.filesProcessed}`);
    logger.info(`Files migrated: ${result.filesMigrated}`);
    logger.info(`Files skipped: ${result.filesSkipped}`);

    if (result.errors.length > 0) {
      logger.info('\n⚠️ Errors encountered:');
      result.errors.forEach(({ file, error }) => {
        logger.info(`  - ${file}: ${error}`);
      });
    }

    if (result.recommendations.length > 0) {
      logger.info('\n📋 Recommendations:');
      result.recommendations.forEach((rec) => {
        logger.info(`  • ${rec}`);
      });
    }

    logger.info(`\n📁 Backup saved to: ${result.backupLocation}`);
  } catch (error: unknown) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// ============================================================================
// Module Execution Check
// ============================================================================

// Run migration if executed directly
// eslint-disable-next-line no-undef
if (require.main === module) {
  const args = process.argv.slice(2);
  const config: MigrationConfig = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
    testMode: args.includes('--test'),
    preserveOldCode: !args.includes('--no-preserve'),
  };

  void runMigration(config);
}
