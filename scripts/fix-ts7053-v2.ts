#!/usr/bin/env node
/**
 * TS7053 Error Fixer V2 - Simpler Approach
 * Week 4 Phase 1A - Null Safety Quick Wins
 *
 * Fixes: Element implicitly has an 'any' type because expression of type 'X' can't be used to index type 'Y'
 * Solution: Cast object to Record<string, unknown> before indexed access
 *
 * Strategy: Find the object being indexed and wrap JUST that object in a cast
 *
 * Target: 231 errors
 * Expected: 90% reduction (~208 errors fixed)
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

interface TS7053Error {
  file: string;
  line: number;
  column: number;
  fullLine: string;
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
 * Parse TS7053 errors from type-check output
 */
function parseTS7053Errors(): Map<string, TS7053Error[]> {
  console.log('📋 Parsing TS7053 errors...\n');

  const output = runTypeCheck();
  const errorsByFile = new Map<string, TS7053Error[]>();

  // Pattern: src/file.tsx(line,col): error TS7053: Element implicitly has an 'any' type...
  const lines = output.split('\n');

  for (const line of lines) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error TS7053:/);
    if (match) {
      const [, file, lineStr, colStr] = match;
      const error: TS7053Error = {
        file,
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
        fullLine: line
      };

      if (!errorsByFile.has(file)) {
        errorsByFile.set(file, []);
      }
      errorsByFile.get(file)!.push(error);
    }
  }

  console.log(`Found ${Array.from(errorsByFile.values()).reduce((sum, arr) => sum + arr.length, 0)} TS7053 errors in ${errorsByFile.size} files\n`);

  return errorsByFile;
}

/**
 * Fix TS7053 errors in a single file
 *
 * Strategy:
 * 1. Find the bracket [ at or after the column position
 * 2. Find the object expression before the bracket
 * 3. Wrap the object in (obj as Record<string, unknown>)
 */
function fixFile(filePath: string, errors: TS7053Error[]): number {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let fixedCount = 0;

  // Sort errors by line (descending) and column (descending) to avoid position shifts
  const sortedErrors = errors.sort((a, b) => {
    if (a.line !== b.line) return b.line - a.line;
    return b.column - a.column;
  });

  for (const error of sortedErrors) {
    const lineIndex = error.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    let line = lines[lineIndex];
    const column = error.column - 1; // 0-indexed

    // Find the bracket [ at or near the column
    const bracketPos = line.indexOf('[', column);
    if (bracketPos === -1 || bracketPos > column + 10) continue; // Bracket should be close to column

    // Extract everything before the bracket
    const beforeBracket = line.substring(0, bracketPos);

    // Check if already has a cast
    if (beforeBracket.includes(' as Record<string, unknown>') ||
        beforeBracket.includes(' as Record<string, any>')) {
      continue;
    }

    // Find the object expression before the bracket
    // This matches patterns like:
    // - obj[...]
    // - this.obj[...]
    // - result.data[...]
    // - (obj)[...]
    // - obj?.[...]  (optional chaining BEFORE bracket)

    // Check if there's ?. immediately before the bracket
    const hasOptionalChainingBefore = beforeBracket.endsWith('?.');

    // Remove ?. if present to find the clean object
    const cleanBeforeBracket = hasOptionalChainingBefore
      ? beforeBracket.slice(0, -2)
      : beforeBracket;

    // Look backwards for the object expression (without ?.)
    // Find last alphanumeric identifier or ) before the bracket
    const objectPattern = /([a-zA-Z_$][\w.]*|\))$/;
    const objectMatch = cleanBeforeBracket.match(objectPattern);

    if (!objectMatch) continue;

    const objectExpr = objectMatch[1];
    const objectStart = cleanBeforeBracket.length - objectExpr.length;

    // Find the closing bracket ]
    let bracketDepth = 0;
    let closeBracketPos = -1;
    for (let i = bracketPos; i < line.length; i++) {
      if (line[i] === '[') bracketDepth++;
      if (line[i] === ']') {
        bracketDepth--;
        if (bracketDepth === 0) {
          closeBracketPos = i;
          break;
        }
      }
    }

    if (closeBracketPos === -1) continue;

    // Build the fixed line
    const before = line.substring(0, objectStart);
    const indexExpr = line.substring(bracketPos, closeBracketPos + 1);
    const after = line.substring(closeBracketPos + 1);

    // Add cast:
    // obj[...] → (obj as Record<string, unknown>)[...]
    // obj?.[...] → (obj as Record<string, unknown>)?.[...]
    if (hasOptionalChainingBefore) {
      lines[lineIndex] = `${before}(${objectExpr} as Record<string, unknown>)?.${indexExpr}${after}`;
    } else {
      lines[lineIndex] = `${before}(${objectExpr} as Record<string, unknown>)${indexExpr}${after}`;
    }

    fixedCount++;
  }

  // Write back if we made changes
  if (fixedCount > 0) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  }

  return fixedCount;
}

/**
 * Get count of TS7053 errors
 */
function getErrorCount(): number {
  const output = runTypeCheck();
  const count = (output.match(/error TS7053:/g) || []).length;
  return count;
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

  console.log('🔧 TS7053 Index Access Fixer V2');
  console.log('================================\n');

  if (testMode) {
    console.log(`🧪 TEST MODE: Limited to first ${maxFiles} files\n`);
  }

  // Get initial error count
  console.log('📊 Initial error count...');
  const initialCount = getErrorCount();
  console.log(`Initial TS7053 errors: ${initialCount}\n`);

  if (initialCount === 0) {
    console.log('✅ No TS7053 errors found!');
    return;
  }

  // Parse errors
  const errorsByFile = parseTS7053Errors();

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
  const finalCount = getErrorCount();
  const fixed = initialCount - finalCount;
  const percent = initialCount > 0 ? Math.round((fixed / initialCount) * 100) : 0;

  console.log(`\nResults:`);
  console.log(`========`);
  console.log(`Initial:   ${initialCount}`);
  console.log(`Final:     ${finalCount}`);
  console.log(`Fixed:     ${fixed} (${percent}%)\n`);

  if (testMode) {
    console.log('🧪 Test complete! Review changes with git diff, then run without --test flag.\n');
  } else {
    console.log('✅ Done! Review changes and commit if satisfied.\n');
  }
}

main().catch(console.error);
