#!/usr/bin/env tsx

/**
 * Script to fix error handling by adding proper type guards
 * after changing catch clause errors to 'unknown'
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

interface ErrorFix {
  file: string;
  line: number;
  type: 'property-access' | 'direct-use' | 'assignment';
  fix: string;
}

/**
 * Fix specific error handling patterns
 */
function fixErrorHandling(filePath: string, content: string): string | null {
  let modified = content;
  let hasChanges = false;

  // Pattern 1: Direct property access on unknown error (error.message, error.stack, etc.)
  // Replace: error.message with: error instanceof Error ? error.message : String(error)
  const propertyAccessPattern = /(\berror)(\.message|\.stack|\.name|\.code)(?!\s*\?)/g;
  const newContent1 = modified.replace(propertyAccessPattern, (match, errorVar, property) => {
    hasChanges = true;
    if (VERBOSE) {
      console.log(`📝 Fixing property access in ${path.basename(filePath)}: ${match}`);
    }
    return `(${errorVar} instanceof Error ? ${errorVar}${property} : String(${errorVar}))`;
  });

  if (newContent1 !== modified) {
    modified = newContent1;
  }

  // Pattern 2: Assignment or usage without type check
  // Look for catch blocks and add type guard
  const catchBlockPattern = /catch\s*\(\s*(\w+):\s*unknown\s*\)\s*{\s*([^}]*?)}/g;
  const newContent2 = modified.replace(catchBlockPattern, (match, errorVar, blockContent) => {
    // Check if there's already a type guard
    if (blockContent.includes(`${errorVar} instanceof Error`)) {
      return match; // Already has type guard
    }

    // Check if error is used directly without type guard
    if (blockContent.includes(errorVar) &&
        !blockContent.includes('instanceof') &&
        !blockContent.includes('String(') &&
        !blockContent.includes('console.')) {

      hasChanges = true;
      if (VERBOSE) {
        console.log(`📝 Adding type guard in catch block in ${path.basename(filePath)}`);
      }

      // Add type guard at the beginning of the catch block
      const indentMatch = blockContent.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '  ';

      const typeGuard = `${indent}const errorMessage = ${errorVar} instanceof Error ? ${errorVar}.message : String(${errorVar});`;

      // Replace direct uses of error with errorMessage
      let updatedBlock = blockContent.replace(
        new RegExp(`\\b${errorVar}\\b(?!\\.|\s+instanceof)`, 'g'),
        'errorMessage'
      );

      return `catch (${errorVar}: unknown) {${typeGuard}\n${updatedBlock}}`;
    }

    return match;
  });

  if (newContent2 !== modified) {
    modified = newContent2;
  }

  return hasChanges ? modified : null;
}

/**
 * Fix a specific file
 */
function fixFile(filePath: string): boolean {
  if (VERBOSE) {
    console.log(`🔍 Checking: ${path.relative(process.cwd(), filePath)}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Skip if file doesn't have catch blocks with unknown type
  if (!content.includes('catch') || !content.includes(': unknown')) {
    return false;
  }

  const fixed = fixErrorHandling(filePath, content);

  if (fixed && fixed !== content) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, fixed, 'utf8');
    }
    console.log(`✅ Fixed error handling in: ${path.relative(process.cwd(), filePath)}`);
    return true;
  }

  return false;
}

/**
 * Fix specific known problematic files
 */
function fixSpecificFiles() {
  const problematicFiles = [
    'src/components/addManga/UniversalImportWizard.tsx',
    'src/pages/api/backup/upload.ts',
    'src/sdk/examples/usage.ts',
    'src/server/db.ts',
    'src/server/utils/retry.ts',
    'src/utils/api-helpers.ts',
    'src/utils/server/serverHelpers.ts',
  ];

  console.log('🎯 Fixing known problematic files...\n');

  for (const file of problematicFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      fixFile(filePath);
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Fixing error handling patterns...');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // First fix the specific problematic files
  fixSpecificFiles();

  // Then scan for any other files that might need fixing
  console.log('\n🔍 Scanning for other files with error handling issues...\n');

  const files = await glob('**/*.{ts,tsx}', {
    cwd: path.join(process.cwd(), 'src'),
    ignore: [
      '**/node_modules/**',
      '**/*.test.{ts,tsx}',
      '**/*.spec.{ts,tsx}',
      '**/*.d.ts',
    ],
  });

  let fixedCount = 0;
  for (const file of files) {
    const filePath = path.join(process.cwd(), 'src', file);
    if (fixFile(filePath)) {
      fixedCount++;
    }
  }

  console.log(`\n📊 Fixed ${fixedCount} files`);

  if (DRY_RUN) {
    console.log('\n📝 This was a dry run. To apply changes, run without --dry-run');
  }
}

main().catch(console.error);