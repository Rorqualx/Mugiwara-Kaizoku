/**
 * Validation Operations Module
 *
 * Validates migration results and generates recommendations.
 * Tests compatibility wrappers and analyzes migration quality.
 *
 * Extracted from: MigrationScript.ts (lines 329-419)
 *
 * @module parsers/migration/validation-operations
 */

import type { MigrationConfig } from './types';

// ============================================================================
// Validation Test Results
// ============================================================================

/**
 * Result structure for validation tests
 */
export interface ValidationTestResults {
  /** Number of tests that passed */
  passed: number;

  /** Number of tests that failed */
  failed: number;

  /** Number of tests that were skipped */
  skipped: number;
}

// ============================================================================
// Validation Operations
// ============================================================================

/**
 * Run validation tests for migration
 *
 * Tests compatibility wrappers to ensure migration quality.
 * Only runs when testMode is enabled in config.
 *
 * @param config - Migration configuration
 * @param log - Array to append log messages to
 * @returns Test results with passed/failed/skipped counts
 *
 * FIXED: Line 356 - Removed unnecessary optional chain on result["title"]
 */
export function runValidationTests(
  config: MigrationConfig,
  log: string[]
): ValidationTestResults {
  if (!config.testMode) {
    return { passed: 0, failed: 0, skipped: 0 };
  }

  const testResults: ValidationTestResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
  };

  // Compatibility wrappers were removed in the 2026-06-12 dead-code sweep
  // (src/server/parsers/compat/ had no live importers). Nothing to test.
  testResults.skipped++;
  log.push('- FandomParser compatibility test skipped (compat wrappers removed)');

  return testResults;
}

/**
 * Generate migration recommendations
 *
 * Analyzes migration results and test outcomes to provide
 * actionable recommendations for improving the migration.
 *
 * @param analysis - Migration analysis data
 * @param testResults - Validation test results
 * @returns Array of recommendation strings
 */
export function generateRecommendations(
  analysis: Record<string, unknown>,
  testResults: ValidationTestResults
): string[] {
  const recommendations: string[] = [];

  // Analyze parser usage
  const parsersMap = analysis['parsers'] as Map<string, number> | undefined;
  if (parsersMap && parsersMap.size > 5) {
    recommendations.push(
      'Multiple parsers detected. Consider consolidating to UnifiedParser for better maintainability.'
    );
  }

  const methodsMap = analysis['methods'] as Map<string, number> | undefined;
  if (methodsMap && methodsMap.size > 10) {
    recommendations.push(
      'Many parser methods in use. Review and standardize API usage patterns.'
    );
  }

  // Test results
  if (testResults.failed > 0) {
    recommendations.push(
      `${testResults.failed} tests failed. Review compatibility wrappers and fix issues before full migration.`
    );
  }

  // Performance
  recommendations.push(
    'Enable PostgreSQL caching for improved parser performance.'
  );

  // Monitoring
  recommendations.push(
    'Set up monitoring for parser cache hit rates and performance metrics.'
  );

  // Gradual migration
  recommendations.push(
    'Use compatibility wrappers for gradual migration. Update files incrementally.'
  );

  return recommendations;
}
