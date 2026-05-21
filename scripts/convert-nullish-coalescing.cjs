#!/usr/bin/env node

/**
 * Nullish Coalescing Converter
 *
 * Converts `||` operators to `??` (nullish coalescing) using ESLint suggestions.
 *
 * Usage: node scripts/convert-nullish-coalescing.cjs <directory>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const directoryToProcess = process.argv[2] || 'src';

console.log(`Processing directory: ${directoryToProcess}`);
console.log('Fetching violations with ESLint...\n');

// Get ESLint results with suggestions
let eslintOutput;
try {
  eslintOutput = execSync(
    `npx eslint ${directoryToProcess} --format=json`,
    { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }
  );
} catch (error) {
  // ESLint exits with non-zero on errors, but we still get the output
  eslintOutput = error.stdout;
}

const eslintResults = JSON.parse(eslintOutput);

// Group violations by file
const fileViolations = new Map();

for (const result of eslintResults) {
  const violations = result.messages.filter(
    msg => msg.ruleId === '@typescript-eslint/prefer-nullish-coalescing' && msg.suggestions && msg.suggestions.length > 0
  );

  if (violations.length > 0 && result.source) {
    fileViolations.set(result.filePath, {
      source: result.source,
      violations: violations
    });
  }
}

console.log(`Found ${fileViolations.size} files with fixable violations\n`);

let totalFixed = 0;
let filesModified = 0;

// Process each file
for (const [filePath, data] of fileViolations.entries()) {
  const relPath = path.relative(process.cwd(), filePath);
  console.log(`Processing ${relPath}...`);
  console.log(`  ${data.violations.length} violations`);

  let source = data.source;
  let modifications = 0;

  // Sort violations by range start (descending) to apply fixes from end to start
  const sortedViolations = data.violations.sort((a, b) => {
    const aRange = a.suggestions[0].fix.range[0];
    const bRange = b.suggestions[0].fix.range[0];
    return bRange - aRange;
  });

  // Apply each fix
  for (const violation of sortedViolations) {
    const fix = violation.suggestions[0].fix;
    const [start, end] = fix.range;
    const replacement = fix.text;

    // Apply the fix by replacing the text at the specified range
    source = source.substring(0, start) + replacement + source.substring(end);
    modifications++;
  }

  if (modifications > 0) {
    fs.writeFileSync(filePath, source, 'utf-8');
    console.log(`  ✓ Fixed ${modifications} violations`);
    filesModified++;
    totalFixed += modifications;
  } else {
    console.log(`  ✗ No fixes applied`);
  }
}

console.log('\n' + '='.repeat(60));
console.log(`Conversion complete!`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total fixes: ${totalFixed}`);
console.log('='.repeat(60));

// Verify results
console.log('\nVerifying results...');
try {
  const newEslintOutput = execSync(
    `npx eslint ${directoryToProcess} --format=json`,
    { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }
  );

  const newResults = JSON.parse(newEslintOutput);
  const remainingViolations = newResults
    .flatMap(r => r.messages)
    .filter(m => m.ruleId === '@typescript-eslint/prefer-nullish-coalescing')
    .length;

  const originalCount = Array.from(fileViolations.values())
    .flatMap(d => d.violations)
    .length;

  console.log(`Violations before: ${originalCount}`);
  console.log(`Violations after: ${remainingViolations}`);
  console.log(`Violations eliminated: ${originalCount - remainingViolations}`);
  console.log(`Success rate: ${((originalCount - remainingViolations) / originalCount * 100).toFixed(1)}%`);
} catch (error) {
  // ESLint exits with non-zero, but we can still parse the output
  if (error.stdout) {
    try {
      const newResults = JSON.parse(error.stdout);
      const remainingViolations = newResults
        .flatMap(r => r.messages)
        .filter(m => m.ruleId === '@typescript-eslint/prefer-nullish-coalescing')
        .length;

      const originalCount = Array.from(fileViolations.values())
        .flatMap(d => d.violations)
        .length;

      console.log(`Violations before: ${originalCount}`);
      console.log(`Violations after: ${remainingViolations}`);
      console.log(`Violations eliminated: ${originalCount - remainingViolations}`);
      console.log(`Success rate: ${((originalCount - remainingViolations) / originalCount * 100).toFixed(1)}%`);
    } catch (parseError) {
      console.error('Error parsing verification results');
    }
  }
}
