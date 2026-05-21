#!/usr/bin/env tsx

/**
 * Final critical fixes for remaining syntax errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

async function finalCriticalFixes() {
  console.log('🔍 Final critical fixes for syntax errors...\n');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**'],
  });

  let fixedCount = 0;

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Fix malformed object property access patterns
    // Pattern: obj.(error instanceof Error ? error.message : String(error))
    // Should be: obj.error instanceof Error ? obj.error.message : String(obj.error)
    const malformedPattern = /(\w+(?:\.\w+)*)\.\((\w+)\s+instanceof\s+Error\s*\?\s*\2\.\w+\s*:\s*String\(\2\)\)/g;
    
    content = content.replace(malformedPattern, (match, objPath, varName) => {
      // Check if this is an actual error property access
      if (varName === 'error' || varName === 'err') {
        modified = true;
        return `${objPath}.error instanceof Error ? ${objPath}.error.message : String(${objPath}.error)`;
      }
      return match;
    });

    // Fix state.error patterns specifically
    const stateErrorPattern = /state\.\(error\s+instanceof\s+Error\s*\?\s*error\.message\s*:\s*String\(error\)\)/g;
    if (stateErrorPattern.test(content)) {
      content = content.replace(stateErrorPattern, 
        'state.error instanceof Error ? state.error.message : String(state.error)');
      modified = true;
    }

    // Fix this.state.error patterns
    const thisStatePattern = /this\.state\.\(error\s+instanceof\s+Error\s*\?\s*error\.message\s*:\s*String\(error\)\)/g;
    if (thisStatePattern.test(content)) {
      content = content.replace(thisStatePattern, 
        'this.state.error instanceof Error ? this.state.error.message : String(this.state.error)');
      modified = true;
    }

    // Fix test expectation patterns
    // Pattern: expect(result).(error instanceof Error ? error.message : String(error))
    const expectPattern = /expect\(([^)]+)\)\.\(error\s+instanceof\s+Error\s*\?\s*error\.message\s*:\s*String\(error\)\)/g;
    if (expectPattern.test(content)) {
      content = content.replace(expectPattern, (match, result) => {
        modified = true;
        return `expect(${result}.error instanceof Error ? ${result}.error.message : String(${result}.error))`;
      });
    }

    // Fix notification patterns
    // Pattern: notifications.show({ ... }).(error instanceof Error ? error.message : String(error))
    const notificationPattern = /notifications\.show\([^)]+\)\.\(error\s+instanceof\s+Error/g;
    if (notificationPattern.test(content)) {
      // This is likely inside the show() call, fix the property
      content = content.replace(
        /message:\s*\w+\.\(error\s+instanceof\s+Error\s*\?\s*error\.message\s*:\s*String\(error\)\)/g,
        (match) => {
          const objMatch = match.match(/message:\s*(\w+)\./)?.[1];
          if (objMatch) {
            modified = true;
            return `message: ${objMatch}.error instanceof Error ? ${objMatch}.error.message : String(${objMatch}.error)`;
          }
          return match;
        }
      );
    }

    // Fix broken error variable references
    // Pattern: const errorMessage = error instanceof Error
    // Where error doesn't exist but there's a caught error with different name
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for broken object property access
      if (line.match(/\.\(\w+\s+instanceof\s+Error/)) {
        // Find what object this is
        const beforeDot = line.substring(0, line.indexOf('.('));
        const lastWord = beforeDot.match(/(\w+)$/)?.[1];
        
        if (lastWord) {
          // Replace the malformed pattern
          lines[i] = line.replace(
            /\.\((\w+)\s+instanceof\s+Error\s*\?\s*\1\.(\w+)\s*:\s*String\(\1\)\)/g,
            (match, varName, prop) => {
              modified = true;
              // Assume the property is 'error' if varName is 'error'
              if (varName === 'error') {
                return `.error instanceof Error ? ${lastWord}.error.${prop} : String(${lastWord}.error)`;
              }
              return match;
            }
          );
        }
      }
    }
    
    if (modified) {
      content = lines.join('\n');
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
      fixedCount++;
    }
  }

  console.log(`\n📊 Fixed ${fixedCount} files`);
}

finalCriticalFixes().catch(console.error);