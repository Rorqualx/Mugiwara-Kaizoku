/**
 * Race condition detection module
 * Detects TOCTOU (Time-of-Check/Time-of-Use) patterns and missing transactions
 * WARNING ONLY - does not block commits
 */

import type { CheckResult, SecurityViolation, RaceConditionIssue } from './types';
import {
  getStagedFiles,
  getStagedFileContent,
  shouldExcludeFile,
  isTypeScriptFile,
  createTimer,
  getLineFromContent,
} from './utils';
import { EXCLUDE_PATTERNS } from './config';

/**
 * Check for TOCTOU pattern: check-then-act without transaction
 */
function checkForTOCTOU(
  filePath: string,
  content: string
): RaceConditionIssue[] {
  const issues: RaceConditionIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Pattern: findUnique or findFirst followed by update/delete without transaction
    if (line.match(/\.(findUnique|findFirst)\(/)) {
      // Look ahead for update/delete within next 20 lines
      let hasUpdate = false;
      let hasTransaction = false;

      for (let j = i; j < Math.min(i + 20, lines.length); j++) {
        const nextLine = lines[j];
        if (nextLine?.match(/\.(update|delete|create)\(/)) {
          hasUpdate = true;
        }
        if (nextLine?.match(/\$transaction/)) {
          hasTransaction = true;
        }
      }

      // TOCTOU if we have check-then-update without transaction
      if (hasUpdate && !hasTransaction) {
        issues.push({
          type: 'toctou',
          file: filePath,
          line: i + 1,
          description:
            'Possible TOCTOU race condition: Check-then-act pattern without transaction',
          suggestion:
            'Wrap the check and action in ctx.db.$transaction() or use updateMany with conditional where clause',
        });
      }
    }

    // Pattern: Checking value then acting on it (e.g., stock check)
    if (line.match(/if\s*\([^)]*\.(stock|quantity|count|balance)/)) {
      // Look ahead for update
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const nextLine = lines[j];
        if (nextLine?.match(/\.(update|create)\(/)) {
          issues.push({
            type: 'toctou',
            file: filePath,
            line: i + 1,
            description:
              'Possible race condition: Checking value then updating without atomic operation',
            suggestion:
              'Use atomic update with conditional where clause or optimistic locking',
          });
          break;
        }
      }
    }
  }

  return issues;
}

/**
 * Check for missing transactions in multi-step operations
 */
function checkForMissingTransactions(
  filePath: string,
  content: string
): RaceConditionIssue[] {
  const issues: RaceConditionIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Count database operations in a single function
    if (line.match(/async\s+function|async\s+\(/)) {
      let dbOperations = 0;
      let hasTransaction = false;
      const startLine = i;

      // Look ahead within function scope (approximate)
      for (let j = i; j < Math.min(i + 50, lines.length); j++) {
        const nextLine = lines[j];
        if (nextLine?.match(/ctx\.db\.\w+\.(create|update|delete|upsert)\(/)) {
          dbOperations++;
        }
        if (nextLine?.match(/\$transaction/)) {
          hasTransaction = true;
        }
        // Stop at next function
        if (j > i && nextLine?.match(/(?:async\s+)?function|const\s+\w+\s*=/)) {
          break;
        }
      }

      // Warn if 2+ DB operations without transaction
      if (dbOperations >= 2 && !hasTransaction) {
        issues.push({
          type: 'missing-transaction',
          file: filePath,
          line: startLine + 1,
          description: `Function has ${dbOperations} database operations without transaction (atomicity risk)`,
          suggestion:
            'Wrap related database operations in ctx.db.$transaction() to ensure atomicity',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for concurrent access without locking
 */
function checkForMissingLocks(
  filePath: string,
  content: string
): RaceConditionIssue[] {
  const issues: RaceConditionIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for financial/inventory operations without locks
    if (
      line.match(
        /\.(update|updateMany)\(/
      ) &&
      content.includes('balance') ||
      content.includes('stock') ||
      content.includes('quantity') ||
      content.includes('credits')
    ) {
      // Check if transaction has isolation level specified
      const hasIsolationLevel = content.match(/isolationLevel:\s*['"]Serializable['"]/);

      if (!hasIsolationLevel) {
        issues.push({
          type: 'missing-lock',
          file: filePath,
          line: i + 1,
          description:
            'Financial/inventory update without serializable isolation level',
          suggestion:
            'Use $transaction with isolationLevel: "Serializable" for critical operations',
        });
      }
    }
  }

  return issues;
}

/**
 * Main race condition checking function
 */
export async function checkRaceConditions(): Promise<CheckResult> {
  const timer = createTimer();

  try {
    const stagedFiles = getStagedFiles();
    const violations: SecurityViolation[] = [];

    // Filter to TypeScript files in server directory
    const filesToCheck = stagedFiles.filter(
      (file) =>
        isTypeScriptFile(file) &&
        (file.includes('server/routers') ||
          file.includes('server/api') ||
          file.includes('server/services')) &&
        !shouldExcludeFile(file, EXCLUDE_PATTERNS.all)
    );

    if (filesToCheck.length === 0) {
      return {
        checkName: 'Race Condition Detection',
        status: 'pass',
        violations: [],
        duration: timer.stop(),
      };
    }

    // Check each file
    for (const file of filesToCheck) {
      try {
        const content = getStagedFileContent(file);

        // Check for TOCTOU patterns
        const toctouIssues = checkForTOCTOU(file, content);

        // Check for missing transactions
        const transactionIssues = checkForMissingTransactions(file, content);

        // Check for missing locks
        const lockIssues = checkForMissingLocks(file, content);

        // Convert issues to violations
        const allIssues = [...toctouIssues, ...transactionIssues, ...lockIssues];

        for (const issue of allIssues) {
          const line = getLineFromContent(content, issue.line);

          violations.push({
            category: 'race-conditions',
            severity: 'medium', // WARNING only
            message: issue.description,
            file: issue.file,
            line: issue.line,
            pattern: issue.type.toUpperCase(),
            code: line.trim(),
            suggestion: issue.suggestion,
          });
        }
      } catch (error) {
        // File might have been deleted, skip it
        continue;
      }
    }

    // Always return warning status (never block)
    const status = violations.length === 0 ? 'pass' : 'warning';

    return {
      checkName: 'Race Condition Detection',
      status,
      violations,
      duration: timer.stop(),
    };
  } catch (error) {
    return {
      checkName: 'Race Condition Detection',
      status: 'warning',
      violations: [
        {
          category: 'race-conditions',
          severity: 'medium',
          message: `Race condition detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          file: '',
        },
      ],
      duration: timer.stop(),
    };
  }
}

/**
 * CLI entry point (for standalone execution)
 */
if (require.main === module) {
  (async () => {
    const result = await checkRaceConditions();
    console.log(JSON.stringify(result, null, 2));
    // Always exit 0 (warning only)
    process.exit(0);
  })();
}
