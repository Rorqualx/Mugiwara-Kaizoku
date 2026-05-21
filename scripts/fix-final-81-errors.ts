#!/usr/bin/env tsx

/**
 * Fix the final 81 TypeScript errors - comprehensive cleanup
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

async function fixFinal81Errors() {
  console.log('🔧 Fixing final 81 TypeScript errors...\n');
  let filesFixed = 0;

  // Get all TypeScript files
  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**'],
  });

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const original = content;

    // 1. Fix malformed instanceof expressions
    // Pattern: errorMessage instanceof Error should be error instanceof Error
    content = content.replace(/\berrorMessage\s+instanceof\s+Error/g, 'error instanceof Error');

    // 2. Fix logger.String patterns
    // These are malformed - should be logger.error
    content = content.replace(/logger\.String\(/g, 'logger.error(');

    // 3. Fix malformed error handling patterns
    // Pattern: (error instanceof Error ? error.message : String(error)) = something
    content = content.replace(/\(error instanceof Error \? error\.message : String\(error\)\)\s*=\s*[^;]+;/g,
      '// Removed malformed assignment');

    // Pattern: (errorMessage instanceof Error ? errorMessage.message : String(errorMessage)) = something
    content = content.replace(/\(errorMessage instanceof Error \? errorMessage\.message : String\(errorMessage\)\)\s*=\s*[^;]+;/g,
      '// Removed malformed assignment');

    // 4. Fix undefined errorMessage usage
    // Look for catch blocks where errorMessage is used but not defined
    content = content.replace(/catch\s*\((\w+)(?::\s*unknown)?\)\s*{([^}]*)\berrorMessage\b(?!\s*=)([^}]*)/g,
      (match, errorVar, before, after) => {
        // Check if errorMessage is defined in this block
        if (!before.includes('const errorMessage') && !before.includes('let errorMessage')) {
          // Replace errorMessage with proper error handling
          const newBefore = before.replace(/\berrorMessage\b/g,
            `(${errorVar} instanceof Error ? ${errorVar}.message : String(${errorVar}))`);
          const newAfter = after.replace(/\berrorMessage\b/g,
            `(${errorVar} instanceof Error ? ${errorVar}.message : String(${errorVar}))`);
          return `catch (${errorVar}: unknown) {${newBefore}(${errorVar} instanceof Error ? ${errorVar}.message : String(${errorVar}))${newAfter}`;
        }
        return match;
      });

    // 5. Fix malformed error variable names
    // Pattern: catch (String(fetchError))
    content = content.replace(/catch\s*\(String\((\w+)\)\)/g, 'catch ($1)');

    // 6. Fix .errorMessage property access on logger
    content = content.replace(/(\w+)\.errorMessage\(/g, (match, obj) => {
      if (obj === 'logger' || obj === 'console') {
        return `${obj}.error(`;
      }
      return match;
    });

    // 7. Fix malformed ternary in catch blocks
    // Pattern: error.(error instanceof Error ? error.message : String(error))
    content = content.replace(/error\.\(error instanceof Error[^)]+\)/g,
      '(error instanceof Error ? error.message : String(error))');

    // 8. Fix duplicate error handling patterns
    const duplicatePattern = /const errorMessage = error instanceof Error \? error\.message : String\(error\);[\s]*const errorMessage/g;
    content = content.replace(duplicatePattern,
      'const errorMessage = error instanceof Error ? error.message : String(error);\nconst errorMessage2');

    // 9. Fix malformed variable declarations
    // Pattern: const errorMsg586 = ... (generated names)
    content = content.replace(/const errorMsg\d+ = error instanceof Error[^;]+;/g, '');

    // 10. Fix SearchResult[].error patterns
    content = content.replace(/SearchResult\[\]\.error/g, '(results as any).error');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
      filesFixed++;
    }
  }

  console.log(`\n📊 Fixed ${filesFixed} files`);
}

// Run the fixes
fixFinal81Errors().catch(console.error);