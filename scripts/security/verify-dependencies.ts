/**
 * Dependency verification module
 * Detects package hallucination and checks for known CVEs
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import type { CheckResult, SecurityViolation, DependencyInfo, CVEInfo } from './types';
import {
  getFileDiff,
  parseJSON,
  createTimer,
  runCommand,
  resolveFromRoot,
} from './utils';
import {
  HALLUCINATION_PATTERNS,
  KNOWN_SAFE_PACKAGES,
  CVE_SEVERITY_THRESHOLD,
} from './config';

interface NPMAuditVulnerability {
  severity: string;
  title: string;
  url: string;
  vulnerable_versions: string;
  patched_versions?: string;
}

interface NPMAuditResult {
  vulnerabilities: Record<string, NPMAuditVulnerability>;
  metadata: {
    vulnerabilities: {
      critical: number;
      high: number;
      moderate: number;
      low: number;
      info: number;
    };
  };
}

/**
 * Extract package names from package.json diff
 */
function getChangedDependencies(): string[] {
  try {
    const diff = getFileDiff('package.json');
    if (!diff) {
      return [];
    }

    const addedLines = diff
      .split('\n')
      .filter((line) => line.startsWith('+') && line.includes(':'));

    const packages: string[] = [];
    for (const line of addedLines) {
      // Match package name in format: "package-name": "version"
      const match = line.match(/"([^"]+)":\s*"[^"]+"/);
      if (match?.[1]) {
        packages.push(match[1]);
      }
    }

    return packages;
  } catch {
    return [];
  }
}

/**
 * Get all dependencies from package.json
 */
function getAllDependencies(): string[] {
  try {
    const packageJsonPath = resolveFromRoot('package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps: Record<string, string> = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    };

    // Skip local file: and workspace: dependencies — they won't exist on npm
    return Object.entries(allDeps)
      .filter(([, version]) => !version.startsWith('file:') && !version.startsWith('workspace:'))
      .map(([name]) => name);
  } catch {
    return [];
  }
}

/**
 * Check if a package name matches hallucination patterns
 */
function matchesHallucinationPattern(packageName: string): boolean {
  return HALLUCINATION_PATTERNS.some((pattern) => pattern.test(packageName));
}

/**
 * Verify package exists on npm registry
 */
async function verifyPackageExists(
  packageName: string
): Promise<DependencyInfo> {
  const info: DependencyInfo = {
    name: packageName,
    version: '',
    exists: false,
    suspicious: false,
    reasons: [],
    hallucinated: false,
  };

  // Check if it's in known safe packages
  if (KNOWN_SAFE_PACKAGES.has(packageName)) {
    info.exists = true;
    return info;
  }

  try {
    // Use npm view to get package info
    const result = runCommand(`npm view ${packageName} --json`, {
      timeout: 10000,
    });

    if (result.exitCode !== 0) {
      // Distinguish a DEFINITIVE 404 (package genuinely not on npm — a real
      // hallucination) from a TRANSIENT probe failure (timeout / network /
      // rate-limit / registry 5xx). Only a 404 blocks; transient failures must
      // not, or a flaky registry call falsely fails CI on real packages
      // (e.g. "tsx" intermittently flagged as non-existent).
      const out = `${result.stderr}\n${result.stdout}`.toLowerCase();
      const isDefinite404 = /\be404\b|404 not found|is not in (?:this|the npm) registry/.test(out);
      if (isDefinite404) {
        info.exists = false;
        info.suspicious = true;
        info.hallucinated = true;
        info.reasons.push('Package does not exist on npm registry');
      } else {
        // Inconclusive — give the benefit of the doubt; never block on a flake.
        info.exists = true;
        info.reasons.push('npm registry probe inconclusive (transient failure, not treated as hallucination)');
      }
      return info;
    }

    const npmData = parseJSON<{
      time?: { created?: string };
      repository?: { url?: string };
      downloads?: number;
    }>(result.stdout);

    if (!npmData) {
      info.exists = false;
      info.suspicious = true;
      info.hallucinated = true;
      info.reasons.push('Could not parse npm registry response');
      return info;
    }

    info.exists = true;

    // Check package age
    if (npmData.time?.created) {
      info.created = new Date(npmData.time.created);
      const ageInDays =
        (Date.now() - info.created.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays < 7) {
        info.suspicious = true;
        info.reasons.push(
          `Package is very new (${Math.floor(ageInDays)} days old)`
        );
      }
    }

    // Check repository
    if (!npmData.repository?.url?.includes('github.com')) {
      info.suspicious = true;
      info.reasons.push('No GitHub repository or non-standard repository');
    } else {
      info.repository = npmData.repository.url;
    }

    // Check if name matches hallucination pattern
    if (matchesHallucinationPattern(packageName)) {
      info.suspicious = true;
      info.reasons.push('Package name matches common AI hallucination pattern');
    }

    return info;
  } catch (error) {
    // The probe itself threw (exec/network error) — inconclusive, NOT a
    // hallucination. Don't block CI on an unreachable/slow registry.
    info.exists = true;
    info.reasons.push(
      `npm registry probe error (treated as inconclusive): ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return info;
  }
}

/**
 * Run npm audit to check for CVEs
 */
async function checkForCVEs(): Promise<SecurityViolation[]> {
  try {
    const result = runCommand('npm audit --json', { timeout: 30000 });

    // npm audit exits with code 1 if vulnerabilities found
    if (result.exitCode === 0) {
      return []; // No vulnerabilities
    }

    const auditResult = parseJSON<NPMAuditResult>(result.stdout);
    if (!auditResult) {
      return [];
    }

    const violations: SecurityViolation[] = [];

    for (const [packageName, vuln] of Object.entries(
      auditResult.vulnerabilities
    )) {
      // Map npm severity to our severity levels
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'medium';
      switch (vuln.severity.toLowerCase()) {
        case 'critical':
          severity = 'critical';
          break;
        case 'high':
          severity = 'high';
          break;
        case 'moderate':
          severity = 'medium';
          break;
        case 'low':
          severity = 'low';
          break;
        default:
          severity = 'info';
      }

      // Only report critical and high by default
      if (severity !== 'critical' && severity !== 'high') {
        continue;
      }

      violations.push({
        category: 'dependencies',
        severity,
        message: `${packageName}: ${vuln.title}`,
        file: 'package.json',
        pattern: 'CVE',
        suggestion: vuln.patched_versions
          ? `Update to version ${vuln.patched_versions}`
          : 'Check npm audit for fix recommendations',
        code: `Vulnerable versions: ${vuln.vulnerable_versions}`,
        cwe: vuln.url,
      });
    }

    return violations;
  } catch {
    return [];
  }
}

/**
 * Main dependency verification function
 */
export async function verifyDependencies(
  verifyAll = true
): Promise<CheckResult> {
  const timer = createTimer();
  const violations: SecurityViolation[] = [];

  try {
    // Get dependencies to check
    const depsToCheck = verifyAll
      ? getAllDependencies()
      : getChangedDependencies();

    if (depsToCheck.length === 0) {
      return {
        checkName: 'Dependency Verification',
        status: 'pass',
        violations: [],
        duration: timer.stop(),
      };
    }

    // Verify each package
    for (const packageName of depsToCheck) {
      const info = await verifyPackageExists(packageName);

      if (info.hallucinated) {
        violations.push({
          category: 'dependencies',
          severity: 'critical',
          message: `Package "${packageName}" does not exist on npm registry (possible AI hallucination)`,
          file: 'package.json',
          pattern: 'Package Hallucination',
          suggestion: 'Verify the package name is correct. AI models sometimes suggest non-existent packages.',
          code: packageName,
        });
      } else if (info.suspicious && info.reasons.length > 0) {
        violations.push({
          category: 'dependencies',
          severity: 'medium',
          message: `Package "${packageName}" appears suspicious: ${info.reasons.join(', ')}`,
          file: 'package.json',
          pattern: 'Suspicious Package',
          suggestion: 'Review package carefully before using. Check GitHub repository and download statistics.',
          code: packageName,
        });
      }
    }

    // Check for CVEs
    const cveViolations = await checkForCVEs();
    violations.push(...cveViolations);

    // Determine status
    const hasCritical = violations.some(
      (v) => v.severity === 'critical' || v.severity === 'high'
    );
    const status =
      violations.length === 0 ? 'pass' : hasCritical ? 'fail' : 'warning';

    return {
      checkName: 'Dependency Verification',
      status,
      violations,
      duration: timer.stop(),
    };
  } catch (error) {
    return {
      checkName: 'Dependency Verification',
      status: 'fail',
      violations: [
        {
          category: 'dependencies',
          severity: 'high',
          message: `Dependency verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          file: 'package.json',
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
    const result = await verifyDependencies();
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(result.status === 'fail' ? 1 : 0);
  })();
}
