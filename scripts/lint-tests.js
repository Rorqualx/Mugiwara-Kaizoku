#!/usr/bin/env node
/**
 * Test File Linter
 * Runs ESLint on test files with test-specific configuration
 *
 * Usage:
 *   node scripts/lint-tests.js           # Run with output
 *   node scripts/lint-tests.js --quiet   # Minimal output
 *   node scripts/lint-tests.js --json    # JSON output
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findTestFiles(dir = 'src', files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (['node_modules', '.next', 'dist', 'build', '.git'].includes(entry.name)) {
        continue;
      }

      // Recursively search __tests__ directories
      if (entry.name === '__tests__') {
        findTestFiles(fullPath, files);
      } else {
        findTestFiles(fullPath, files);
      }
    } else if (entry.isFile()) {
      // Include test files
      if (
        entry.name.endsWith('.test.ts') ||
        entry.name.endsWith('.test.tsx') ||
        entry.name.endsWith('.spec.ts') ||
        entry.name.endsWith('.spec.tsx') ||
        entry.name.endsWith('.test.js') ||
        entry.name.endsWith('.test.jsx')
      ) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function lintTestFiles(files, options = {}) {
  if (files.length === 0) {
    return { success: true, output: [] };
  }

  const fileList = files.join(' ');
  const format = options.json ? 'json' : 'stylish';

  try {
    const cmd = `bun eslint ${fileList} --format ${format}`;

    const result = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      success: true,
      output: options.json ? JSON.parse(result) : result,
    };
  } catch (error) {
    // ESLint exits with non-zero on errors
    if (error.stdout) {
      try {
        const output = options.json ? JSON.parse(error.stdout) : error.stdout;
        return { success: false, output };
      } catch (e) {
        return { success: false, output: [], error: error.message };
      }
    }

    return { success: false, output: [], error: error.message };
  }
}

function analyzeLintResults(results) {
  if (!Array.isArray(results)) {
    return { totalErrors: 0, totalWarnings: 0, files: [] };
  }

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of results) {
    totalErrors += file.errorCount || 0;
    totalWarnings += file.warningCount || 0;
  }

  return {
    totalErrors,
    totalWarnings,
    files: results,
  };
}

function printResults(analysis, quiet = false) {
  if (quiet) {
    if (analysis.totalErrors > 0 || analysis.totalWarnings > 0) {
      console.log(`❌ ${analysis.totalErrors} errors, ${analysis.totalWarnings} warnings found in test files`);
    } else {
      console.log('✅ No ESLint issues found in test files');
    }
    return;
  }

  console.log('\n📋 Test Linting Results\n');
  console.log(`Total Errors:   ${analysis.totalErrors}`);
  console.log(`Total Warnings: ${analysis.totalWarnings}`);

  if (analysis.totalErrors === 0 && analysis.totalWarnings === 0) {
    console.log('\n✅ All test files passed linting!\n');
  } else {
    console.log('\n⚠️  Issues found in test files\n');
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const options = {
    quiet: args.includes('--quiet'),
    json: args.includes('--json'),
  };

  if (!options.quiet && !options.json) {
    console.log('🧪 Linting test files...\n');
  }

  const testFiles = findTestFiles();

  if (testFiles.length === 0) {
    console.log('⚠️  No test files found');
    process.exit(0);
  }

  if (!options.quiet && !options.json) {
    console.log(`Found ${testFiles.length} test files\n`);
  }

  const lintResult = lintTestFiles(testFiles, options);

  if (options.json) {
    // Output JSON for programmatic use
    console.log(JSON.stringify(lintResult.output, null, 2));
    process.exit(lintResult.success ? 0 : 1);
  }

  const analysis = analyzeLintResults(lintResult.output);

  // Print non-JSON output
  if (!lintResult.success && typeof lintResult.output === 'string') {
    console.log(lintResult.output);
  }

  printResults(analysis, options.quiet);

  // Exit with error code if there are errors
  process.exit(analysis.totalErrors > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { findTestFiles, lintTestFiles, analyzeLintResults };
