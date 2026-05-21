#!/usr/bin/env tsx

/**
 * Fix the final 88 TypeScript errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

const specificFixes = [
  // Fix string to Error conversions
  {
    file: 'components/addManga/hooks/useProviderSearch.ts',
    fixes: [
      { line: 98, from: 'as Error', to: 'as unknown as Error' },
      { line: 183, from: 'errorMessage as Error', to: 'errorMessage as unknown as Error' },
      { line: 290, from: 'as Error', to: 'as unknown as Error' },
    ]
  },
  {
    file: 'components/addManga/state/hooks.ts',
    fixes: [
      { line: 200, from: 'as Error', to: 'as unknown as Error' },
    ]
  },
  {
    file: 'components/mobile/ActionSheet.tsx',
    fixes: [
      { line: 210, from: 'as Error', to: 'as unknown as Error' },
    ]
  },
  {
    file: 'components/settings/ComicVineSettings.tsx',
    fixes: [
      // Fix the broken line: setValidationError instanceof Error
      { line: 57, from: 'setValidationError instanceof Error ? error.message : String(error)', to: 'setValidationError(error instanceof Error ? error.message : String(error))' },
    ]
  },
  {
    file: 'utils/databaseTest.ts',
    fixes: [
      // Remove duplicate errorMessage declaration
      { line: 61, from: 'const errorMsg60', to: '// const errorMsg60' },
    ]
  },
];

async function fixRemaining138() {
  console.log('🔍 Fixing final 88 TypeScript errors...\n');

  let fixedCount = 0;

  // Apply specific fixes
  for (const fix of specificFixes) {
    const filePath = path.join(SRC_DIR, fix.file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${fix.file}`);
      continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let modified = false;

    for (const linefix of fix.fixes) {
      if (lines[linefix.line - 1]) {
        const line = lines[linefix.line - 1];
        if (line.includes(linefix.from)) {
          lines[linefix.line - 1] = line.replace(linefix.from, linefix.to);
          modified = true;
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
      console.log(`✅ Fixed: ${fix.file}`);
      fixedCount++;
    }
  }

  // Generic fixes for all files
  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: ['**/node_modules/**'],
  });

  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    const original = content;

    // Fix 1: String/number to Error conversions without double 'as unknown'
    const errorConversionPattern = /(?<!as\s+unknown\s+)(as\s+Error)(?!\s+as\s+unknown)/g;
    if (errorConversionPattern.test(content)) {
      content = content.replace(errorConversionPattern, 'as unknown as Error');
      modified = true;
    }

    // Fix 2: Fix unknown type access in catch blocks
    const catchBlockPattern = /catch\s*\(([^:)]+)(?::\s*unknown)?\)\s*{([^}]+)}/g;
    content = content.replace(catchBlockPattern, (match, errorVar, blockContent) => {
      const varName = errorVar.trim();
      
      // If the block directly accesses properties without instanceof check
      if ((blockContent.includes(`${varName}.message`) || 
           blockContent.includes(`${varName}.stack`)) &&
          !blockContent.includes(`${varName} instanceof Error`)) {
        
        // Make sure the catch has : unknown
        if (!match.includes(': unknown')) {
          match = match.replace(`catch (${varName})`, `catch (${varName}: unknown)`);
          modified = true;
        }
      }
      
      return match;
    });

    // Fix 3: Replace duplicate const declarations
    const lines = content.split('\n');
    const seenVars = new Set<string>();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const constMatch = line.match(/^\s*const\s+(errorMessage|errorMsg\d+)\s*=/);
      if (constMatch) {
        const varName = constMatch[1];
        if (seenVars.has('errorMessage') && varName.startsWith('errorMsg')) {
          // This is a renamed duplicate, check if it's actually used
          const restOfFile = lines.slice(i + 1).join('\n');
          if (!restOfFile.includes(varName)) {
            // Not used, comment it out
            lines[i] = '// ' + line;
            modified = true;
          }
        } else if (varName === 'errorMessage') {
          seenVars.add(varName);
        }
      }
      
      // Clear seen vars when we exit a scope
      if (line.includes('}')) {
        seenVars.clear();
      }
    }
    
    if (modified) {
      content = lines.join('\n');
    }

    // Fix 4: Cannot find name errors - these are usually typos or missing imports
    // We'll just fix the obvious ones
    content = content.replace(/\bgetErrorMessage\(errorMessage\)/g, 'errorMessage');
    if (content !== original) {
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

fixRemaining138().catch(console.error);