#!/usr/bin/env node
/**
 * Strict Typing Enforcer
 * Scans codebase for type safety violations
 *
 * Usage: node scripts/strict-typing-enforcer.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns to detect type safety violations
const PATTERNS = {
  ANY_TYPE: {
    name: 'any type usage',
    pattern: ': any\\b|<any>|Array<any>|Promise<any>',
    severity: 'high',
    message: 'Use of `any` type defeats TypeScript type safety. Use `unknown` with type guards instead.',
  },
  IMPLICIT_ANY: {
    name: 'implicit any',
    pattern: '@ts-ignore|@ts-expect-error',
    severity: 'high',
    message: 'Suppressing TypeScript errors can hide type safety issues.',
  },
  UNSAFE_ASSERTION: {
    name: 'unsafe type assertion',
    pattern: ' as any|\\(.*? as unknown\\)',
    severity: 'medium',
    message: 'Type assertions bypass type checking. Ensure they are necessary.',
  },
  MISSING_RETURN_TYPE: {
    name: 'missing return type',
    // This is simplified - actual detection would need AST parsing
    pattern: 'export function \\w+\\([^)]*\\)\\s*{',
    severity: 'medium',
    message: 'Export functions should have explicit return types.',
  },
};

function findSourceFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (['node_modules', '.next', 'dist', 'build', '.git'].includes(entry.name)) {
        continue;
      }
      findSourceFiles(fullPath, files);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        // Skip type definition files
        if (!entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    }
  }

  return files;
}

function scanFile(filePath, pattern) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const matches = [];
  const regex = new RegExp(pattern, 'gi');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    regex.lastIndex = 0; // Reset regex
    const match = regex.exec(line);

    if (match) {
      matches.push({
        line: i + 1,
        column: match.index + 1,
        text: line.trim(),
      });
    }
  }

  return matches;
}

function scanCodebase() {
  console.log('🔍 Scanning codebase for type safety violations...');

  const srcDir = path.join(process.cwd(), 'src');
  if (!fs.existsSync(srcDir)) {
    console.error('Error: src/ directory not found');
    process.exit(1);
  }

  const sourceFiles = findSourceFiles(srcDir);
  console.log(`   Found ${sourceFiles.length} TypeScript files\n`);

  const results = {};

  for (const [patternName, config] of Object.entries(PATTERNS)) {
    results[patternName] = {
      config,
      violations: [],
      totalCount: 0,
    };

    for (const file of sourceFiles) {
      const matches = scanFile(file, config.pattern);

      if (matches.length > 0) {
        results[patternName].violations.push({
          file: file.replace(process.cwd(), '.'),
          matches,
        });
        results[patternName].totalCount += matches.length;
      }
    }
  }

  return results;
}

function generateReport(results) {
  const reportDir = 'type-safety-report';

  // Create report directory
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  let report = '# Type Safety Analysis Report\n\n';

  let hasHighSeverity = false;
  let totalViolations = 0;

  // Summary table
  report += '## Summary\n\n';
  report += '| Violation Type | Count | Severity |\n';
  report += '|----------------|-------|----------|\n';

  for (const [patternName, data] of Object.entries(results)) {
    const emoji = data.config.severity === 'high' ? '🔴' : '⚠️';
    report += `| ${data.config.name} | ${data.totalCount} | ${emoji} ${data.config.severity} |\n`;

    totalViolations += data.totalCount;
    if (data.config.severity === 'high' && data.totalCount > 0) {
      hasHighSeverity = true;
    }
  }

  report += `\n**Total Violations:** ${totalViolations}\n\n`;

  // Detailed findings
  report += '## Detailed Findings\n\n';

  for (const [patternName, data] of Object.entries(results)) {
    if (data.totalCount === 0) continue;

    report += `### ${data.config.name} (${data.totalCount} violations)\n\n`;
    report += `**Severity:** ${data.config.severity === 'high' ? '🔴 High' : '⚠️ Medium'}\n\n`;
    report += `**Message:** ${data.config.message}\n\n`;

    // Show top files
    const topFiles = data.violations
      .sort((a, b) => b.matches.length - a.matches.length)
      .slice(0, 10);

    for (const fileData of topFiles) {
      report += `**${fileData.file}** (${fileData.matches.length} occurrences)\n`;

      for (const match of fileData.matches.slice(0, 3)) {
        report += `- Line ${match.line}: \`${match.text}\`\n`;
      }

      if (fileData.matches.length > 3) {
        report += `  ... and ${fileData.matches.length - 3} more\n`;
      }

      report += '\n';
    }
  }

  // Recommendations
  report += '## Recommendations\n\n';
  report += '1. **Replace `any` with `unknown`**: Use `unknown` type with type guards for better type safety\n';
  report += '2. **Add explicit return types**: All exported functions should have return types\n';
  report += '3. **Remove type assertions**: Refactor code to avoid `as` assertions when possible\n';
  report += '4. **Fix TypeScript errors**: Remove `@ts-ignore` by addressing underlying type issues\n\n';

  // Write reports
  fs.writeFileSync(path.join(reportDir, 'report.md'), report);
  fs.writeFileSync(
    path.join(reportDir, 'violations.json'),
    JSON.stringify({ totalViolations, hasHighSeverity, results }, null, 2)
  );

  console.log(`\n✅ Type safety report generated in ${reportDir}/`);
  console.log(`   Total violations: ${totalViolations}`);
  console.log(`   High severity issues: ${hasHighSeverity ? 'Yes' : 'No'}`);

  return hasHighSeverity ? 1 : 0;
}

// Main execution
function main() {
  console.log('🛡️  Type Safety Enforcer\n');

  const results = scanCodebase();
  const exitCode = generateReport(results);

  process.exit(exitCode);
}

if (require.main === module) {
  main();
}

module.exports = { findSourceFiles, scanFile, scanCodebase, generateReport };
