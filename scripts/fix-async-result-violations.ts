#!/usr/bin/env tsx

/**
 * Migration script to fix AsyncResult pattern violations
 * Converts legacy .success/.value patterns to proper isSuccess()/data patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface Violation {
  file: string;
  line: number;
  original: string;
  fixed: string;
}

const violations: Violation[] = [];

/**
 * Fix patterns in a single file
 */
function fixFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const lines = content.split('\n');
  let modified = false;

  // Pattern 1: if (result.success) -> if (isSuccess(result))
  content = content.replace(
    /if\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\?\s*\.success\s*\)/g,
    (match, varName) => {
      modified = true;
      violations.push({
        file: filePath,
        line: 0,
        original: match,
        fixed: `if (isSuccess(${varName}))`
      });
      return `if (isSuccess(${varName}))`;
    }
  );

  // Pattern 2: if (result?.success) -> if (result && isSuccess(result))
  content = content.replace(
    /if\s*\(\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\?\s*\.success\s*\)/g,
    (match, varName) => {
      modified = true;
      violations.push({
        file: filePath,
        line: 0,
        original: match,
        fixed: `if (${varName} && isSuccess(${varName}))`
      });
      return `if (${varName} && isSuccess(${varName}))`;
    }
  );

  // Pattern 3: result.success && -> isSuccess(result) &&
  content = content.replace(
    /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\?\s*\.success\s*&&/g,
    (match, varName) => {
      modified = true;
      violations.push({
        file: filePath,
        line: 0,
        original: match,
        fixed: `${varName} && isSuccess(${varName}) &&`
      });
      return `${varName} && isSuccess(${varName}) &&`;
    }
  );

  // Pattern 4: result.value -> result.data (when following isSuccess check)
  content = content.replace(
    /(\s+)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\.value\b/g,
    (match, indent, varName) => {
      // Check if this is preceded by an isSuccess check for the same variable
      const prevLines = content.substring(0, content.indexOf(match)).split('\n');
      const recentLines = prevLines.slice(-10).join('\n');

      if (recentLines.includes(`isSuccess(${varName})`)) {
        modified = true;
        violations.push({
          file: filePath,
          line: 0,
          original: match,
          fixed: `${indent}${varName}.data`
        });
        return `${indent}${varName}.data`;
      }
      return match;
    }
  );

  // Pattern 5: !result.success -> isError(result)
  content = content.replace(
    /!\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\?\s*\.success/g,
    (match, varName) => {
      modified = true;
      violations.push({
        file: filePath,
        line: 0,
        original: match,
        fixed: `isError(${varName})`
      });
      return `isError(${varName})`;
    }
  );

  // Add imports if we made changes and they're missing
  if (modified && !content.includes('import') && !content.includes('isSuccess')) {
    // Skip - file might not need imports
  } else if (modified && !content.includes('isSuccess')) {
    // Check if async-result is already imported
    const asyncResultImportRegex = /import\s*{([^}]+)}\s*from\s*['"].*async-result['"]/;
    const match = content.match(asyncResultImportRegex);

    if (match) {
      // Add to existing import
      const imports = match[1].split(',').map(s => s.trim());
      const newImports = new Set(imports);

      if (!imports.includes('isSuccess')) newImports.add('isSuccess');
      if (!imports.includes('isError')) newImports.add('isError');

      const newImportStatement = `import { ${Array.from(newImports).join(', ')} } from '../utils/async-result'`;
      content = content.replace(asyncResultImportRegex, newImportStatement);
    } else {
      // Add new import after other imports
      const firstImportIndex = content.indexOf('import');
      if (firstImportIndex !== -1) {
        const endOfImports = content.indexOf('\n\n', firstImportIndex);
        const importSection = content.substring(0, endOfImports);
        const restOfFile = content.substring(endOfImports);

        content = importSection + `\nimport { isSuccess, isError } from '../utils/async-result';` + restOfFile;
      }
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🔍 Searching for AsyncResult pattern violations...\n');

  // Files identified in the audit
  const targetFiles = [
    'src/components/addManga/UniversalImportWizard.tsx',
    'src/components/updateManga/ProviderSelectionForm.tsx',
    'src/components/library/BulkActionsModal.tsx',
    'src/components/settings/prowlarr/IndexerList.tsx',
    'src/components/settings/DownloadSettings.tsx',
    'src/components/library/rules/ImportRuleManager.tsx',
    'src/components/auth/FirstTimeSetup.tsx',
    'src/components/addManga/MetadataEditor.tsx',
    'src/components/addManga/steps/confirmationStep/components/MetadataDisplay.tsx',
    'src/components/addManga/components/display/MetadataPreview.tsx',
    'src/components/common/SafeSelector.tsx',
    'src/components/common/SafeMultiSelect.tsx',
    'src/components/system/SourceTester.tsx',
    'src/components/suwayomi/DownloadButton.tsx',
    'src/components/settings/downloadClients/ClientSettings.tsx',
    'src/components/settings/downloadClients/TransmissionSettings.tsx',
    'src/types/task-unions.ts'
  ];

  let fixedCount = 0;
  let skippedCount = 0;

  for (const file of targetFiles) {
    const fullPath = path.join(process.cwd(), file);

    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Skipped (not found): ${file}`);
      skippedCount++;
      continue;
    }

    if (fixFile(fullPath)) {
      fixedCount++;
    } else {
      console.log(`ℹ️  No violations found: ${file}`);
    }
  }

  // Also search for any other files with violations
  console.log('\n🔍 Searching for additional violations...\n');

  const additionalFiles = await glob('src/**/*.{ts,tsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.test.tsx']
  });

  for (const file of additionalFiles) {
    if (!targetFiles.includes(file)) {
      const content = fs.readFileSync(file, 'utf-8');

      // Quick check for violations
      if (content.includes('.success') || content.includes('.value')) {
        if (fixFile(file)) {
          fixedCount++;
          console.log(`✅ Additional file fixed: ${file}`);
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Files fixed: ${fixedCount}`);
  console.log(`⚠️  Files skipped: ${skippedCount}`);
  console.log(`📝 Total violations fixed: ${violations.length}`);

  if (violations.length > 0) {
    console.log('\nDetailed violations fixed:');
    violations.forEach(v => {
      console.log(`  ${v.file}:`);
      console.log(`    - ${v.original} → ${v.fixed}`);
    });
  }

  console.log('\n✨ Migration complete!');
  console.log('Run "pnpm type-check" to verify no TypeScript errors were introduced.');
}

// Run migration
migrate().catch(console.error);