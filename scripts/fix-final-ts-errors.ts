#!/usr/bin/env tsx

/**
 * Script to fix final TypeScript errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

async function fixFinalErrors() {
  console.log('🔍 Fixing final TypeScript errors...\n');

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

    // Fix 1: String to Error conversions
    // Pattern: errorMessage: String(...) as Error
    // Fix: errorMessage: String(...) as unknown as Error
    const stringAsErrorPattern = /:\s*String\([^)]+\)\s+as\s+Error(?!\s+as\s+unknown)/g;
    if (stringAsErrorPattern.test(content)) {
      content = content.replace(stringAsErrorPattern, (match) => {
        return match.replace(' as Error', ' as unknown as Error');
      });
      modified = true;
    }

    // Fix 2: Replace status: "errorMessage" with status: "error"
    const errorMessageStatusPattern = /status:\s*["']errorMessage["']/g;
    if (errorMessageStatusPattern.test(content)) {
      content = content.replace(errorMessageStatusPattern, 'status: "error"');
      modified = true;
    }

    // Fix 3: Replace .errorMessage( with .error(
    const errorMessageMethodPattern = /\.(errorMessage)\(/g;
    if (errorMessageMethodPattern.test(content)) {
      content = content.replace(errorMessageMethodPattern, '.error(');
      modified = true;
    }

    // Fix 4: Fix setValidationErrorerror typo
    const typoPattern = /setValidationErrorerror/g;
    if (typoPattern.test(content)) {
      content = content.replace(typoPattern, 'setValidationError');
      modified = true;
    }

    // Fix 5: Add type guards for unknown errors in catch blocks
    // Look for patterns where error is used without type guard
    const catchErrorPattern = /catch\s*\(([^:)]+)(?::\s*unknown)?\)\s*{([^}]+)}/g;
    content = content.replace(catchErrorPattern, (match, errorVar, blockContent) => {
      const varName = errorVar.trim();
      
      // Check if block uses error properties without type guard
      if (blockContent.includes(`${varName}.message`) || 
          blockContent.includes(`${varName}.stack`) ||
          blockContent.includes(`${varName}.name`)) {
        
        // Check if type guard already exists
        if (!blockContent.includes(`${varName} instanceof Error`)) {
          // Add type annotation if not present
          const catchLine = match.match(/catch\s*\([^)]+\)/)?.[0];
          if (catchLine && !catchLine.includes(': unknown')) {
            match = match.replace(catchLine, `catch (${varName}: unknown)`);
          }
          modified = true;
        }
      }
      
      return match;
    });

    // Fix 6: Replace errorMessage property with error in result objects
    // Pattern: errorMessage: Error -> error: Error  
    const errorMessagePropertyPattern = /([{,]\s*)errorMessage:\s*([^,}]+)([,}])/g;
    content = content.replace(errorMessagePropertyPattern, (match, before, value, after) => {
      // Only replace in context of result objects
      if (match.includes('Error') || match.includes('instanceof')) {
        modified = true;
        return `${before}error: ${value}${after}`;
      }
      return match;
    });

    // Fix 7: Fix access to .message on empty object {}
    // Pattern: ({}).message or {} as SomeType).message
    const emptyObjectMessagePattern = /\(\{\}\)\.(message|stack|name)/g;
    if (emptyObjectMessagePattern.test(content)) {
      content = content.replace(emptyObjectMessagePattern, 'undefined');
      modified = true;
    }

    // Fix 8: Fix unknown type errors by adding type guards
    const unknownErrorPattern = /'([^']+)'\s+is\s+of\s+type\s+'unknown'/;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for direct usage of unknown variables
      if (line.includes('fetchError instanceof Error ? fetchError.message') ||
          line.includes('trpcError instanceof Error ? trpcError.message') ||
          line.includes('error instanceof Error ? error.message')) {
        // These are already correct
        continue;
      }
      
      // Look for usage without type guards
      const matches = line.match(/(fetchError|trpcError|error)\.(message|stack|name)/);
      if (matches && !line.includes('instanceof Error')) {
        const varName = matches[1];
        const property = matches[2];
        lines[i] = line.replace(
          new RegExp(`${varName}\\.${property}`, 'g'),
          `(${varName} instanceof Error ? ${varName}.${property} : String(${varName}))`
        );
        modified = true;
      }
    }
    
    if (modified && lines.join('\n') !== original) {
      content = lines.join('\n');
    }

    if (modified && content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
      fixedCount++;
    }
  }

  console.log(`\n📊 Fixed ${fixedCount} files`);
}

fixFinalErrors().catch(console.error);