#!/usr/bin/env node
/**
 * ESLint Configuration Validator
 * Validates ESLint setup and generates configuration analysis
 *
 * Usage: node scripts/eslint-validator.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkEslintConfig() {
  const configFiles = [
    'eslint.config.mjs',
    '.eslintrc.json',
    '.eslintrc.js',
    '.eslintrc.cjs',
  ];

  for (const file of configFiles) {
    if (fs.existsSync(file)) {
      return { exists: true, file };
    }
  }

  return { exists: false, file: null };
}

function checkEslintPackages() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
  const deps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const requiredPackages = [
    'eslint',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
  ];

  const missingPackages = [];
  const foundPackages = {};

  for (const pkg of requiredPackages) {
    if (deps[pkg]) {
      foundPackages[pkg] = deps[pkg];
    } else {
      missingPackages.push(pkg);
    }
  }

  return { foundPackages, missingPackages };
}

function runEslint() {
  try {
    console.log('🔍 Running ESLint on codebase...');
    const result = execSync('bun eslint src --format json --max-warnings=10', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return { success: true, output: JSON.parse(result) };
  } catch (error) {
    // ESLint exits with non-zero if there are errors
    if (error.stdout) {
      try {
        return { success: false, output: JSON.parse(error.stdout) };
      } catch (e) {
        return { success: false, output: [], error: error.message };
      }
    }
    return { success: false, output: [], error: error.message };
  }
}

function analyzeEslintResults(results) {
  let totalErrors = 0;
  let totalWarnings = 0;
  const ruleViolations = {};
  const filesWithIssues = [];

  for (const file of results) {
    totalErrors += file.errorCount || 0;
    totalWarnings += file.warningCount || 0;

    if (file.errorCount > 0 || file.warningCount > 0) {
      filesWithIssues.push({
        file: file.filePath,
        errors: file.errorCount,
        warnings: file.warningCount,
      });
    }

    for (const message of file.messages || []) {
      const ruleId = message.ruleId || 'unknown';
      if (!ruleViolations[ruleId]) {
        ruleViolations[ruleId] = {
          count: 0,
          severity: message.severity === 2 ? 'error' : 'warning',
        };
      }
      ruleViolations[ruleId].count++;
    }
  }

  return {
    totalErrors,
    totalWarnings,
    ruleViolations,
    filesWithIssues: filesWithIssues.slice(0, 20), // Top 20 files
  };
}

function generateReport(configCheck, packages, eslintResults, analysis) {
  const reportDir = 'eslint-report';

  // Create report directory
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  let report = '# ESLint Configuration Analysis\n\n';

  // Configuration status
  report += '## Configuration\n\n';
  if (configCheck.exists) {
    report += `✅ ESLint configuration found: \`${configCheck.file}\`\n\n`;
  } else {
    report += `❌ No ESLint configuration found!\n\n`;
  }

  // Package status
  report += '## Required Packages\n\n';
  if (packages.missingPackages.length === 0) {
    report += '✅ All required ESLint packages are installed\n\n';
  } else {
    report += `⚠️ Missing packages:\n`;
    for (const pkg of packages.missingPackages) {
      report += `- ${pkg}\n`;
    }
    report += '\n';
  }

  report += '**Installed ESLint packages:**\n';
  for (const [pkg, version] of Object.entries(packages.foundPackages)) {
    report += `- ${pkg}: ${version}\n`;
  }
  report += '\n';

  // ESLint results
  if (!eslintResults.success || analysis.totalErrors > 0 || analysis.totalWarnings > 0) {
    report += '## Lint Results\n\n';
    report += `**Total Errors:** ${analysis.totalErrors}\n`;
    report += `**Total Warnings:** ${analysis.totalWarnings}\n\n`;

    // Top rule violations
    report += '### Top Rule Violations\n\n';
    report += '| Rule | Count | Severity |\n';
    report += '|------|-------|----------|\n';

    const topRules = Object.entries(analysis.ruleViolations)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15);

    for (const [rule, data] of topRules) {
      const emoji = data.severity === 'error' ? '🔴' : '⚠️';
      report += `| ${rule} | ${data.count} | ${emoji} ${data.severity} |\n`;
    }
    report += '\n';

    // Files with most issues
    if (analysis.filesWithIssues.length > 0) {
      report += '### Files with Most Issues\n\n';
      report += '| File | Errors | Warnings |\n';
      report += '|------|--------|----------|\n';

      const sorted = analysis.filesWithIssues
        .sort((a, b) => (b.errors + b.warnings) - (a.errors + a.warnings))
        .slice(0, 10);

      for (const file of sorted) {
        const relativePath = file.file.replace(process.cwd(), '.');
        report += `| ${relativePath} | ${file.errors} | ${file.warnings} |\n`;
      }
      report += '\n';
    }
  } else {
    report += '## Lint Results\n\n';
    report += '✅ No ESLint errors or warnings found!\n\n';
  }

  // Write reports
  fs.writeFileSync(path.join(reportDir, 'eslint-analysis.md'), report);
  fs.writeFileSync(
    path.join(reportDir, 'eslint-results.json'),
    JSON.stringify({ configCheck, packages, analysis }, null, 2)
  );

  console.log(`\n✅ ESLint validation report generated in ${reportDir}/`);
  console.log(`   Errors: ${analysis.totalErrors}`);
  console.log(`   Warnings: ${analysis.totalWarnings}`);

  return analysis.totalErrors > 0 ? 1 : 0;
}

// Main execution
function main() {
  console.log('🔧 Validating ESLint configuration...\n');

  const configCheck = checkEslintConfig();
  const packages = checkEslintPackages();
  const eslintResults = runEslint();
  const analysis = analyzeEslintResults(eslintResults.output);

  const exitCode = generateReport(configCheck, packages, eslintResults, analysis);

  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

module.exports = { checkEslintConfig, checkEslintPackages, runEslint, analyzeEslintResults };
