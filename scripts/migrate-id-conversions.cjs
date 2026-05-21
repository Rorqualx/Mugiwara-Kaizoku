#!/usr/bin/env node

/**
 * ID Conversion Migration Script
 * 
 * This script uses AST parsing to safely migrate ID conversion patterns
 * to use the standardized toNumericId() and toStringId() functions.
 * 
 * Migration rules:
 * 1. Number(id) -> toNumericId(id) [when id contains 'id' or 'Id']
 * 2. parseInt(id) -> toNumericId(id) [when id contains 'id' or 'Id']
 * 3. toNumberId(id) -> toNumericId(id)
 * 4. String(id) -> toStringId(id) [when id contains 'id' or 'Id']
 * 5. id.toString() -> toStringId(id) [when id contains 'id' or 'Id']
 * 6. +id -> toNumericId(id) [when id contains 'id' or 'Id']
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const TEST_FILE = process.argv.find(arg => arg.startsWith('--file='))?.split('=')[1];

// Statistics
let totalChanges = 0;
let fileChanges = {};
let importAdditions = {};

// Helper: Check if an expression likely contains an ID
function isIdExpression(node) {
  if (!node) return false;
  
  const code = generate(node, { compact: true }).code;
  return /\b(id|Id|ID|mangaId|chapterId|libraryId|userId|providerId)\b/i.test(code);
}

// Helper: Get the argument from a function call
function getCallArgument(node) {
  if (t.isCallExpression(node) && node.arguments.length > 0) {
    return node.arguments[0];
  }
  return null;
}

// Helper: Check if toNumericId is already imported
function hasNumericIdImport(ast) {
  let hasImport = false;
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value.includes('id-conversion') || 
          path.node.source.value.includes('idUtils')) {
        path.node.specifiers.forEach(spec => {
          if (t.isImportSpecifier(spec) && 
              spec.imported.name === 'toNumericId') {
            hasImport = true;
          }
        });
      }
    }
  });
  return hasImport;
}

// Helper: Check if toStringId is already imported
function hasStringIdImport(ast) {
  let hasImport = false;
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value.includes('id-conversion') || 
          path.node.source.value.includes('idUtils')) {
        path.node.specifiers.forEach(spec => {
          if (t.isImportSpecifier(spec) && 
              spec.imported.name === 'toStringId') {
            hasImport = true;
          }
        });
      }
    }
  });
  return hasImport;
}

// Helper: Add import if needed
function addImports(ast, filePath, needNumeric, needString) {
  if (!needNumeric && !needString) return;
  
  // Determine the correct import path based on file location
  const fromPath = filePath.replace(/\\/g, '/');
  let importPath = '@/utils/id-conversion';
  
  if (fromPath.includes('src/utils/')) {
    // If we're in utils, use relative import
    const depth = fromPath.split('src/utils/')[1].split('/').length - 1;
    importPath = depth === 0 ? './id-conversion' : '../'.repeat(depth) + 'id-conversion';
  } else if (fromPath.includes('src/server/')) {
    importPath = '../../utils/id-conversion';
  } else if (fromPath.includes('src/')) {
    // Count depth from src
    const depth = fromPath.split('src/')[1].split('/').length - 1;
    if (depth === 0) {
      importPath = './utils/id-conversion';
    } else {
      importPath = '../'.repeat(depth) + 'utils/id-conversion';
    }
  }
  
  const imports = [];
  if (needNumeric) imports.push('toNumericId');
  if (needString) imports.push('toStringId');
  
  const importDeclaration = t.importDeclaration(
    imports.map(name => t.importSpecifier(
      t.identifier(name),
      t.identifier(name)
    )),
    t.stringLiteral(importPath)
  );
  
  // Add import at the top
  ast.program.body.unshift(importDeclaration);
}

// Process a single file
function processFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  
  // Skip test files and type definition files
  if (filePath.includes('.test.') || filePath.includes('.spec.') || 
      filePath.includes('.d.ts') || filePath.includes('node_modules')) {
    return { changed: false };
  }
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy']
    });
    
    let changes = 0;
    let needNumericImport = !hasNumericIdImport(ast);
    let needStringImport = !hasStringIdImport(ast);
    let hasNumericConversion = false;
    let hasStringConversion = false;
    
    traverse(ast, {
      // Number(id) -> toNumericId(id)
      CallExpression(path) {
        const { node } = path;
        
        // Handle Number() calls
        if (t.isIdentifier(node.callee, { name: 'Number' }) && 
            node.arguments.length === 1 &&
            isIdExpression(node.arguments[0])) {
          path.replaceWith(
            t.callExpression(
              t.identifier('toNumericId'),
              node.arguments
            )
          );
          changes++;
          hasNumericConversion = true;
          return;
        }
        
        // Handle parseInt() calls
        if (t.isIdentifier(node.callee, { name: 'parseInt' }) && 
            node.arguments.length >= 1 &&
            isIdExpression(node.arguments[0])) {
          path.replaceWith(
            t.callExpression(
              t.identifier('toNumericId'),
              [node.arguments[0]]
            )
          );
          changes++;
          hasNumericConversion = true;
          return;
        }
        
        // Handle toNumberId() calls
        if (t.isIdentifier(node.callee, { name: 'toNumberId' })) {
          node.callee.name = 'toNumericId';
          changes++;
          hasNumericConversion = true;
          return;
        }
        
        // Handle String() calls
        if (t.isIdentifier(node.callee, { name: 'String' }) && 
            node.arguments.length === 1 &&
            isIdExpression(node.arguments[0])) {
          path.replaceWith(
            t.callExpression(
              t.identifier('toStringId'),
              node.arguments
            )
          );
          changes++;
          hasStringConversion = true;
          return;
        }
      },
      
      // id.toString() -> toStringId(id)
      MemberExpression(path) {
        const { node } = path;
        
        if (t.isIdentifier(node.property, { name: 'toString' }) &&
            isIdExpression(node.object)) {
          // Check if it's being called
          if (t.isCallExpression(path.parent) && path.parent.callee === node) {
            path.parentPath.replaceWith(
              t.callExpression(
                t.identifier('toStringId'),
                [node.object]
              )
            );
            changes++;
            hasStringConversion = true;
          }
        }
      },
      
      // +id -> toNumericId(id)
      UnaryExpression(path) {
        const { node } = path;
        
        if (node.operator === '+' && 
            node.prefix &&
            isIdExpression(node.argument)) {
          path.replaceWith(
            t.callExpression(
              t.identifier('toNumericId'),
              [node.argument]
            )
          );
          changes++;
          hasNumericConversion = true;
        }
      }
    });
    
    // Add imports if needed and conversions were made
    if (hasNumericConversion && needNumericImport || 
        hasStringConversion && needStringImport) {
      addImports(ast, filePath, 
        hasNumericConversion && needNumericImport,
        hasStringConversion && needStringImport
      );
      
      if (hasNumericConversion && needNumericImport) {
        importAdditions[filePath] = (importAdditions[filePath] || []);
        importAdditions[filePath].push('toNumericId');
      }
      if (hasStringConversion && needStringImport) {
        importAdditions[filePath] = (importAdditions[filePath] || []);
        importAdditions[filePath].push('toStringId');
      }
    }
    
    if (changes > 0) {
      const output = generate(ast, {}, code);
      
      // Validate syntax
      try {
        parser.parse(output.code, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript', 'decorators-legacy']
        });
      } catch (syntaxError) {
        console.error(`❌ Syntax error in ${filePath}:`, syntaxError.message);
        return { changed: false, error: syntaxError };
      }
      
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, output.code);
      }
      
      fileChanges[filePath] = changes;
      totalChanges += changes;
      
      if (VERBOSE) {
        console.log(`✓ ${filePath}: ${changes} changes`);
      }
      
      return { changed: true, changes };
    }
    
    return { changed: false };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { changed: false, error };
  }
}

// Main execution
function main() {
  console.log('🔄 ID Conversion Migration Script');
  console.log('==================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log();
  
  const files = TEST_FILE 
    ? [TEST_FILE]
    : glob.sync('src/**/*.{ts,tsx}', { 
        ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*.d.ts'] 
      });
  
  console.log(`Processing ${files.length} files...`);
  console.log();
  
  let processedCount = 0;
  let errorCount = 0;
  
  files.forEach(file => {
    const result = processFile(file);
    if (result.changed) processedCount++;
    if (result.error) errorCount++;
  });
  
  // Summary
  console.log();
  console.log('📊 Migration Summary');
  console.log('===================');
  console.log(`Total files processed: ${files.length}`);
  console.log(`Files modified: ${processedCount}`);
  console.log(`Total changes: ${totalChanges}`);
  console.log(`Errors: ${errorCount}`);
  
  if (Object.keys(fileChanges).length > 0) {
    console.log();
    console.log('📝 Modified files:');
    Object.entries(fileChanges)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([file, count]) => {
        console.log(`  ${file}: ${count} changes`);
      });
    
    if (Object.keys(fileChanges).length > 10) {
      console.log(`  ... and ${Object.keys(fileChanges).length - 10} more`);
    }
  }
  
  if (Object.keys(importAdditions).length > 0) {
    console.log();
    console.log('📦 Import additions:');
    console.log(`  Files needing imports: ${Object.keys(importAdditions).length}`);
  }
  
  if (DRY_RUN) {
    console.log();
    console.log('ℹ️  This was a dry run. No files were modified.');
    console.log('   Run without --dry-run to apply changes.');
  }
}

// Run the script
main();
