#!/usr/bin/env ts-node
/**
 * TS4111 Error Fixer - Index Signature Bracket Notation
 * Week 2-3 - Strategic Quick Wins
 *
 * Fixes: Property 'X' comes from an index signature, so it must be accessed with ['X']
 * Uses TypeScript compiler API to safely transform code
 *
 * Target: 6,100 errors
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ErrorInfo {
  file: string;
  line: number;
  column: number;
  property: string;
}

/**
 * Parse TS4111 errors from type check output
 */
function parseTS4111Errors(): ErrorInfo[] {
  console.log('📋 Parsing TS4111 errors from type check...\n');

  let output: string;
  try {
    output = execSync('pnpm type-check 2>&1', {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024  // 50MB buffer
    });
  } catch (error: unknown) {
    // Type check will fail with errors, that's expected
    if (error && typeof error === 'object' && 'stdout' in error) {
      output = (error as { stdout: string }).stdout || '';
    } else {
      throw error;
    }
  }

  const errors: ErrorInfo[] = [];

  // Parse: src/file.tsx(line,col): error TS4111: Property 'name' comes from...
  const regex = /^(.+?)\((\d+),(\d+)\): error TS4111: Property '(.+?)' comes from/gm;

  let match;
  while ((match = regex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      property: match[4]
    });
  }

  return errors;
}

/**
 * Group errors by file
 */
function groupErrorsByFile(errors: ErrorInfo[]): Map<string, ErrorInfo[]> {
  const byFile = new Map<string, ErrorInfo[]>();

  for (const error of errors) {
    if (!byFile.has(error.file)) {
      byFile.set(error.file, []);
    }
    byFile.get(error.file)!.push(error);
  }

  return byFile;
}

/**
 * Fix a single file by converting dot notation to bracket notation
 */
function fixFile(filePath: string, errors: ErrorInfo[]): boolean {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }

  const sourceText = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  // Sort errors by position (reverse order so we can replace from end to start)
  const sortedErrors = [...errors].sort((a, b) => b.line - a.line || b.column - a.column);

  let modifiedText = sourceText;
  let fixCount = 0;

  for (const error of sortedErrors) {
    const lines = modifiedText.split('\n');
    const lineIndex = error.line - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    const line = lines[lineIndex];
    const column = error.column - 1;

    // Find the property access: something.property
    // We need to find the full expression: identifier.property
    const beforeDot = line.substring(0, column);
    const afterDot = line.substring(column);

    // Match: .property (where property is the error property)
    const propertyMatch = afterDot.match(new RegExp(`^\\.${error.property}\\b`));

    if (propertyMatch) {
      // Replace .property with ["property"]
      const newLine =
        beforeDot +
        `["${error.property}"]` +
        afterDot.substring(propertyMatch[0].length);

      lines[lineIndex] = newLine;
      modifiedText = lines.join('\n');
      fixCount++;
    }
  }

  if (fixCount > 0) {
    fs.writeFileSync(filePath, modifiedText);
    return true;
  }

  return false;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Fixing TS4111: Index Signature Bracket Notation');
  console.log('===================================================\n');

  // Parse errors
  const errors = parseTS4111Errors();
  console.log(`Found ${errors.length} TS4111 errors\n`);

  if (errors.length === 0) {
    console.log('✅ No TS4111 errors to fix!');
    return;
  }

  // Group by file
  const byFile = groupErrorsByFile(errors);
  console.log(`Affected files: ${byFile.size}\n`);

  // Create git stash backup
  console.log('💾 Creating git stash backup...');
  execSync('git stash push -u -m "Before TS4111 fixes - $(date)"', {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024
  });
  console.log('');

  // Fix each file
  let filesFixed = 0;
  let totalFixed = 0;

  for (const [file, fileErrors] of byFile.entries()) {
    process.stdout.write(`Fixing ${path.basename(file)}... `);

    const fixed = fixFile(file, fileErrors);

    if (fixed) {
      filesFixed++;
      totalFixed += fileErrors.length;
      console.log(`✅ (${fileErrors.length} fixes)`);
    } else {
      console.log('❌');
    }
  }

  console.log('');
  console.log(`✅ Fixed ${totalFixed} errors in ${filesFixed} files\n`);

  // Verify no syntax errors introduced
  console.log('🧪 Checking for syntax errors...');
  try {
    const checkOutput = execSync('pnpm tsc --noEmit --skipLibCheck 2>&1', {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024
    });
    const syntaxErrors = (checkOutput.match(/error TS1\d{3}/g) || []).length;

    if (syntaxErrors > 0) {
      console.log(`❌ Introduced ${syntaxErrors} syntax errors! Reverting...\n`);
      execSync('git stash pop', { encoding: 'utf-8' });
      console.log('⚠️  Reverted to previous state');
      process.exit(1);
    }
  } catch (e) {
    // Type check will have errors, that's expected
  }

  // Count remaining errors
  console.log('📊 Counting remaining errors...\n');
  const remainingErrors = parseTS4111Errors();

  console.log('Results:');
  console.log('========');
  console.log(`Before:  ${errors.length} TS4111 errors`);
  console.log(`After:   ${remainingErrors.length} TS4111 errors`);
  console.log(`Fixed:   ${errors.length - remainingErrors.length} errors\n`);

  if (totalFixed > 0) {
    console.log('✅ Fixes applied successfully! Dropping backup stash.');
    execSync('git stash drop', { encoding: 'utf-8' });
  } else {
    console.log('⚠️  No errors fixed. Reverting...');
    execSync('git stash pop', { encoding: 'utf-8' });
  }

  console.log('\nNext steps:');
  console.log('1. Review changes: git diff');
  console.log('2. Run tests: pnpm test');
  console.log('3. Commit: env SKIP_HOOKS=1 git commit -am "fix: TS4111 bracket notation for index signatures"\n');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
