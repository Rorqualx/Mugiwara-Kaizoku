/**
 * Console reporter for security validation
 * Provides human-readable, formatted output
 */

import type { SecurityReport, SecurityViolation } from '../types';
import {
  colors,
  formatSeverity,
  formatDuration,
  groupBy,
  pluralize,
  formatFilePath,
} from '../utils';

/**
 * Format a single violation for console output
 */
function formatViolation(violation: SecurityViolation, index: number): string {
  const lines: string[] = [];

  // Header with severity and category
  lines.push(
    `  ${colors.dim}[${index + 1}]${colors.reset} ${formatSeverity(violation.severity)} ${colors.bright}${violation.category.toUpperCase()}${colors.reset}`
  );

  // Message
  lines.push(`      ${violation.message}`);

  // File location
  if (violation.file) {
    const location = violation.line
      ? `${formatFilePath(violation.file)}:${violation.line}${violation.column ? `:${violation.column}` : ''}`
      : formatFilePath(violation.file);
    lines.push(`      ${colors.cyan}${location}${colors.reset}`);
  }

  // Code snippet
  if (violation.code) {
    lines.push(
      `      ${colors.dim}Code:${colors.reset} ${colors.yellow}${violation.code}${colors.reset}`
    );
  }

  // Suggestion
  if (violation.suggestion) {
    lines.push(
      `      ${colors.dim}Fix:${colors.reset} ${colors.green}${violation.suggestion}${colors.reset}`
    );
  }

  lines.push(''); // Empty line between violations

  return lines.join('\n');
}

/**
 * Print section header
 */
function printSectionHeader(title: string, icon: string): void {
  console.log(`\n${icon} ${colors.bright}${title}${colors.reset}`);
  console.log('━'.repeat(80));
}

/**
 * Print summary statistics
 */
function printSummary(report: SecurityReport): void {
  const duration = formatDuration(report.duration);

  console.log(`\n${'═'.repeat(80)}`);
  console.log(`${colors.bright}Security Validation Summary${colors.reset}`);
  console.log('═'.repeat(80));

  // Check results
  const passedColor = report.passedChecks > 0 ? colors.green : colors.dim;
  const failedColor = report.failedChecks > 0 ? colors.red : colors.dim;
  const warningColor = report.warningChecks > 0 ? colors.yellow : colors.dim;

  console.log(
    `${passedColor}✓ ${report.passedChecks} passed${colors.reset}  ` +
      `${failedColor}✗ ${report.failedChecks} failed${colors.reset}  ` +
      `${warningColor}⚠ ${report.warningChecks} warnings${colors.reset}  ` +
      `${colors.dim}⊘ ${report.skippedChecks} skipped${colors.reset}`
  );

  // Violation counts
  if (report.totalViolations > 0) {
    console.log(
      `\n${colors.red}${report.blockingViolations} blocking${colors.reset} | ` +
        `${colors.yellow}${report.warningViolations} warnings${colors.reset} | ` +
        `${colors.dim}${report.totalViolations} total ${pluralize(report.totalViolations, 'violation')}${colors.reset}`
    );
  }

  console.log(`\n${colors.dim}Completed in ${duration}${colors.reset}`);
  console.log('═'.repeat(80));
}

/**
 * Print violations grouped by severity
 */
function printViolations(
  violations: SecurityViolation[],
  title: string,
  icon: string
): void {
  if (violations.length === 0) return;

  printSectionHeader(title, icon);

  // Group by category
  const grouped = groupBy(violations, (v) => v.category);

  for (const [category, categoryViolations] of Object.entries(grouped)) {
    console.log(
      `\n${colors.bright}${category.toUpperCase()} (${categoryViolations.length})${colors.reset}`
    );

    categoryViolations.forEach((violation, index) => {
      console.log(formatViolation(violation, index));
    });
  }
}

/**
 * Main console reporter function
 */
export function reportToConsole(report: SecurityReport): void {
  console.log('\n');
  console.log(`${colors.bright}🔒 Security Validation Report${colors.reset}`);
  console.log(`${colors.dim}${report.timestamp.toISOString()}${colors.reset}`);

  // Separate blocking and warning violations
  const blockingViolations = report.results.flatMap((r) =>
    r.violations.filter(
      (v) => v.severity === 'critical' || v.severity === 'high'
    )
  );

  const warningViolations = report.results.flatMap((r) =>
    r.violations.filter(
      (v) => v.severity === 'medium' || v.severity === 'low' || v.severity === 'info'
    )
  );

  // Print blocking issues
  if (blockingViolations.length > 0) {
    printViolations(
      blockingViolations,
      `BLOCKING ISSUES (${blockingViolations.length})`,
      '❌'
    );
  }

  // Print warnings
  if (warningViolations.length > 0) {
    printViolations(
      warningViolations,
      `WARNINGS (${warningViolations.length})`,
      '⚠️ '
    );
  }

  // Print check results
  if (report.results.length > 0) {
    printSectionHeader('Check Results', '📊');

    for (const result of report.results) {
      const icon =
        result.status === 'pass'
          ? `${colors.green}✓${colors.reset}`
          : result.status === 'fail'
            ? `${colors.red}✗${colors.reset}`
            : result.status === 'warning'
              ? `${colors.yellow}⚠${colors.reset}`
              : `${colors.dim}⊘${colors.reset}`;

      const duration = formatDuration(result.duration);
      const violationCount =
        result.violations.length > 0
          ? `${colors.dim}(${result.violations.length} ${pluralize(result.violations.length, 'issue')})${colors.reset}`
          : '';

      console.log(
        `  ${icon} ${result.checkName} ${colors.dim}${duration}${colors.reset} ${violationCount}`
      );

      if (result.skipped && result.skipReason) {
        console.log(`      ${colors.dim}Skipped: ${result.skipReason}${colors.reset}`);
      }
    }
  }

  // Print summary
  printSummary(report);

  // Final verdict
  if (report.shouldBlock) {
    console.log(
      `\n${colors.red}${colors.bright}❌ COMMIT BLOCKED${colors.reset} - Fix blocking issues above`
    );
  } else if (report.warningViolations > 0) {
    console.log(
      `\n${colors.yellow}⚠️  COMMIT ALLOWED WITH WARNINGS${colors.reset} - Review warnings when possible`
    );
  } else {
    console.log(`\n${colors.green}✅ ALL CHECKS PASSED${colors.reset}`);
  }

  console.log('\n');
}
