#!/usr/bin/env node
/**
 * TS18048/TS2532 Null Safety Fixer
 * Week 4 Phase 1B+C - Null Safety Quick Wins
 *
 * Fixes:
 * - TS18048: 'x' is possibly 'undefined'
 * - TS2532: Object is possibly 'undefined'
 *
 * Solution: Add optional chaining (?.) for property/method access
 *
 * Target: 844 errors (270 TS18048 + 574 TS2532)
 * Expected: 60-70% reduction (~500-590 errors fixed)
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

interface NullSafetyError {
  file: string;
  line: number;
  column: number;
  variable: string;
  code: 'TS18048' | 'TS2532';
}

/**
 * Run type-check and capture output
 */
function runTypeCheck(): string {
  try {
    return execSync('pnpm type-check', {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe']
    }).toString();
  } catch (error: any) {
    return error.stdout + error.stderr;
  }
}

/**
 * Parse TS18048/TS2532 errors from type-check output
 */
function parseNullSafetyErrors(): Map<string, NullSafetyError[]> {
  console.log('📋 Parsing TS18048/TS2532 errors...\n');

  const output = runTypeCheck();
  const errorsByFile = new Map<string, NullSafetyError[]>();

  const lines = output.split('\n');

  for (const line of lines) {
    // TS18048: 'variable' is possibly 'undefined'
    const ts18048Match = line.match(/^(.+?)\((\d+),(\d+)\): error TS18048: '(.+?)' is possibly 'undefined'/);

    // TS2532: Object is possibly 'undefined'
    const ts2532Match = line.match(/^(.+?)\((\d+),(\d+)\): error TS2532: Object is possibly 'undefined'/);

    if (ts18048Match) {
      const [, file, lineStr, colStr, variable] = ts18048Match;
      const error: NullSafetyError = {
        file,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        variable,
        code: 'TS18048'
      };

      if (!errorsByFile.has(file)) {
        errorsByFile.set(file, []);
      }
      errorsByFile.get(file)!.push(error);
    } else if (ts2532Match) {
      const [, file, lineStr, colStr] = ts2532Match;
      const error: NullSafetyError = {
        file,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        variable: '', // Will be inferred from context
        code: 'TS2532'
      };

      if (!errorsByFile.has(file)) {
        errorsByFile.set(file, []);
      }
      errorsByFile.get(file)!.push(error);
    }
  }

  const totalErrors = Array.from(errorsByFile.values()).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Found ${totalErrors} null safety errors in ${errorsByFile.size} files\n`);

  return errorsByFile;
}

/**
 * Fix null safety errors in a single file
 *
 * Strategy:
 * 1. Find the property/method access at the error location
 * 2. Add optional chaining (.) before the access
 * 3. Handle edge cases (already has ?., nested access, etc.)
 */
function fixFile(filePath: string, errors: NullSafetyError[]): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let fixedCount = 0;

  // Sort errors by line (descending) and column (descending)
  const sortedErrors = errors.sort((a, b) => {
    if (a.line !== b.line) return b.line - a.line;
    return b.column - a.column;
  });

  for (const error of sortedErrors) {
    const lineIndex = error.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    let line = lines[lineIndex];
    const column = error.column - 1; // 0-indexed

    // Find the property/method access at or near the column
    // Look for patterns like:
    // - variable.property
    // - variable.method()
    // - variable[index]

    // Find the dot or bracket at/after the column
    const dotPos = line.indexOf('.', column);
    const bracketPos = line.indexOf('[', column);

    let accessPos = -1;
    let accessType: 'dot' | 'bracket' = 'dot';

    if (dotPos !== -1 && bracketPos !== -1) {
      // Both found, use the closer one
      if (dotPos < bracketPos) {
        accessPos = dotPos;
        accessType = 'dot';
      } else {
        accessPos = bracketPos;
        accessType = 'bracket';
      }
    } else if (dotPos !== -1) {
      accessPos = dotPos;
      accessType = 'dot';
    } else if (bracketPos !== -1) {
      accessPos = bracketPos;
      accessType = 'bracket';
    }

    if (accessPos === -1 || accessPos > column + 20) continue; // No access found nearby

    // Check if already has optional chaining before the access
    const beforeAccess = line.substring(0, accessPos);
    if (beforeAccess.endsWith('?.')) {
      continue; // Already has optional chaining
    }

    // Check if this is part of a nullish coalescing operator (??)
    if (beforeAccess.endsWith('?') && accessType === 'dot') {
      // This might be ?? operator, skip it
      continue;
    }

    // For dot access: variable.property → variable?.property
    if (accessType === 'dot') {
      const before = line.substring(0, accessPos);
      const after = line.substring(accessPos + 1); // +1 to skip the dot

      lines[lineIndex] = `${before}?.${after}`;
      fixedCount++;
    }
    // For bracket access: variable[index] → variable?.[index]
    else if (accessType === 'bracket') {
      const before = line.substring(0, accessPos);
      const after = line.substring(accessPos); // Keep the bracket

      lines[lineIndex] = `${before}?.${after}`;
      fixedCount++;
    }
  }

  // Write back if we made changes
  if (fixedCount > 0) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  return fixedCount;
}

/**
 * Get count of null safety errors
 */
function getErrorCount(): { total: number; ts18048: number; ts2532: number } {
  const output = runTypeCheck();
  const ts18048 = (output.match(/error TS18048:/g) || []).length;
  const ts2532 = (output.match(/error TS2532:/g) || []).length;
  return {
    total: ts18048 + ts2532,
    ts18048,
    ts2532
  };
}

/**
 * Check for syntax errors
 */
function checkSyntaxErrors(): number {
  const output = runTypeCheck();
  const count = (output.match(/error TS1\d{3}:/g) || []).length;
  return count;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const maxFiles = 10;

  console.log('🔧 TS18048/TS2532 Null Safety Fixer');
  console.log('===================================\n');

  if (testMode) {
    console.log(`🧪 TEST MODE: Limited to first ${maxFiles} files\n`);
  }

  // Get initial error count
  console.log('📊 Initial error count...');
  const initial = getErrorCount();
  console.log(`Initial errors: ${initial.total} (TS18048: ${initial.ts18048}, TS2532: ${initial.ts2532})\n`);

  if (initial.total === 0) {
    console.log('✅ No null safety errors found!');
    return;
  }

  // Parse errors
  const errorsByFile = parseNullSafetyErrors();

  if (errorsByFile.size === 0) {
    console.log('⚠️  No errors parsed');
    return;
  }

  // Select files to process
  const filesToProcess = testMode
    ? Array.from(errorsByFile.entries()).slice(0, maxFiles)
    : Array.from(errorsByFile.entries());

  if (testMode) {
    console.log(`Processing first ${filesToProcess.length} files out of ${errorsByFile.size} total\n`);
  }

  // Process files
  console.log('🔨 Applying fixes...\n');
  let totalFixed = 0;
  let filesModified = 0;

  for (const [file, errors] of filesToProcess) {
    const fixed = fixFile(file, errors);
    if (fixed > 0) {
      filesModified++;
      totalFixed += fixed;
      console.log(`  ✓ ${file}: ${fixed} fixes`);
    }
  }

  console.log(`\n✅ Applied ${totalFixed} fixes to ${filesModified} files\n`);

  // Check syntax errors
  console.log('🔍 Checking for syntax errors...');
  const syntaxErrors = checkSyntaxErrors();

  if (syntaxErrors > 0) {
    console.log(`❌ Found ${syntaxErrors} syntax errors!`);
    console.log('Please review changes and fix syntax errors manually.\n');
    return;
  }

  console.log('✅ No syntax errors detected\n');

  // Get final error count
  console.log('📊 Final error count...');
  const final = getErrorCount();
  const fixedTotal = initial.total - final.total;
  const fixedTS18048 = initial.ts18048 - final.ts18048;
  const fixedTS2532 = initial.ts2532 - final.ts2532;
  const percent = initial.total > 0 ? Math.round((fixedTotal / initial.total) * 100) : 0;

  console.log(`\nResults:`);
  console.log(`========`);
  console.log(`Initial:   ${initial.total} (TS18048: ${initial.ts18048}, TS2532: ${initial.ts2532})`);
  console.log(`Final:     ${final.total} (TS18048: ${final.ts18048}, TS2532: ${final.ts2532})`);
  console.log(`Fixed:     ${fixedTotal} (${percent}%)`);
  console.log(`  TS18048: ${fixedTS18048}`);
  console.log(`  TS2532:  ${fixedTS2532}\n`);

  if (testMode) {
    console.log('🧪 Test complete! Review changes with git diff, then run without --test flag.\n');
  } else {
    console.log('✅ Done! Review changes and commit if satisfied.\n');
  }
}

main().catch(console.error);
