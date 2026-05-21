#!/usr/bin/env tsx

/**
 * Script to fix broken error handling patterns created by previous script
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

async function fixBrokenPatterns() {
  console.log('🔍 Finding and fixing broken error patterns...\n');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**'],
  });

  let fixedCount = 0;

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Pattern 1: Fix error.(error instanceof Error ? error.message : String(error))
    // Should be: error instanceof Error ? error.message : String(error)
    const pattern1 = /(\w+)\.(\(?\1\s+instanceof\s+Error\s*\?\s*\1\.\w+\s*:\s*String\(\1\)\)?)/g;
    const newContent1 = content.replace(pattern1, (match, varName, expression) => {
      modified = true;
      // Remove the leading dot and any parentheses that were added
      const cleaned = expression.replace(/^\(/, '').replace(/\)$/, '');
      return cleaned;
    });

    if (newContent1 !== content) {
      content = newContent1;
    }

    // Pattern 2: Fix logger.errorMessage(...) back to logger.error(...)
    const pattern2 = /logger\.errorMessage\(/g;
    const newContent2 = content.replace(pattern2, 'logger.error(');
    if (newContent2 !== content) {
      content = newContent2;
      modified = true;
    }

    // Pattern 3: Fix toast.errorMessage(...) back to toast.error(...)
    const pattern3 = /toast\.errorMessage\(/g;
    const newContent3 = content.replace(pattern3, 'toast.error(');
    if (newContent3 !== content) {
      content = newContent3;
      modified = true;
    }

    // Pattern 4: Fix result.(error instanceof Error) to result.error
    const pattern4 = /(\w+)\.\((\w+)\s+instanceof\s+Error\s*\?\s*\2\.\w+\s*:\s*String\(\2\)\)/g;
    const newContent4 = content.replace(pattern4, (match, obj, varName) => {
      modified = true;
      if (obj === varName) {
        // It's error.(error instanceof Error ? error.message : String(error))
        return `${varName} instanceof Error ? ${varName}.message : String(${varName})`;
      }
      // It's something like result.(error instanceof Error ? error.message : String(error))
      return `${obj}.error instanceof Error ? ${obj}.error.message : String(${obj}.error)`;
    });

    if (newContent4 !== content) {
      content = newContent4;
    }

    // Pattern 5: Fix doubled error checks
    // (error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error))
    const pattern5 = /\((\w+)\s+instanceof\s+Error\s*\?\s*\(\1\s+instanceof\s+Error\s*\?\s*\1\.\w+\s*:\s*String\(\1\)\)\s*:\s*String\(\1\)\)/g;
    const newContent5 = content.replace(pattern5, (match, varName) => {
      modified = true;
      return `${varName} instanceof Error ? ${varName}.message : String(${varName})`;
    });

    if (newContent5 !== content) {
      content = newContent5;
    }

    // Pattern 6: Fix errorMessage variable assignments
    const pattern6 = /const errorMessage = (\w+) instanceof Error \? \1\.message : String\(\1\);/g;
    if (pattern6.test(content)) {
      // This is correct, don't change it
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
      fixedCount++;
    }
  }

  console.log(`\n📊 Fixed ${fixedCount} files`);
}

fixBrokenPatterns().catch(console.error);