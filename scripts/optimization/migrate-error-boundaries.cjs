#!/usr/bin/env node

/**
 * Migrate ErrorBoundary Imports
 * 
 * Updates all ErrorBoundary imports to use the new UnifiedErrorBoundary
 */

const fs = require('fs');
const nodePath = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const glob = require('glob');

// Files to skip
const skipFiles = [
  'UnifiedErrorBoundary.tsx',
  'node_modules',
  '.next',
  'backups',
  'type-refactor-backups'
];

// Old ErrorBoundary paths to replace
const oldErrorBoundaryPaths = [
  './ErrorBoundary',
  '../ErrorBoundary',
  '../../ErrorBoundary',
  '../../../ErrorBoundary',
  './components/ErrorBoundary',
  './components/common/ErrorBoundary',
  './components/addManga/components/core/ErrorBoundary',
  './components/events/EventsDashboardErrorBoundary',
  './components/performance/LazyBoundary',
  '../common/ErrorBoundary',
  '../../common/ErrorBoundary',
  '../../../common/ErrorBoundary',
  './core/ErrorBoundary',
  '../core/ErrorBoundary',
  '../../core/ErrorBoundary'
];

function shouldSkip(filePath) {
  return skipFiles.some(skip => filePath.includes(skip));
}

function processFile(filePath) {
  if (shouldSkip(filePath)) {
    return { skipped: true };
  }

  const code = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy']
    });

    traverse(ast, {
      ImportDeclaration(path) {
        const importSource = path.node.source.value;
        
        // Check if this is an ErrorBoundary import
        const isErrorBoundaryImport = 
          oldErrorBoundaryPaths.some(oldPath => importSource.includes(oldPath)) ||
          (path.node.specifiers.some(spec => 
            (spec.imported?.name === 'ErrorBoundary' || 
             spec.imported?.name === 'EventsDashboardErrorBoundary' ||
             spec.imported?.name === 'LazyBoundary') ||
            spec.local?.name === 'ErrorBoundary'
          ) && (importSource.includes('ErrorBoundary') || 
                importSource.includes('LazyBoundary') ||
                importSource.includes('EventsDashboard')));

        if (isErrorBoundaryImport) {
          // Calculate relative path to UnifiedErrorBoundary
          const fileDir = nodePath.dirname(filePath);
          const targetPath = 'src/components/common/UnifiedErrorBoundary';
          const relativePath = nodePath.relative(fileDir, targetPath).replace(/\\/g, '/');
          
          // Update the import
          path.node.source.value = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
          
          // Update specifiers
          path.node.specifiers.forEach(spec => {
            if (t.isImportDefaultSpecifier(spec)) {
              // Keep default import as is
            } else if (t.isImportSpecifier(spec)) {
              if (spec.imported.name === 'EventsDashboardErrorBoundary' ||
                  spec.imported.name === 'LazyBoundary') {
                // Replace with ErrorBoundary
                spec.imported.name = 'ErrorBoundary';
                if (spec.local.name === 'EventsDashboardErrorBoundary' ||
                    spec.local.name === 'LazyBoundary') {
                  spec.local.name = 'ErrorBoundary';
                }
              }
            }
          });
          
          hasChanges = true;
        }
      },
      
      // Update JSX usage
      JSXIdentifier(path) {
        if (path.node.name === 'EventsDashboardErrorBoundary' ||
            path.node.name === 'LazyBoundary') {
          if (path.isJSXOpeningElement() || path.isJSXClosingElement()) {
            path.node.name = 'ErrorBoundary';
            hasChanges = true;
          }
        }
      }
    });

    if (hasChanges) {
      const { code: newCode } = generate(ast, {
        retainLines: true,
        retainFunctionParens: true,
        compact: false
      });
      
      // Backup original file
      const backupPath = filePath + '.backup';
      fs.copyFileSync(filePath, backupPath);
      
      // Write updated code
      fs.writeFileSync(filePath, newCode);
      
      return { updated: true, backup: backupPath };
    }
  } catch (error) {
    return { error: error.message };
  }

  return { noChanges: true };
}

// Main execution
console.log('🔄 Migrating ErrorBoundary imports...\n');

const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['**/node_modules/**', '**/backups/**', '**/.next/**']
});

let updatedCount = 0;
let skippedCount = 0;
let errorCount = 0;

files.forEach(file => {
  const result = processFile(file);
  
  if (result.updated) {
    console.log(`✅ Updated: ${file}`);
    updatedCount++;
  } else if (result.skipped) {
    skippedCount++;
  } else if (result.error) {
    console.log(`❌ Error in ${file}: ${result.error}`);
    errorCount++;
  }
});

console.log('\n📊 Migration Summary:');
console.log(`   Updated: ${updatedCount} files`);
console.log(`   Skipped: ${skippedCount} files`);
console.log(`   Errors: ${errorCount} files`);
console.log(`   Total: ${files.length} files`);

if (updatedCount > 0) {
  console.log('\n⚠️  Run TypeScript check to verify changes:');
  console.log('   npx tsc --noEmit');
}

console.log('\n✨ Migration complete!');
