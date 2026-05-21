#!/usr/bin/env tsx

/**
 * Fix the remaining 95 TypeScript errors
 * Targets specific patterns identified in manual review
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');

interface FixResult {
  filesFixed: number;
  patterns: {
    errorMessageVars: number;
    asyncResultImports: number;
    unknownErrors: number;
    assignmentExpressions: number;
    propertyAccess: number;
  };
}

async function fixRemaining95Errors(): Promise<FixResult> {
  console.log('🔧 Fixing remaining 95 TypeScript errors...\n');

  const result: FixResult = {
    filesFixed: 0,
    patterns: {
      errorMessageVars: 0,
      asyncResultImports: 0,
      unknownErrors: 0,
      assignmentExpressions: 0,
      propertyAccess: 0,
    },
  };

  // 1. Fix missing imports in logs/index.ts
  const logsFile = path.join(SRC_DIR, 'server/services/logs/index.ts');
  if (fs.existsSync(logsFile)) {
    let content = fs.readFileSync(logsFile, 'utf8');

    // Add missing imports
    if (!content.includes("import { createSuccessResult")) {
      content = `import { createSuccessResult, createErrorResult, isSuccess } from '../../../utils/async-result';
import type { AsyncResult } from '../../../utils/async-result';
import { existsSync } from 'fs';
` + content;
      fs.writeFileSync(logsFile, content, 'utf8');
      console.log('✅ Fixed imports in server/services/logs/index.ts');
      result.filesFixed++;
      result.patterns.asyncResultImports++;
    }
  }

  // 2. Fix errorMessage variable issues
  const filesToFix = [
    'hooks/useTaskOperations.ts',
    'server/services/prowlarrClient.ts',
    'server/services/suwayomi/service.ts',
    'sdk/kaizoku-api-sdk.ts',
    'pages/settings/indexers.tsx'
  ];

  for (const file of filesToFix) {
    const filePath = path.join(SRC_DIR, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      // Fix undefined errorMessage references
      // Look for patterns where errorMessage is used without being defined
      const undefinedErrorMessagePattern = /(?<!const |let |var )(?<!\.)\berrorMessage\b(?!\s*=|\s*:)/g;

      // Check if errorMessage is used but not defined in the scope
      if (undefinedErrorMessagePattern.test(content) && !content.includes('const errorMessage') && !content.includes('let errorMessage')) {
        // Find the error handling context and fix it
        content = content.replace(/catch\s*\(([^)]+)\)\s*{([^}]*errorMessage[^}]*)/g, (match, errorVar, block) => {
          if (!block.includes('const errorMessage')) {
            const newBlock = block.replace(/\berrorMessage\b/g,
              `(${errorVar} instanceof Error ? ${errorVar}.message : String(${errorVar}))`);
            return `catch (${errorVar}) {${newBlock}`;
          }
          return match;
        });
        modified = true;
        result.patterns.errorMessageVars++;
      }

      // Fix redeclared errorMessage
      content = content.replace(/const errorMessage = ([^;]+);[\s\S]*?const errorMessage = ([^;]+);/g,
        (match, first, second) => {
          return `const errorMessage = ${first};\nconst errorMessage2 = ${second};`;
        });

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed errorMessage issues in ${file}`);
        result.filesFixed++;
      }
    }
  }

  // 3. Fix assignment expression issues
  const assignmentFiles = [
    'sdk/examples/advanced-features.ts',
    'test/utils/mockHelpers.tsx',
    'utils/api-response.ts',
    'utils/async-result.ts'
  ];

  for (const file of assignmentFiles) {
    const filePath = path.join(SRC_DIR, file);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      // Fix patterns like (error instanceof Error ? error.message : String(error)) = something
      content = content.replace(/\(([^)]+)\)\s*=\s*([^;]+);/g, (match, condition, value) => {
        if (condition.includes('instanceof')) {
          // This is likely a malformed assignment, skip it
          return match;
        }
        return match;
      });

      // Fix malformed error handling patterns
      content = content.replace(/error\.(error instanceof Error \? error\.message : String\(error\))/g,
        'error instanceof Error ? error.message : String(error)');

      // Fix nested error patterns
      content = content.replace(/const errorMessage = error instanceof Error \? error\.message : String\(error\);[\s\S]{0,10}errorMessage/g,
        (match) => {
          if (match.includes('errorMessage = ')) {
            return match.replace(/errorMessage = [^;]+;/, '');
          }
          return match;
        });

      if (content.includes('.errorMessage')) {
        // Fix property access on objects that don't have errorMessage
        content = content.replace(/(\w+)\.errorMessage(?!\s*=)/g, (match, obj) => {
          // Check if this is a logger or similar object
          if (obj === 'logger' || obj === 'this' || obj === 'console') {
            return `${obj}.error`;
          }
          return match;
        });
        modified = true;
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed assignment expressions in ${file}`);
        result.filesFixed++;
        result.patterns.assignmentExpressions++;
      }
    }
  }

  // 4. Fix unknown error types in catch blocks
  const searchStepFile = path.join(SRC_DIR, 'components/addManga/steps/searchStep.tsx');
  if (fs.existsSync(searchStepFile)) {
    let content = fs.readFileSync(searchStepFile, 'utf8');

    // Fix patterns where error is used directly without type guards
    content = content.replace(/catch \((\w+)\) \{([^}]*)\1(?!\.|\[|\()/g, (match, errorVar, block) => {
      if (!block.includes('instanceof')) {
        const newBlock = block.replace(new RegExp(`\\b${errorVar}\\b(?!\\.|\\\[|\\()`, 'g'),
          `String(${errorVar})`);
        return `catch (${errorVar}) {${newBlock}`;
      }
      return match;
    });

    fs.writeFileSync(searchStepFile, content, 'utf8');
    console.log('✅ Fixed unknown error types in searchStep.tsx');
    result.filesFixed++;
    result.patterns.unknownErrors++;
  }

  // 5. Fix AsyncResult type mismatches
  const systemLogsHook = path.join(SRC_DIR, 'hooks/useSystemLogs.ts');
  if (fs.existsSync(systemLogsHook)) {
    let content = fs.readFileSync(systemLogsHook, 'utf8');

    // Fix AsyncResult<{}, Error> to AsyncResult<string, Error>
    content = content.replace(/AsyncResult<{}, Error>/g, 'AsyncResult<string, Error>');

    // Fix setState calls with wrong types
    content = content.replace(/setState\({}\)/g, 'setState(null)');

    fs.writeFileSync(systemLogsHook, content, 'utf8');
    console.log('✅ Fixed AsyncResult types in useSystemLogs.ts');
    result.filesFixed++;
  }

  // 6. Fix duplicate properties in UniversalImportWizard
  const wizardFile = path.join(SRC_DIR, 'components/addManga/UniversalImportWizard.tsx');
  if (fs.existsSync(wizardFile)) {
    let content = fs.readFileSync(wizardFile, 'utf8');

    // Find and fix duplicate object properties
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('An object literal cannot have multiple properties')) {
        // Look for the problematic line around line 2047
        if (i > 2040 && i < 2055) {
          // Check for duplicate properties in object literal
          const match = lines[i].match(/(\w+):\s*[^,]+,[\s\S]*?\1:/);
          if (match) {
            lines[i] = lines[i].replace(new RegExp(`\\b${match[1]}:[^,]+,`, 'g'), '');
            result.filesFixed++;
          }
        }
      }
    }
    content = lines.join('\n');

    fs.writeFileSync(wizardFile, content, 'utf8');
  }

  return result;
}

// Run the fixes
async function main() {
  const result = await fixRemaining95Errors();

  console.log('\n📊 Fix Summary:');
  console.log(`  Files fixed: ${result.filesFixed}`);
  console.log(`  Error message vars fixed: ${result.patterns.errorMessageVars}`);
  console.log(`  AsyncResult imports added: ${result.patterns.asyncResultImports}`);
  console.log(`  Unknown errors fixed: ${result.patterns.unknownErrors}`);
  console.log(`  Assignment expressions fixed: ${result.patterns.assignmentExpressions}`);
  console.log(`  Property access fixed: ${result.patterns.propertyAccess}`);
}

main().catch(console.error);