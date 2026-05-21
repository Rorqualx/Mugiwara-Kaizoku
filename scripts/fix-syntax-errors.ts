#!/usr/bin/env tsx

/**
 * Script to fix remaining syntax errors from doubled conditionals
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

async function fixSyntaxErrors() {
  console.log('🔍 Fixing syntax errors from doubled conditionals...\n');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**'],
  });

  let fixedCount = 0;

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Pattern 1: Fix doubled conditional in single expression
    // error instanceof Error ? error.message : String(error) : String(error)
    // Should be: error instanceof Error ? error.message : String(error)
    const doubledConditionalPattern = /(\w+)\s+instanceof\s+Error\s*\?\s*(\1\.\w+)\s*:\s*String\(\1\)\s*:\s*[^,;}\n]+/g;
    
    if (doubledConditionalPattern.test(content)) {
      content = content.replace(doubledConditionalPattern, (match, varName, property) => {
        // Extract just the first conditional
        const mainConditional = `${varName} instanceof Error ? ${property} : String(${varName})`;
        return mainConditional;
      });
      modified = true;
    }

    // Pattern 2: Fix nested conditionals in object properties
    // errorMessage: error instanceof Error ? error.message : String(error) : String(error)
    const objectPropertyPattern = /(\w+):\s*(\w+)\s+instanceof\s+Error\s*\?\s*(\2\.\w+)\s*:\s*String\(\2\)\s*:\s*[^,}\n]+/g;
    
    if (objectPropertyPattern.test(content)) {
      content = content.replace(objectPropertyPattern, (match, prop, varName, property) => {
        return `${prop}: ${varName} instanceof Error ? ${property} : String(${varName})`;
      });
      modified = true;
    }

    // Pattern 3: Fix stacked conditionals
    // error instanceof Error ? error instanceof Error ? error.message : String(error) : other
    const stackedConditionalPattern = /(\w+)\s+instanceof\s+Error\s*\?\s*\1\s+instanceof\s+Error\s*\?\s*(\1\.\w+)\s*:\s*String\(\1\)\s*:\s*([^,;}\n]+)/g;
    
    if (stackedConditionalPattern.test(content)) {
      content = content.replace(stackedConditionalPattern, (match, varName, property, fallback) => {
        return `${varName} instanceof Error ? ${property} : ${fallback}`;
      });
      modified = true;
    }

    // Pattern 4: Fix malformed error message extractions
    // .error instanceof Error ? updateSettings.error.message : String(updateSettings.error)
    // Where it was incorrectly transformed
    const malformedPropertyAccess = /\.\((\w+)\s+instanceof\s+Error\s*\?\s*\1\.\w+\s*:\s*String\(\1\)\)/g;
    
    if (malformedPropertyAccess.test(content)) {
      content = content.replace(malformedPropertyAccess, (match, varName) => {
        return `.error instanceof Error ? ${varName}.error.message : String(${varName}.error)`;
      });
      modified = true;
    }

    // Pattern 5: Clean up errorMsg{number} variables that reference undefined 'error'
    // const errorMsg123 = error instanceof Error ? error.message : String(error);
    // Where 'error' doesn't exist in scope
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/const errorMsg\d+\s*=/.test(line)) {
        // Check if this line references 'error' but error doesn't exist
        if (line.includes('error instanceof Error') && !line.includes('catch')) {
          // Look for the actual error variable in nearby lines
          let actualErrorVar = null;
          // Check previous 5 lines for catch block
          for (let j = Math.max(0, i - 5); j < i; j++) {
            const prevLine = lines[j];
            const catchMatch = prevLine.match(/catch\s*\(([^:]+)(?::\s*\w+)?\)/);
            if (catchMatch) {
              actualErrorVar = catchMatch[1].trim();
              break;
            }
          }
          
          if (actualErrorVar && actualErrorVar !== 'error') {
            lines[i] = line.replace(/\berror\b/g, actualErrorVar);
            modified = true;
          } else if (!actualErrorVar) {
            // No error variable found, this line is probably dead code, comment it out
            lines[i] = '// ' + line;
            modified = true;
          }
        }
      }
    }
    
    if (modified) {
      content = lines.join('\n');
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
      fixedCount++;
    }
  }

  console.log(`\n📊 Fixed ${fixedCount} files`);
}

fixSyntaxErrors().catch(console.error);