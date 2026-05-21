/**
 * Business logic validation module
 * Detects business logic flaws (missing pagination, rate limiting, etc.)
 * WARNING ONLY - does not block commits
 */

import type { CheckResult, SecurityViolation, BusinessLogicIssue } from './types';
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
 * Check for missing pagination in findMany queries
 */
function checkForMissingPagination(
  filePath: string,
  content: string
): BusinessLogicIssue[] {
  const issues: BusinessLogicIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for findMany without take/limit
    if (line.includes('.findMany(')) {
      // Look ahead to see if there's a take parameter
      let hasTake = false;
      const startIdx = i;

      for (let j = i; j < Math.min(i + 10, lines.length); j++) {
        const nextLine = lines[j];
        if (nextLine?.includes('take:') || nextLine?.includes('limit:')) {
          hasTake = true;
          break;
        }
        // Stop at closing of findMany call
        if (nextLine?.includes('});')) {
          break;
        }
      }

      if (!hasTake) {
        issues.push({
          type: 'missing-pagination',
          file: filePath,
          line: i + 1,
          description: 'findMany query without pagination (take/limit)',
          suggestion:
            'Add take parameter to limit results: .findMany({ take: 100, ... })',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for missing input validation in procedures
 */
function checkForMissingInputValidation(
  filePath: string,
  content: string
): BusinessLogicIssue[] {
  const issues: BusinessLogicIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for procedure without .input()
    if (line.match(/export\s+const\s+\w+\s*=\s*\w+Procedure/)) {
      // Look ahead for .input()
      let hasInput = false;

      for (let j = i; j < Math.min(i + 5, lines.length); j++) {
        const nextLine = lines[j];
        if (nextLine?.includes('.input(')) {
          hasInput = true;
          break;
        }
        if (nextLine?.match(/\.(query|mutation)\(/)) {
          break; // Reached query/mutation without seeing .input()
        }
      }

      if (!hasInput && line.match(/\.(query|mutation)\(/)) {
        issues.push({
          type: 'missing-validation',
          file: filePath,
          line: i + 1,
          description: 'Procedure without input validation schema',
          suggestion: 'Add .input(z.object({...})) to validate input parameters',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for unbounded loops over user input
 */
function checkForUnboundedLoops(
  filePath: string,
  content: string
): BusinessLogicIssue[] {
  const issues: BusinessLogicIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for loops over input data
    if (line.match(/for\s*\(.+input\.|forEach\(.+input\./)) {
      // Look back for input validation with max length
      let hasMaxLength = false;

      for (let j = Math.max(0, i - 20); j < i; j++) {
        const prevLine = lines[j];
        if (prevLine?.match(/\.max\(|\.length\s*<=|take:/)) {
          hasMaxLength = true;
          break;
        }
      }

      if (!hasMaxLength) {
        issues.push({
          type: 'unbounded-loop',
          file: filePath,
          line: i + 1,
          description: 'Loop over user input without length validation',
          suggestion:
            'Add max length validation to input schema: z.array(...).max(100)',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for expensive operations without rate limiting
 */
function checkForMissingRateLimit(
  filePath: string,
  content: string
): BusinessLogicIssue[] {
  const issues: BusinessLogicIssue[] = [];
  const lines = content.split('\n');

  // Expensive operation keywords
  const expensiveOps = [
    'export',
    'sendEmail',
    'sendNotification',
    'generatePDF',
    'processPayment',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for expensive operations
    const hasExpensiveOp = expensiveOps.some((op) => line.includes(op));

    if (hasExpensiveOp && line.includes('async')) {
      // Look for rate limiting
      let hasRateLimit = false;

      for (let j = Math.max(0, i - 10); j < i; j++) {
        const prevLine = lines[j];
        if (
          prevLine?.match(/rateLimit|rateLimiter|throttle|debounce|\.use\(/)
        ) {
          hasRateLimit = true;
          break;
        }
      }

      if (!hasRateLimit) {
        issues.push({
          type: 'missing-rate-limit',
          file: filePath,
          line: i + 1,
          description: 'Expensive operation without rate limiting',
          suggestion:
            'Add rate limiting middleware: .use(rateLimitMiddleware({ max: 10, windowMs: 60000 }))',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for state transitions without validation
 */
function checkForStateTransitions(
  filePath: string,
  content: string
): BusinessLogicIssue[] {
  const issues: BusinessLogicIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for status updates
    if (line.match(/status:\s*input\.status|status:\s*['"](?:ACTIVE|INACTIVE|PENDING|COMPLETED)/)) {
      // Look for validation
      let hasValidation = false;

      for (let j = Math.max(0, i - 10); j < i; j++) {
        const prevLine = lines[j];
        if (
          prevLine?.match(/if\s*\(.+status|switch\s*\(.+status|isValidTransition/)
        ) {
          hasValidation = true;
          break;
        }
      }

      if (!hasValidation) {
        issues.push({
          type: 'state-transition',
          file: filePath,
          line: i + 1,
          description: 'State transition without validation',
          suggestion:
            'Validate state transition is allowed before updating status',
        });
      }
    }
  }

  return issues;
}

/**
 * Main business logic checking function
 */
export async function checkBusinessLogic(): Promise<CheckResult> {
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
        checkName: 'Business Logic Validation',
        status: 'pass',
        violations: [],
        duration: timer.stop(),
      };
    }

    // Check each file
    for (const file of filesToCheck) {
      try {
        const content = getStagedFileContent(file);

        // Check for missing pagination
        const paginationIssues = checkForMissingPagination(file, content);

        // Check for missing input validation
        const validationIssues = checkForMissingInputValidation(file, content);

        // Check for unbounded loops
        const loopIssues = checkForUnboundedLoops(file, content);

        // Check for missing rate limits
        const rateLimitIssues = checkForMissingRateLimit(file, content);

        // Check for state transitions
        const stateIssues = checkForStateTransitions(file, content);

        // Convert issues to violations
        const allIssues = [
          ...paginationIssues,
          ...validationIssues,
          ...loopIssues,
          ...rateLimitIssues,
          ...stateIssues,
        ];

        for (const issue of allIssues) {
          const line = getLineFromContent(content, issue.line);

          violations.push({
            category: 'business-logic',
            severity: 'low', // WARNING only
            message: issue.description,
            file: issue.file,
            line: issue.line,
            pattern: issue.type.toUpperCase().replace(/-/g, ' '),
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
      checkName: 'Business Logic Validation',
      status,
      violations,
      duration: timer.stop(),
    };
  } catch (error) {
    return {
      checkName: 'Business Logic Validation',
      status: 'warning',
      violations: [
        {
          category: 'business-logic',
          severity: 'low',
          message: `Business logic validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    const result = await checkBusinessLogic();
    console.log(JSON.stringify(result, null, 2));
    // Always exit 0 (warning only)
    process.exit(0);
  })();
}
