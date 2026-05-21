#!/usr/bin/env tsx

/**
 * Script to fix remaining TypeScript errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

async function fixRemainingErrors() {
  console.log('🔍 Fixing remaining TypeScript errors...\n');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**'],
  });

  let fixedCount = 0;

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const original = content;

    // Fix 1: Remove duplicate errorMessage declarations
    // Find const errorMessage = ... patterns that appear multiple times
    const errorMessageMatches = content.match(/const errorMessage = [^;]+;/g) || [];
    if (errorMessageMatches.length > 1) {
      // Keep only the first occurrence in each scope
      const lines = content.split('\n');
      const seenInScope = new Map<number, boolean>();
      let scopeLevel = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Track scope
        scopeLevel += (line.match(/{/g) || []).length;
        scopeLevel -= (line.match(/}/g) || []).length;
        
        if (line.includes('const errorMessage =')) {
          const scopeKey = Math.floor(scopeLevel / 2) * 2; // Group by scope pairs
          if (seenInScope.has(scopeKey)) {
            // This is a duplicate in the same scope, rename it
            lines[i] = line.replace('const errorMessage', `const errorMsg${i}`);
            modified = true;
          } else {
            seenInScope.set(scopeKey, true);
          }
        }
        
        // Reset scope tracking when we exit a scope
        if (scopeLevel < Math.min(...Array.from(seenInScope.keys()))) {
          seenInScope.clear();
        }
      }
      
      if (modified) {
        content = lines.join('\n');
      }
    }

    // Fix 2: Replace logger.errorMessage with logger.error
    const loggerErrorPattern = /logger\.errorMessage\(/g;
    if (loggerErrorPattern.test(content)) {
      content = content.replace(loggerErrorPattern, 'logger.error(');
      modified = true;
    }

    // Fix 3: Replace toast.errorMessage with toast.error
    const toastErrorPattern = /toast\.errorMessage\(/g;
    if (toastErrorPattern.test(content)) {
      content = content.replace(toastErrorPattern, 'toast.error(');
      modified = true;
    }

    // Fix 4: Remove errorMessage from result objects
    const resultErrorPattern = /(\{[^}]*)(errorMessage:[^,}]+,?)([^}]*\})/g;
    if (resultErrorPattern.test(content)) {
      content = content.replace(resultErrorPattern, (match, before, errorPart, after) => {
        // Only remove if it's in a result object context
        if (match.includes('success:') || match.includes('result:') || match.includes('error:')) {
          return before + after;
        }
        return match;
      });
      modified = true;
    }

    // Fix 5: Fix type conversion errors - String to Error
    // Pattern: as Error when it should be as unknown as Error
    const stringAsErrorPattern = /String\([^)]+\)\s+as\s+Error/g;
    if (stringAsErrorPattern.test(content)) {
      content = content.replace(stringAsErrorPattern, (match) => {
        return match.replace(' as Error', ' as unknown as Error');
      });
      modified = true;
    }

    // Fix 6: Fix doubled instanceof checks
    // Pattern: error instanceof Error ? error instanceof Error ? 
    const doubledInstanceofPattern = /(\w+)\s+instanceof\s+Error\s*\?\s*\1\s+instanceof\s+Error\s*\?/g;
    if (doubledInstanceofPattern.test(content)) {
      content = content.replace(doubledInstanceofPattern, (match, varName) => {
        return `${varName} instanceof Error ?`;
      });
      modified = true;
    }

    // Fix 7: Fix variable used before assignment
    // Look for patterns where error is used in its own initialization
    const selfRefPattern = /const\s+(\w+)\s*=\s*[^;]*\1\s+instanceof\s+Error[^;]*\1[^;]*;/g;
    if (selfRefPattern.test(content)) {
      content = content.replace(selfRefPattern, (match, varName) => {
        // If it's trying to use itself, it's probably meant to use 'error' or 'err'
        if (varName === 'errorMessage' || varName.startsWith('errorMsg')) {
          return match.replace(new RegExp(`\\b${varName}\\s+instanceof`, 'g'), 'error instanceof')
                     .replace(new RegExp(`\\b${varName}\\.`, 'g'), 'error.')
                     .replace(new RegExp(`String\\(${varName}\\)`, 'g'), 'String(error)');
        }
        return match;
      });
      modified = true;
    }

    if (modified && content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
      fixedCount++;
    }
  }

  console.log(`\n📊 Fixed ${fixedCount} files`);
}

fixRemainingErrors().catch(console.error);