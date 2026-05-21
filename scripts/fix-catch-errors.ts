#!/usr/bin/env tsx

/**
 * Script to safely fix error handling in catch clauses
 * This is the safest type violation to fix as errors should always be 'unknown'
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';

const SRC_DIR = path.join(process.cwd(), 'src');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

interface FixResult {
  file: string;
  fixes: number;
  changes: Array<{ before: string; after: string; line: number }>;
}

const stats = {
  filesChecked: 0,
  filesFixed: 0,
  totalFixes: 0,
  errors: [] as string[],
};

/**
 * Transform catch clauses to use 'unknown' type
 */
function transformCatchClauses(sourceText: string, fileName: string): string | null {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  const fixes: Array<{ start: number; end: number; replacement: string }> = [];

  function visit(node: ts.Node) {
    // Check for catch clauses
    if (ts.isCatchClause(node)) {
      const variableDeclaration = node.variableDeclaration;

      if (variableDeclaration) {
        const errorName = variableDeclaration.name?.getText(sourceFile) || 'error';

        // Check if it already has a type annotation
        if (!variableDeclaration.type) {
          // No type annotation, it's implicitly any
          const start = variableDeclaration.getStart(sourceFile);
          const end = variableDeclaration.getEnd();
          const originalText = sourceText.substring(start, end);

          // Add ': unknown' type annotation
          const replacement = `${errorName}: unknown`;

          fixes.push({
            start,
            end,
            replacement
          });

          if (VERBOSE) {
            console.log(`📝 ${fileName}:`);
            console.log(`   Line ${sourceFile.getLineAndCharacterOfPosition(start).line + 1}`);
            console.log(`   OLD: catch (${originalText})`);
            console.log(`   NEW: catch (${replacement})`);
          }
        } else if (variableDeclaration.type) {
          const typeText = variableDeclaration.type.getText(sourceFile);

          // Check if it's typed as 'any'
          if (typeText === 'any') {
            const typeNode = variableDeclaration.type;
            const start = typeNode.getStart(sourceFile);
            const end = typeNode.getEnd();

            fixes.push({
              start,
              end,
              replacement: 'unknown'
            });

            if (VERBOSE) {
              console.log(`📝 ${fileName}:`);
              console.log(`   Line ${sourceFile.getLineAndCharacterOfPosition(start).line + 1}`);
              console.log(`   OLD: catch (${errorName}: any)`);
              console.log(`   NEW: catch (${errorName}: unknown)`);
            }
          }
        }
      } else {
        // Catch clause without variable (catch { ... })
        // This is fine, no changes needed
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (fixes.length === 0) {
    return null;
  }

  // Apply fixes in reverse order to maintain positions
  let result = sourceText;
  fixes.sort((a, b) => b.start - a.start);

  for (const fix of fixes) {
    result = result.substring(0, fix.start) + fix.replacement + result.substring(fix.end);
  }

  stats.totalFixes += fixes.length;
  return result;
}

/**
 * Process a single file
 */
async function processFile(filePath: string): Promise<FixResult | null> {
  try {
    stats.filesChecked++;

    const content = fs.readFileSync(filePath, 'utf8');
    const transformed = transformCatchClauses(content, filePath);

    if (transformed && transformed !== content) {
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, transformed, 'utf8');
      }
      stats.filesFixed++;

      const relPath = path.relative(process.cwd(), filePath);
      console.log(`✅ Fixed catch clauses in: ${relPath}`);

      return {
        file: relPath,
        fixes: 1,
        changes: []
      };
    }

    return null;
  } catch (error) {
    const errorMsg = `Error processing ${filePath}: ${error}`;
    stats.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
    return null;
  }
}

/**
 * Main function
 */
async function fixCatchErrors() {
  console.log('🚀 Fixing catch clause error handling...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Find all TypeScript files
  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: [
      '**/node_modules/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.d.ts',
    ],
  });

  console.log(`📁 Found ${files.length} files to check\n`);

  // Process each file
  const results: FixResult[] = [];
  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    const result = await processFile(filePath);
    if (result) {
      results.push(result);
    }
  }

  // Print statistics
  console.log('\n📊 Fix Statistics:');
  console.log(`   Files checked: ${stats.filesChecked}`);
  console.log(`   Files fixed: ${stats.filesFixed}`);
  console.log(`   Total fixes: ${stats.totalFixes}`);

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors encountered: ${stats.errors.length}`);
    stats.errors.forEach(err => console.error(`   - ${err}`));
  }

  if (DRY_RUN) {
    console.log('\n📝 This was a dry run. To apply changes, run without --dry-run');
  } else if (stats.filesFixed > 0) {
    console.log('\n🎯 Next steps:');
    console.log('1. Run: npx tsc --noEmit (to check for type errors)');
    console.log('2. Update error handling code to use type guards');
    console.log('3. Example pattern for error handling:');
    console.log(`
   try {
     // ... code
   } catch (error: unknown) {
     if (error instanceof Error) {
       console.error(error.message);
     } else {
       console.error('An unknown error occurred:', error);
     }
   }
`);
  }

  return results;
}

// Run the script
fixCatchErrors().then(results => {
  process.exit(results && results.length > 0 ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});