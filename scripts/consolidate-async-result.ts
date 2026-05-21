#!/usr/bin/env tsx

/**
 * Script to consolidate duplicate AsyncResult implementations
 *
 * This script:
 * 1. Updates all imports from duplicate modules to the canonical async-result.ts
 * 2. Removes duplicate implementation files
 * 3. Validates that all imports are working correctly
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

// Configuration
const SRC_DIR = path.join(process.cwd(), 'src');
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Duplicate modules to consolidate
const DUPLICATE_MODULES = [
  'async-result-extended',
  'async-result-helpers',
  '../hooks/useAsyncOperation', // For fromPromiseCatch imports
  './useAsyncOperation', // Relative imports
];

// Canonical module
const CANONICAL_MODULE = 'async-result';

// Stats tracking
const stats = {
  filesChecked: 0,
  filesModified: 0,
  importsUpdated: 0,
  errors: [] as string[],
};

/**
 * Update imports in a TypeScript file
 */
function updateImports(sourceText: string, fileName: string): string | null {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  let modified = false;
  let newText = sourceText;

  // Track all replacements to apply
  const replacements: Array<{ start: number; end: number; text: string }> = [];

  function visit(node: ts.Node) {
    // Check for import declarations
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const modulePath = moduleSpecifier.text;

        // Check if this is one of the duplicate modules
        for (const duplicateModule of DUPLICATE_MODULES) {
          if (modulePath.includes(duplicateModule)) {
            // Get the imported symbols
            const importClause = node.importClause;
            if (importClause && importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
              const imports = importClause.namedBindings.elements.map(e => e.name.text);

              // Determine the correct path to canonical module
              let canonicalPath = '';

              // Calculate relative path based on file location
              const fileDir = path.dirname(fileName);
              const relativeToSrc = path.relative(fileDir, SRC_DIR);
              const depth = fileName.split('/').length - SRC_DIR.split('/').length - 1;

              // Build the correct import path
              if (depth === 0) {
                canonicalPath = `./utils/${CANONICAL_MODULE}`;
              } else if (depth === 1) {
                canonicalPath = `../utils/${CANONICAL_MODULE}`;
              } else if (depth === 2) {
                canonicalPath = `../../utils/${CANONICAL_MODULE}`;
              } else if (depth === 3) {
                canonicalPath = `../../../utils/${CANONICAL_MODULE}`;
              } else {
                // For deeper nesting, use a safe default
                canonicalPath = `${Array(depth).fill('..').join('/')}/utils/${CANONICAL_MODULE}`;
              }

              // Special case: if we're in the utils directory
              if (fileName.includes('/utils/') && !fileName.includes('/utils/async-result')) {
                canonicalPath = `./${CANONICAL_MODULE}`;
              }

              // Create replacement
              const newImport = `import { ${imports.join(', ')} } from '${canonicalPath}'`;
              replacements.push({
                start: node.pos,
                end: node.end,
                text: newImport
              });

              if (VERBOSE) {
                console.log(`📝 ${fileName}:`);
                console.log(`   OLD: ${sourceText.substring(node.pos, node.end).trim()}`);
                console.log(`   NEW: ${newImport}`);
              }

              modified = true;
              stats.importsUpdated++;
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (modified && replacements.length > 0) {
    // Apply replacements in reverse order to maintain positions
    replacements.sort((a, b) => b.start - a.start);
    for (const { start, end, text } of replacements) {
      newText = newText.substring(0, start) + '\n' + text + newText.substring(end);
    }
    return newText;
  }

  return null;
}

/**
 * Process a single file
 */
async function processFile(filePath: string): Promise<boolean> {
  try {
    stats.filesChecked++;

    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = updateImports(content, filePath);

    if (updatedContent !== null) {
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, updatedContent, 'utf8');
      }
      stats.filesModified++;
      console.log(`✅ Updated imports in: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }

    return false;
  } catch (error) {
    const errorMsg = `Error processing ${filePath}: ${error}`;
    stats.errors.push(errorMsg);
    console.error(`❌ ${errorMsg}`);
    return false;
  }
}

/**
 * Run TypeScript compiler to check for errors
 */
async function runTypeCheck(): Promise<boolean> {
  console.log('\n🔍 Running type check...');
  try {
    const { stdout, stderr } = await exec('npx tsc --noEmit');
    if (stderr) {
      console.error('TypeScript errors found:', stderr);
      return false;
    }
    console.log('✅ No TypeScript errors found');
    return true;
  } catch (error: any) {
    console.error('❌ TypeScript compilation failed:', error.stdout || error.message);
    return false;
  }
}

/**
 * Main consolidation function
 */
async function consolidateAsyncResult() {
  console.log('🚀 Starting AsyncResult consolidation...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Find all TypeScript files
  const files = await glob('**/*.{ts,tsx}', {
    cwd: SRC_DIR,
    ignore: [
      '**/node_modules/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/async-result.ts', // Skip the canonical file itself
      '**/async-result-extended.ts', // Skip files we'll delete
      '**/async-result-helpers.ts',
      '**/async-result/helpers.ts',
    ],
  });

  console.log(`📁 Found ${files.length} files to check\n`);

  // Process each file
  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    await processFile(filePath);
  }

  // Print statistics
  console.log('\n📊 Consolidation Statistics:');
  console.log(`   Files checked: ${stats.filesChecked}`);
  console.log(`   Files modified: ${stats.filesModified}`);
  console.log(`   Imports updated: ${stats.importsUpdated}`);

  if (stats.errors.length > 0) {
    console.log(`\n❌ Errors encountered: ${stats.errors.length}`);
    stats.errors.forEach(err => console.error(`   - ${err}`));
  }

  // Run type check
  if (!DRY_RUN && stats.filesModified > 0) {
    const typeCheckPassed = await runTypeCheck();
    if (!typeCheckPassed) {
      console.error('\n⚠️ Type checking failed after consolidation');
      console.log('Consider reverting changes with: git checkout -- src/');
      return false;
    }
  }

  // List files to be deleted (but don't delete yet)
  console.log('\n🗑️ The following duplicate files can be deleted:');
  console.log('   - src/utils/async-result-extended.ts');
  console.log('   - src/utils/async-result-helpers.ts');
  console.log('   - src/utils/async-result/helpers.ts');
  console.log('\nTo delete them, run:');
  console.log('   rm src/utils/async-result-extended.ts');
  console.log('   rm src/utils/async-result-helpers.ts');
  console.log('   rm -rf src/utils/async-result/');

  if (DRY_RUN) {
    console.log('\n📝 This was a dry run. To apply changes, run without --dry-run');
  }

  return true;
}

// Run the script
consolidateAsyncResult().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});