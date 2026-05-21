#!/usr/bin/env node

/**
 * Replace 'any' with 'unknown' Type Safety Script
 * 
 * Intelligently replaces 'any' types with 'unknown' where safe to do so.
 * Skips cases where 'any' is necessary (like third-party integrations).
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const glob = require('glob');

// Patterns where we should NOT replace any
const SKIP_PATTERNS = [
  // Third-party library augmentations
  /window\./,
  /global\./,
  /process\.env/,
  // Event handlers that need any
  /on[A-Z]\w+/,
  // Catch blocks (handled separately)
  /catch/,
  // Type assertions that need any
  /as any/,
  // JSON parsing
  /JSON\.(parse|stringify)/,
  // Express/Next.js specific
  /req\.|res\.|next\(/,
];

// Files to skip entirely
const SKIP_FILES = [
  '.d.ts', // Type definition files
  'test.ts',
  'test.tsx',
  'spec.ts',
  'spec.tsx',
  '.config.',
  'node_modules',
  'backups',
  '.next',
];

function shouldSkipFile(filePath) {
  return SKIP_FILES.some(pattern => filePath.includes(pattern));
}

function shouldSkipContext(path) {
  // Check if we're in a context that shouldn't be changed
  let currentPath = path;
  while (currentPath) {
    // Check for patterns in parent nodes
    if (currentPath.node && currentPath.node.type === 'CallExpression') {
      const callee = currentPath.node.callee;
      if (t.isMemberExpression(callee)) {
        const objName = callee.object.name;
        const propName = callee.property.name;
        
        // Skip JSON operations
        if (objName === 'JSON' && (propName === 'parse' || propName === 'stringify')) {
          return true;
        }
        
        // Skip window/global operations
        if (objName === 'window' || objName === 'global') {
          return true;
        }
      }
    }
    
    // Check if in catch block
    if (currentPath.node && currentPath.node.type === 'CatchClause') {
      return false; // We want to handle catch blocks specially
    }
    
    currentPath = currentPath.parentPath;
  }
  
  return false;
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return { skipped: true };
  }

  const code = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  let replacements = 0;
  let skippedCount = 0;
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
    });

    traverse(ast, {
      // Replace 'any' in type annotations
      TSAnyKeyword(path) {
        // Check if we should skip this context
        if (shouldSkipContext(path)) {
          skippedCount++;
          return;
        }
        
        // Check for 'as any' type assertions - skip these
        if (path.parent.type === 'TSAsExpression') {
          skippedCount++;
          return;
        }
        
        // Check if it's in a third-party augmentation
        if (path.findParent(p => p.node.type === 'TSModuleDeclaration')) {
          skippedCount++;
          return;
        }
        
        // Replace with unknown
        path.replaceWith(t.tsUnknownKeyword());
        hasChanges = true;
        replacements++;
      },
      
      // Handle catch clauses specially
      CatchClause(path) {
        if (path.node.param && t.isIdentifier(path.node.param)) {
          // Add type annotation if missing
          if (!path.node.param.typeAnnotation) {
            path.node.param.typeAnnotation = t.tsTypeAnnotation(
              t.tsUnknownKeyword()
            );
            hasChanges = true;
            replacements++;
          } else if (
            path.node.param.typeAnnotation.typeAnnotation.type === 'TSAnyKeyword'
          ) {
            // Replace any with unknown in catch
            path.node.param.typeAnnotation.typeAnnotation = t.tsUnknownKeyword();
            hasChanges = true;
            replacements++;
          }
        }
      },
      
      // Handle function parameters with implicit any
      FunctionDeclaration(path) {
        handleFunctionParams(path.node.params, path);
      },
      
      FunctionExpression(path) {
        handleFunctionParams(path.node.params, path);
      },
      
      ArrowFunctionExpression(path) {
        handleFunctionParams(path.node.params, path);
      },
    });
    
    function handleFunctionParams(params, path) {
      params.forEach(param => {
        if (t.isIdentifier(param) && !param.typeAnnotation) {
          // Check if it's an event handler
          const paramName = param.name;
          if (paramName === 'e' || paramName === 'event' || 
              paramName === 'err' || paramName === 'error') {
            // Add unknown type for common parameters
            param.typeAnnotation = t.tsTypeAnnotation(t.tsUnknownKeyword());
            hasChanges = true;
            replacements++;
          }
        }
      });
    }

    if (hasChanges) {
      const { code: newCode } = generate(ast, {
        retainLines: true,
        retainFunctionParens: true,
        compact: false,
      });
      
      // Backup original file
      const backupPath = filePath + '.backup';
      fs.copyFileSync(filePath, backupPath);
      
      // Write updated code
      fs.writeFileSync(filePath, newCode);
      
      return { 
        updated: true, 
        replacements, 
        skipped: skippedCount,
        backup: backupPath 
      };
    }
  } catch (error) {
    return { error: error.message };
  }

  return { 
    noChanges: true, 
    skipped: skippedCount 
  };
}

// Main execution
console.log('🔍 Replacing any with unknown for type safety...\n');

// Start with a subset of files for safety
const testFiles = [
  'src/utils/*.ts',
  'src/hooks/*.ts',
  'src/components/common/*.tsx',
];

let files = [];
testFiles.forEach(pattern => {
  files = files.concat(glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/backups/**', '**/.next/**']
  }));
});

console.log(`Processing ${files.length} files in test batch...\n`);

let updatedCount = 0;
let totalReplacements = 0;
let totalSkipped = 0;
let errorCount = 0;

files.forEach(file => {
  const result = processFile(file);
  
  if (result.updated) {
    console.log(`✅ Updated: ${file} (${result.replacements} replacements, ${result.skipped} skipped)`);
    updatedCount++;
    totalReplacements += result.replacements;
    totalSkipped += result.skipped;
  } else if (result.error) {
    console.log(`❌ Error in ${file}: ${result.error}`);
    errorCount++;
  } else if (result.skipped) {
    // File was skipped
  } else if (result.noChanges && result.skipped > 0) {
    totalSkipped += result.skipped;
  }
});

console.log('\n📊 Summary:');
console.log(`   Files updated: ${updatedCount}`);
console.log(`   Total replacements: ${totalReplacements}`);
console.log(`   Total skipped: ${totalSkipped}`);
console.log(`   Files with errors: ${errorCount}`);

if (updatedCount > 0) {
  console.log('\n⚠️  Next steps:');
  console.log('   1. Run TypeScript check: npx tsc --noEmit');
  console.log('   2. Fix any type errors by adding type guards');
  console.log('   3. If successful, run on more files');
}

console.log('\n✨ Type safety improvement complete!');
