/**
 * Secret scanning module
 * Detects hardcoded secrets, API keys, passwords, and other sensitive credentials
 */

import type { CheckResult, SecurityViolation } from './types';
import {
  getStagedFiles,
  getStagedFileContent,
  shouldExcludeFile,
  calculateEntropy,
  getLineFromContent,
  isCodeFile,
  createTimer,
} from './utils';
import { SECRET_PATTERNS, EXCLUDE_PATTERNS } from './config';

interface SecretMatch {
  pattern: string;
  value: string;
  line: number;
  column: number;
  entropy: number;
}

/**
 * Check if a line is a comment
 */
function isComment(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('#')
  );
}

/**
 * Check if a value looks like a placeholder or example
 */
function isPlaceholder(value: string): boolean {
  const placeholders = [
    /your[_-]?api[_-]?key/i,
    /your[_-]?secret/i,
    /your[_-]?password/i,
    /example/i,
    /placeholder/i,
    /xxx+/i,
    /\*\*\*+/,
    /\.\.\.+/,
    /test/i,
    /sample/i,
    /dummy/i,
    /fake/i,
    /mock/i,
    /abc+123+/i,
    /^(?:foo|bar|baz|qux)$/i,
  ];

  return placeholders.some((pattern) => pattern.test(value));
}

/**
 * Check if line is in a test file or fixture
 */
function isTestRelated(filePath: string): boolean {
  return (
    filePath.includes('test') ||
    filePath.includes('spec') ||
    filePath.includes('fixture') ||
    filePath.includes('mock') ||
    filePath.includes('__tests__')
  );
}

/**
 * Scan a file for secret patterns
 */
function scanFileForSecrets(
  filePath: string,
  content: string
): SecurityViolation[] {
  const violations: SecurityViolation[] = [];
  const lines = content.split('\n');

  for (const secretPattern of SECRET_PATTERNS) {
    const matches = Array.from(
      content.matchAll(new RegExp(secretPattern.pattern, 'g'))
    );

    for (const match of matches) {
      if (!match[0] || !match.index) continue;

      // Calculate line number
      const textBeforeMatch = content.substring(0, match.index);
      const lineNumber = textBeforeMatch.split('\n').length;
      const line = lines[lineNumber - 1];

      if (!line) continue;

      // Skip comments
      if (isComment(line)) {
        continue;
      }

      // Extract the actual secret value (usually first capture group)
      const secretValue = match[1] ?? match[0];

      // Skip if it's a placeholder
      if (isPlaceholder(secretValue)) {
        continue;
      }

      // Check entropy if required
      if (secretPattern.entropy) {
        const entropy = calculateEntropy(secretValue);
        if (entropy < secretPattern.entropy) {
          continue; // Too low entropy, likely not a real secret
        }
      }

      // Calculate column
      const column = match.index - textBeforeMatch.lastIndexOf('\n');

      violations.push({
        category: 'secrets',
        severity: secretPattern.severity,
        message: secretPattern.description,
        file: filePath,
        line: lineNumber,
        column,
        pattern: secretPattern.name,
        code: line.trim(),
        suggestion: 'Move this secret to an environment variable (.env file) and use process.env.VARIABLE_NAME',
      });
    }
  }

  return violations;
}

/**
 * Load baseline (known false positives) from .secrets.baseline
 */
function loadBaseline(): Set<string> {
  const baseline = new Set<string>();
  // TODO: Implement .secrets.baseline file loading
  // For now, return empty set
  return baseline;
}

/**
 * Check if violation is in baseline
 */
function isInBaseline(
  violation: SecurityViolation,
  baseline: Set<string>
): boolean {
  const key = `${violation.file}:${violation.line}:${violation.pattern}`;
  return baseline.has(key);
}

/**
 * Main secret scanning function
 */
export async function scanSecrets(): Promise<CheckResult> {
  const timer = createTimer();

  try {
    const stagedFiles = getStagedFiles();
    const violations: SecurityViolation[] = [];
    const baseline = loadBaseline();

    // Filter to only code files and exclude patterns
    const filesToScan = stagedFiles.filter(
      (file) =>
        isCodeFile(file) &&
        !shouldExcludeFile(file, EXCLUDE_PATTERNS.secrets)
    );

    if (filesToScan.length === 0) {
      return {
        checkName: 'Secret Scanning',
        status: 'pass',
        violations: [],
        duration: timer.stop(),
      };
    }

    // Scan each file
    for (const file of filesToScan) {
      try {
        const content = getStagedFileContent(file);
        const fileViolations = scanFileForSecrets(file, content);

        // Filter out baseline violations
        const newViolations = fileViolations.filter(
          (v) => !isInBaseline(v, baseline)
        );

        violations.push(...newViolations);
      } catch (error) {
        // File might have been deleted, skip it
        continue;
      }
    }

    // Determine status
    const hasCritical = violations.some(
      (v) => v.severity === 'critical' || v.severity === 'high'
    );
    const status = violations.length === 0 ? 'pass' : hasCritical ? 'fail' : 'warning';

    return {
      checkName: 'Secret Scanning',
      status,
      violations,
      duration: timer.stop(),
    };
  } catch (error) {
    return {
      checkName: 'Secret Scanning',
      status: 'fail',
      violations: [
        {
          category: 'secrets',
          severity: 'high',
          message: `Secret scanning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    const result = await scanSecrets();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'fail' ? 1 : 0);
  })();
}
