#!/usr/bin/env node
/**
 * Main security validation orchestrator
 * Runs all security checks and generates comprehensive report
 */

import type { SecurityReport, CheckResult, CLIOptions } from './types';
import { createTimer, measureTime } from './utils';
import { DEFAULT_CONFIG } from './config';

// Import all check modules
import { scanSecrets } from './scan-secrets';
import { verifyDependencies } from './verify-dependencies';
import { checkAuthPatterns } from './check-auth-patterns';
import { checkArchitecturalDrift } from './check-architectural-drift';
import { checkRaceConditions } from './check-race-conditions';
import { checkBusinessLogic } from './check-business-logic';

// Import reporters
import { reportToConsole } from './reporters/console-reporter';
import {
  reportToJSON,
  saveJSONReport,
  saveSARIFReport,
  saveMarkdownReport,
} from './reporters/json-reporter';

/**
 * Parse CLI arguments
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    skipSecrets: false,
    skipDeps: false,
    skipAuth: false,
    skipDrift: false,
    skipRace: false,
    skipLogic: false,
    reportOnly: false,
    verbose: false,
    json: false,
  };

  for (const arg of args) {
    switch (arg) {
      case '--skip-secrets':
        options.skipSecrets = true;
        break;
      case '--skip-deps':
        options.skipDeps = true;
        break;
      case '--skip-auth':
        options.skipAuth = true;
        break;
      case '--skip-drift':
        options.skipDrift = true;
        break;
      case '--skip-race':
        options.skipRace = true;
        break;
      case '--skip-logic':
        options.skipLogic = true;
        break;
      case '--report-only':
        options.reportOnly = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--output':
      case '-o':
        // Next arg is the output file
        const nextIndex = args.indexOf(arg) + 1;
        if (nextIndex < args.length) {
          options.output = args[nextIndex];
        }
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Security Pre-Commit Validation Tool

Usage:
  npm run security:check [options]

Options:
  --skip-secrets       Skip secret scanning
  --skip-deps          Skip dependency verification
  --skip-auth          Skip auth pattern validation
  --skip-drift         Skip architectural drift detection
  --skip-race          Skip race condition detection
  --skip-logic         Skip business logic validation
  --report-only        Generate report without blocking (exit 0)
  --verbose, -v        Verbose output
  --json               Output as JSON
  --output, -o FILE    Save report to file
  --help, -h           Show this help message

Examples:
  npm run security:check
  npm run security:check --skip-race --skip-logic
  npm run security:check --json --output security-report.json
  npm run security:check --report-only

Environment Variables:
  SKIP_SECURITY=1      Skip all security checks (not recommended)
  `);
}

/**
 * Run all security checks
 */
async function runAllChecks(options: CLIOptions): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Define checks with their enable flags
  const checks: Array<{
    name: string;
    fn: () => Promise<CheckResult>;
    enabled: boolean;
  }> = [
    {
      name: 'Secret Scanning',
      fn: scanSecrets,
      enabled: !options.skipSecrets && DEFAULT_CONFIG.secrets.enabled,
    },
    {
      name: 'Dependency Verification',
      fn: () => verifyDependencies(DEFAULT_CONFIG.dependencies.verifyAll),
      enabled: !options.skipDeps && DEFAULT_CONFIG.dependencies.enabled,
    },
    {
      name: 'Auth Pattern Validation',
      fn: checkAuthPatterns,
      enabled: !options.skipAuth && DEFAULT_CONFIG.auth.enabled,
    },
    {
      name: 'Architectural Drift Detection',
      fn: checkArchitecturalDrift,
      enabled: !options.skipDrift && DEFAULT_CONFIG.architecturalDrift.enabled,
    },
    {
      name: 'Race Condition Detection',
      fn: checkRaceConditions,
      enabled: !options.skipRace && DEFAULT_CONFIG.raceConditions.enabled,
    },
    {
      name: 'Business Logic Validation',
      fn: checkBusinessLogic,
      enabled: !options.skipLogic && DEFAULT_CONFIG.businessLogic.enabled,
    },
  ];

  // Run checks in parallel for performance
  if (DEFAULT_CONFIG.performance.parallelChecks) {
    const promises = checks
      .filter((check) => check.enabled)
      .map(async (check) => {
        if (options.verbose) {
          console.log(`Running: ${check.name}...`);
        }
        return await check.fn();
      });

    results.push(...(await Promise.all(promises)));

    // Add skipped checks
    for (const check of checks.filter((c) => !c.enabled)) {
      results.push({
        checkName: check.name,
        status: 'skipped',
        violations: [],
        duration: 0,
        skipped: true,
        skipReason: 'Disabled in configuration or via CLI flag',
      });
    }
  } else {
    // Run sequentially
    for (const check of checks) {
      if (check.enabled) {
        if (options.verbose) {
          console.log(`Running: ${check.name}...`);
        }
        const result = await check.fn();
        results.push(result);
      } else {
        results.push({
          checkName: check.name,
          status: 'skipped',
          violations: [],
          duration: 0,
          skipped: true,
          skipReason: 'Disabled in configuration or via CLI flag',
        });
      }
    }
  }

  return results;
}

/**
 * Generate security report
 */
function generateReport(results: CheckResult[]): SecurityReport {
  // Count check statuses
  const passedChecks = results.filter((r) => r.status === 'pass').length;
  const failedChecks = results.filter((r) => r.status === 'fail').length;
  const warningChecks = results.filter((r) => r.status === 'warning').length;
  const skippedChecks = results.filter((r) => r.status === 'skipped').length;

  // Count violations by severity
  const allViolations = results.flatMap((r) => r.violations);
  const blockingViolations = allViolations.filter(
    (v) => v.severity === 'critical' || v.severity === 'high'
  ).length;
  const warningViolations = allViolations.filter(
    (v) => v.severity === 'medium' || v.severity === 'low' || v.severity === 'info'
  ).length;

  // Calculate total duration
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  // Determine if commit should be blocked
  const shouldBlock = failedChecks > 0 || blockingViolations > 0;

  return {
    timestamp: new Date(),
    totalChecks: results.length,
    passedChecks,
    failedChecks,
    warningChecks,
    skippedChecks,
    totalViolations: allViolations.length,
    blockingViolations,
    warningViolations,
    results,
    duration: totalDuration,
    shouldBlock,
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Check for SKIP_SECURITY environment variable
  if (process.env.SKIP_SECURITY === '1') {
    console.log('⚠️  SKIP_SECURITY=1 detected - skipping all security checks');
    console.log('This is NOT recommended for regular commits');
    process.exit(0);
  }

  const options = parseArgs();
  const timer = createTimer();

  try {
    // Run all checks
    const results = await runAllChecks(options);

    // Generate report
    const report = generateReport(results);

    // Output report
    if (options.json) {
      console.log(reportToJSON(report));
    } else {
      reportToConsole(report);
    }

    // Save to file if requested
    if (options.output) {
      const ext = options.output.toLowerCase();

      if (ext.endsWith('.json')) {
        saveJSONReport(report, options.output);
      } else if (ext.endsWith('.sarif')) {
        saveSARIFReport(report, options.output);
      } else if (ext.endsWith('.md')) {
        saveMarkdownReport(report, options.output);
      } else {
        // Default to JSON
        saveJSONReport(report, options.output);
      }

      if (!options.json && options.verbose) {
        console.log(`Report saved to: ${options.output}`);
      }
    }

    // Exit with appropriate code
    if (options.reportOnly) {
      process.exit(0); // Always succeed in report-only mode
    } else {
      process.exit(report.shouldBlock ? 1 : 0);
    }
  } catch (error) {
    console.error('Fatal error during security validation:');
    console.error(error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { runAllChecks, generateReport };
