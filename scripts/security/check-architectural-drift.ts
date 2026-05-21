/**
 * Architectural drift detection module
 * Detects security pattern downgrades and forbidden patterns
 */

import type { CheckResult, SecurityViolation, ArchitecturalDriftIssue } from './types';
import {
  getStagedFiles,
  getStagedFileContent,
  shouldExcludeFile,
  isCodeFile,
  createTimer,
  getLineFromContent,
} from './utils';
import {
  EXCLUDE_PATTERNS,
  FORBIDDEN_CRYPTO_PATTERNS,
  FORBIDDEN_AUTH_PATTERNS,
  FORBIDDEN_CODE_EXEC_PATTERNS,
  REQUIRED_AUTH_FILE_PATTERNS,
} from './config';

/**
 * Check file for forbidden patterns
 */
function checkForbiddenPatterns(
  filePath: string,
  content: string
): ArchitecturalDriftIssue[] {
  const issues: ArchitecturalDriftIssue[] = [];
  const lines = content.split('\n');

  // Check crypto patterns
  for (const { pattern, message, severity } of FORBIDDEN_CRYPTO_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && pattern.test(line)) {
        issues.push({
          pattern: 'Forbidden Crypto Pattern',
          file: filePath,
          line: i + 1,
          severity,
          description: message,
          replacement: undefined,
        });
      }
    }
  }

  // Check auth patterns
  for (const { pattern, message, severity } of FORBIDDEN_AUTH_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && pattern.test(line)) {
        issues.push({
          pattern: 'Forbidden Auth Pattern',
          file: filePath,
          line: i + 1,
          severity,
          description: message,
          replacement: 'Use httpOnly cookies for authentication tokens',
        });
      }
    }
  }

  // Check code execution patterns
  for (const { pattern, message, severity } of FORBIDDEN_CODE_EXEC_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && pattern.test(line)) {
        issues.push({
          pattern: 'Forbidden Code Execution',
          file: filePath,
          line: i + 1,
          severity,
          description: message,
          replacement: undefined,
        });
      }
    }
  }

  return issues;
}

/**
 * Check if required patterns are present in auth-related files
 */
function checkRequiredPatterns(
  filePath: string,
  content: string
): ArchitecturalDriftIssue[] {
  const issues: ArchitecturalDriftIssue[] = [];

  for (const { filePattern, pattern, message, severity } of REQUIRED_AUTH_FILE_PATTERNS) {
    // Check if this file should have the required pattern
    if (filePattern.test(filePath)) {
      // Check if pattern exists in file
      if (!pattern.test(content)) {
        issues.push({
          pattern: 'Missing Required Pattern',
          file: filePath,
          line: 1,
          severity,
          description: message,
          replacement: undefined,
        });
      }
    }
  }

  return issues;
}

/**
 * Check for specific security downgrades (e.g., bcrypt -> md5)
 */
function checkSecurityDowngrades(
  filePath: string,
  content: string
): ArchitecturalDriftIssue[] {
  const issues: ArchitecturalDriftIssue[] = [];
  const lines = content.split('\n');

  // Check for password hashing without bcrypt/argon2
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Look for password-related operations
    if (line.match(/password|passwd|pwd/i)) {
      // Check if using weak crypto
      if (line.match(/createHash\(['"](?:md5|sha1|sha256)['"]\)/)) {
        // Allow SHA-256+ for password hashing in some contexts, but warn
        const usesWeakAlgo = line.match(/createHash\(['"](?:md5|sha1)['"]\)/);

        if (usesWeakAlgo) {
          issues.push({
            pattern: 'Weak Password Hashing',
            file: filePath,
            line: i + 1,
            severity: 'critical',
            description:
              'Using weak cryptographic algorithm for password hashing',
            replacement: 'Use bcrypt.hash() or argon2.hash() for password hashing',
          });
        }
      }

      // Check for plaintext password assignment
      if (
        line.match(/password\s*=\s*['"][^'"]+['"]/) &&
        !line.match(/bcrypt|argon2|hash/)
      ) {
        issues.push({
          pattern: 'Plaintext Password',
          file: filePath,
          line: i + 1,
          severity: 'critical',
          description: 'Possible plaintext password assignment detected',
          replacement: 'Hash passwords using bcrypt before storing',
        });
      }
    }
  }

  return issues;
}

/**
 * Check for XSS vulnerabilities
 */
function checkXSSVulnerabilities(
  filePath: string,
  content: string
): ArchitecturalDriftIssue[] {
  const issues: ArchitecturalDriftIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for dangerouslySetInnerHTML
    if (line.includes('dangerouslySetInnerHTML')) {
      issues.push({
        pattern: 'XSS Risk',
        file: filePath,
        line: i + 1,
        severity: 'high',
        description: 'dangerouslySetInnerHTML can lead to XSS attacks',
        replacement: 'Sanitize HTML using DOMPurify or use safe rendering methods',
      });
    }

    // Check for direct innerHTML assignment
    if (line.match(/\.innerHTML\s*=/)) {
      issues.push({
        pattern: 'XSS Risk',
        file: filePath,
        line: i + 1,
        severity: 'high',
        description: 'Direct innerHTML assignment can lead to XSS',
        replacement: 'Use textContent or proper React rendering',
      });
    }
  }

  return issues;
}

/**
 * Main architectural drift checking function
 */
export async function checkArchitecturalDrift(): Promise<CheckResult> {
  const timer = createTimer();

  try {
    const stagedFiles = getStagedFiles();
    const violations: SecurityViolation[] = [];

    // Filter to code files and exclude patterns
    const filesToCheck = stagedFiles.filter(
      (file) =>
        isCodeFile(file) && !shouldExcludeFile(file, EXCLUDE_PATTERNS.all)
    );

    if (filesToCheck.length === 0) {
      return {
        checkName: 'Architectural Drift Detection',
        status: 'pass',
        violations: [],
        duration: timer.stop(),
      };
    }

    // Check each file
    for (const file of filesToCheck) {
      try {
        const content = getStagedFileContent(file);

        // Check for forbidden patterns
        const forbiddenIssues = checkForbiddenPatterns(file, content);

        // Check for required patterns (in auth files)
        const missingPatterns = checkRequiredPatterns(file, content);

        // Check for security downgrades
        const downgrades = checkSecurityDowngrades(file, content);

        // Check for XSS vulnerabilities
        const xssIssues = checkXSSVulnerabilities(file, content);

        // Convert issues to violations
        const allIssues = [
          ...forbiddenIssues,
          ...missingPatterns,
          ...downgrades,
          ...xssIssues,
        ];

        for (const issue of allIssues) {
          const line = getLineFromContent(content, issue.line);

          violations.push({
            category: 'architectural-drift',
            severity: issue.severity,
            message: issue.description,
            file: issue.file,
            line: issue.line,
            pattern: issue.pattern,
            code: line.trim(),
            suggestion: issue.replacement,
          });
        }
      } catch (error) {
        // File might have been deleted, skip it
        continue;
      }
    }

    // Determine status
    const hasCritical = violations.some(
      (v) => v.severity === 'critical' || v.severity === 'high'
    );
    const status =
      violations.length === 0 ? 'pass' : hasCritical ? 'fail' : 'warning';

    return {
      checkName: 'Architectural Drift Detection',
      status,
      violations,
      duration: timer.stop(),
    };
  } catch (error) {
    return {
      checkName: 'Architectural Drift Detection',
      status: 'fail',
      violations: [
        {
          category: 'architectural-drift',
          severity: 'high',
          message: `Architectural drift detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    const result = await checkArchitecturalDrift();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'fail' ? 1 : 0);
  })();
}
