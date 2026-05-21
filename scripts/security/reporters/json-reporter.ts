/**
 * JSON reporter for security validation
 * Provides machine-readable output for CI/CD integration
 */

import * as fs from 'fs';
import type { SecurityReport } from '../types';

/**
 * Export report as JSON
 */
export function reportToJSON(report: SecurityReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * Save report to JSON file
 */
export function saveJSONReport(report: SecurityReport, filePath: string): void {
  const json = reportToJSON(report);
  fs.writeFileSync(filePath, json, 'utf-8');
}

/**
 * Convert to SARIF format (GitHub Security tab compatible)
 * https://sarifweb.azurewebsites.net/
 */
export function toSARIF(report: SecurityReport): string {
  const runs = [
    {
      tool: {
        driver: {
          name: 'Mugiwara Security Scanner',
          version: '1.0.0',
          informationUri: 'https://github.com/your-org/mugiwara-kaizoku',
          rules: report.results.flatMap((result) =>
            result.violations.map((violation, index) => ({
              id: `${violation.category}-${index}`,
              name: violation.pattern ?? violation.category,
              shortDescription: {
                text: violation.message,
              },
              fullDescription: {
                text: violation.message,
              },
              defaultConfiguration: {
                level:
                  violation.severity === 'critical' || violation.severity === 'high'
                    ? 'error'
                    : violation.severity === 'medium'
                      ? 'warning'
                      : 'note',
              },
              properties: {
                category: violation.category,
                cwe: violation.cwe,
                owasp: violation.owasp,
              },
            }))
          ),
        },
      },
      results: report.results.flatMap((result) =>
        result.violations.map((violation, index) => ({
          ruleId: `${violation.category}-${index}`,
          level:
            violation.severity === 'critical' || violation.severity === 'high'
              ? 'error'
              : violation.severity === 'medium'
                ? 'warning'
                : 'note',
          message: {
            text: violation.message,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: violation.file,
                },
                region: {
                  startLine: violation.line ?? 1,
                  startColumn: violation.column ?? 1,
                },
              },
            },
          ],
          fixes: violation.suggestion
            ? [
                {
                  description: {
                    text: violation.suggestion,
                  },
                },
              ]
            : [],
        }))
      ),
    },
  ];

  return JSON.stringify(
    {
      version: '2.1.0',
      $schema:
        'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      runs,
    },
    null,
    2
  );
}

/**
 * Save SARIF report
 */
export function saveSARIFReport(report: SecurityReport, filePath: string): void {
  const sarif = toSARIF(report);
  fs.writeFileSync(filePath, sarif, 'utf-8');
}

/**
 * Convert to Markdown format (for GitHub PR comments)
 */
export function toMarkdown(report: SecurityReport): string {
  const lines: string[] = [];

  // Header
  lines.push('# 🔒 Security Validation Report\n');
  lines.push(`**Timestamp:** ${report.timestamp.toISOString()}\n`);

  // Summary
  lines.push('## Summary\n');
  lines.push('| Metric | Count |');
  lines.push('|--------|-------|');
  lines.push(`| Total Checks | ${report.totalChecks} |`);
  lines.push(`| ✅ Passed | ${report.passedChecks} |`);
  lines.push(`| ❌ Failed | ${report.failedChecks} |`);
  lines.push(`| ⚠️ Warnings | ${report.warningChecks} |`);
  lines.push(`| Total Violations | ${report.totalViolations} |`);
  lines.push(`| Blocking Violations | ${report.blockingViolations} |`);
  lines.push('');

  // Blocking issues
  const blockingViolations = report.results.flatMap((r) =>
    r.violations.filter(
      (v) => v.severity === 'critical' || v.severity === 'high'
    )
  );

  if (blockingViolations.length > 0) {
    lines.push('## ❌ Blocking Issues\n');

    for (const violation of blockingViolations) {
      lines.push(`### ${violation.message}\n`);
      if (violation.file) {
        lines.push(
          `**Location:** \`${violation.file}${violation.line ? `:${violation.line}` : ''}\``
        );
      }
      if (violation.code) {
        lines.push(`\n**Code:**\n\`\`\`typescript\n${violation.code}\n\`\`\``);
      }
      if (violation.suggestion) {
        lines.push(`\n**Fix:** ${violation.suggestion}`);
      }
      lines.push('');
    }
  }

  // Warnings
  const warningViolations = report.results.flatMap((r) =>
    r.violations.filter(
      (v) => v.severity !== 'critical' && v.severity !== 'high'
    )
  );

  if (warningViolations.length > 0) {
    lines.push('## ⚠️ Warnings\n');
    lines.push('<details>');
    lines.push('<summary>Click to expand warnings</summary>\n');

    for (const violation of warningViolations) {
      lines.push(`### ${violation.message}\n`);
      if (violation.file) {
        lines.push(
          `**Location:** \`${violation.file}${violation.line ? `:${violation.line}` : ''}\``
        );
      }
      if (violation.suggestion) {
        lines.push(`\n**Suggestion:** ${violation.suggestion}`);
      }
      lines.push('');
    }

    lines.push('</details>\n');
  }

  // Check results
  lines.push('## Check Results\n');
  lines.push('| Check | Status | Duration | Issues |');
  lines.push('|-------|--------|----------|--------|');

  for (const result of report.results) {
    const statusIcon =
      result.status === 'pass'
        ? '✅'
        : result.status === 'fail'
          ? '❌'
          : result.status === 'warning'
            ? '⚠️'
            : '⊘';

    const duration =
      result.duration < 1000
        ? `${result.duration}ms`
        : `${(result.duration / 1000).toFixed(2)}s`;

    lines.push(
      `| ${result.checkName} | ${statusIcon} ${result.status} | ${duration} | ${result.violations.length} |`
    );
  }

  lines.push('');

  // Final verdict
  if (report.shouldBlock) {
    lines.push('---\n');
    lines.push('## ❌ Commit Blocked\n');
    lines.push(
      'This commit has been blocked due to critical security issues. Please fix the blocking issues above before committing.'
    );
  } else if (report.warningViolations > 0) {
    lines.push('---\n');
    lines.push('## ⚠️ Commit Allowed with Warnings\n');
    lines.push(
      'This commit is allowed but contains warnings. Please review and address warnings when possible.'
    );
  } else {
    lines.push('---\n');
    lines.push('## ✅ All Checks Passed\n');
    lines.push('No security issues detected.');
  }

  return lines.join('\n');
}

/**
 * Save Markdown report
 */
export function saveMarkdownReport(report: SecurityReport, filePath: string): void {
  const markdown = toMarkdown(report);
  fs.writeFileSync(filePath, markdown, 'utf-8');
}
