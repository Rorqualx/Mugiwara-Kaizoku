#!/usr/bin/env node
/**
 * TypeScript Error Categorizer
 * Analyzes TypeScript compilation errors and generates categorized report
 *
 * Usage: node scripts/ts-error-categorizer.js <error-log-file>
 */

const fs = require('fs');
const path = require('path');

// Error code categories
const ERROR_CATEGORIES = {
  'TS2304': 'Cannot find name',
  'TS2345': 'Argument type mismatch',
  'TS2339': 'Property does not exist',
  'TS2322': 'Type assignment error',
  'TS2571': 'Object is of type unknown',
  'TS7053': 'Element has implicit any type',
  'TS7006': 'Parameter has implicit any type',
  'TS2532': 'Object is possibly undefined',
  'TS2531': 'Object is possibly null',
  'TS2722': 'Cannot invoke an object which is possibly undefined',
};

function parseErrorLog(logFile) {
  if (!fs.existsSync(logFile)) {
    console.error(`Error log file not found: ${logFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.split('\n');

  const errors = [];
  const errorPattern = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

  for (const line of lines) {
    const match = line.match(errorPattern);
    if (match) {
      const [, filePath, lineNum, colNum, errorCode, message] = match;
      errors.push({
        file: filePath,
        line: parseInt(lineNum),
        column: parseInt(colNum),
        code: errorCode,
        message: message.trim(),
        category: ERROR_CATEGORIES[errorCode] || 'Other'
      });
    }
  }

  return errors;
}

function categorizeErrors(errors) {
  const categories = {};

  for (const error of errors) {
    const category = error.category;
    if (!categories[category]) {
      categories[category] = {
        count: 0,
        errors: []
      };
    }
    categories[category].count++;
    categories[category].errors.push(error);
  }

  return categories;
}

function generateReport(errors, categories) {
  const reportDir = 'ts-error-report';

  // Create report directory
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // Generate summary
  let report = '# TypeScript Error Report\n\n';
  report += `**Total Errors:** ${errors.length}\n\n`;
  report += '## Error Summary by Category\n\n';
  report += '| Category | Count | Percentage |\n';
  report += '|----------|-------|------------|\n';

  const sorted = Object.entries(categories)
    .sort((a, b) => b[1].count - a[1].count);

  for (const [category, data] of sorted) {
    const percentage = ((data.count / errors.length) * 100).toFixed(1);
    report += `| ${category} | ${data.count} | ${percentage}% |\n`;
  }

  report += '\n## Detailed Errors by Category\n\n';

  for (const [category, data] of sorted) {
    report += `### ${category} (${data.count} errors)\n\n`;

    // Group by file
    const byFile = {};
    for (const error of data.errors) {
      if (!byFile[error.file]) {
        byFile[error.file] = [];
      }
      byFile[error.file].push(error);
    }

    // Show top files
    const topFiles = Object.entries(byFile)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);

    for (const [file, fileErrors] of topFiles) {
      report += `**${file}** (${fileErrors.length} errors)\n`;
      for (const error of fileErrors.slice(0, 3)) {
        report += `- Line ${error.line}: ${error.code} - ${error.message}\n`;
      }
      if (fileErrors.length > 3) {
        report += `  ... and ${fileErrors.length - 3} more\n`;
      }
      report += '\n';
    }
  }

  // Write report
  fs.writeFileSync(path.join(reportDir, 'report.md'), report);

  // Write JSON for programmatic access
  fs.writeFileSync(
    path.join(reportDir, 'errors.json'),
    JSON.stringify({ total: errors.length, categories, errors }, null, 2)
  );

  console.log(`✅ TypeScript error report generated in ${reportDir}/`);
  console.log(`   Total errors: ${errors.length}`);
  console.log(`   Categories: ${Object.keys(categories).length}`);

  return report;
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/ts-error-categorizer.js <error-log-file>');
    process.exit(1);
  }

  const logFile = args[0];

  console.log('📊 Analyzing TypeScript errors...');
  const errors = parseErrorLog(logFile);

  if (errors.length === 0) {
    console.log('✅ No TypeScript errors found!');
    process.exit(0);
  }

  const categories = categorizeErrors(errors);
  generateReport(errors, categories);
}

if (require.main === module) {
  main();
}

module.exports = { parseErrorLog, categorizeErrors, generateReport };
