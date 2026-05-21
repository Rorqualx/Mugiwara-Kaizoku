#!/usr/bin/env bun
/**
 * Script to automatically fix unused variable violations
 * by prefixing them with underscore
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface UnusedVar {
  file: string;
  line: number;
  column: number;
  varName: string;
}

function getLintOutput(): string {
  try {
    execSync('bun run lint 2>&1', { encoding: 'utf-8', stdio: 'pipe' });
    return '';
  } catch (error: unknown) {
    // Lint will exit with code 1 when there are errors
    if (error && typeof error === 'object' && 'stdout' in error) {
      return String(error.stdout);
    }
    return '';
  }
}

function parseUnusedVars(lintOutput: string): UnusedVar[] {
  const unusedVars: UnusedVar[] = [];
  const lines = lintOutput.split('\n');
  let currentFile = '';

  for (const line of lines) {
    // Check if this is a file path
    if (line.startsWith('/')) {
      currentFile = line.trim();
      continue;
    }

    // Check if this is an unused var error
    if (line.includes('no-unused-vars') && line.includes('is defined but never used')) {
      const match = line.match(/^\s*(\d+):(\d+)\s+error\s+'([^']+)'/);
      if (match && currentFile) {
        const [, lineNum, column, varName] = match;
        unusedVars.push({
          file: currentFile,
          line: parseInt(lineNum ?? '0', 10),
          column: parseInt(column ?? '0', 10),
          varName: varName ?? ''
        });
      }
    }
  }

  return unusedVars;
}

function fixUnusedVar(unused: UnusedVar): boolean {
  try {
    const content = fs.readFileSync(unused.file, 'utf-8');
    const lines = content.split('\n');

    if (unused.line <= 0 || unused.line > lines.length) {
      return false;
    }

    const lineContent = lines[unused.line - 1];
    if (!lineContent) {
      return false;
    }

    // Different patterns for different contexts
    const patterns = [
      // Destructured variables: const { varName } = ...
      new RegExp(`(\\{[^}]*)(${unused.varName})(\\s*[,}])`),
      // Function parameters: function foo(varName) or (varName) =>
      new RegExp(`([,(]\\s*)(${unused.varName})(\\s*[,):=])`),
      // Variable declarations: const varName = ...
      new RegExp(`(const|let|var)(\\s+)(${unused.varName})(\\s*[=:])`),
      // Catch errors: catch (error)
      new RegExp(`(catch\\s*\\(\\s*)(${unused.varName})(\\s*\\))`),
      // Type parameters: <T>
      new RegExp(`(<[^>]*)(${unused.varName})(\\s*[,>])`),
    ];

    let newLine = lineContent;
    let replaced = false;

    for (const pattern of patterns) {
      if (pattern.test(newLine)) {
        newLine = newLine.replace(pattern, `$1_${unused.varName}$3`);
        replaced = true;
        break;
      }
    }

    if (replaced) {
      lines[unused.line - 1] = newLine;
      fs.writeFileSync(unused.file, lines.join('\n'), 'utf-8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error fixing ${unused.file}:${unused.line}:`, error);
    return false;
  }
}

function main(): void {
  console.log('Fetching lint output...');
  const lintOutput = getLintOutput();

  console.log('Parsing unused variables...');
  const unusedVars = parseUnusedVars(lintOutput);

  console.log(`Found ${unusedVars.length} unused variables`);

  // Group by file
  const byFile = new Map<string, UnusedVar[]>();
  for (const unused of unusedVars) {
    const existing = byFile.get(unused.file) ?? [];
    existing.push(unused);
    byFile.set(unused.file, existing);
  }

  let fixed = 0;
  let failed = 0;

  // Process each file (sort by line number descending to avoid offset issues)
  for (const [file, vars] of byFile.entries()) {
    vars.sort((a, b) => b.line - a.line);
    console.log(`\nProcessing ${path.basename(file)} (${vars.length} issues)...`);

    for (const unused of vars) {
      if (fixUnusedVar(unused)) {
        console.log(`  ✓ Fixed ${unused.varName} at line ${unused.line}`);
        fixed++;
      } else {
        console.log(`  ✗ Could not fix ${unused.varName} at line ${unused.line}`);
        failed++;
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${unusedVars.length}`);
}

main();
