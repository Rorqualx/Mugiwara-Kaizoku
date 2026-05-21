#!/usr/bin/env node

/**
 * Add React.memo to Components
 * 
 * Optimizes re-renders by memoizing pure components
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const glob = require('glob');

// Components to skip memoization
const SKIP_COMPONENTS = [
  'App',
  'Layout',
  'Provider',
  'Context',
  'ErrorBoundary',
  'Router',
  'Route'
];

function shouldMemoize(componentName) {
  // Skip if in skip list
  if (SKIP_COMPONENTS.some(skip => componentName.includes(skip))) {
    return false;
  }
  
  // Memoize if it's a presentational component
  const presentationalPatterns = [
    'Card', 'Button', 'List', 'Item', 'Display',
    'View', 'Panel', 'Modal', 'Badge', 'Icon'
  ];
  
  return presentationalPatterns.some(pattern => 
    componentName.includes(pattern)
  );
}

function processFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  let memoizedCount = 0;
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
    });

    let hasReactImport = false;
    let hasMemoImport = false;
    
    // Check existing imports
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'react') {
          hasReactImport = true;
          // Check if memo is already imported
          path.node.specifiers.forEach(spec => {
            if (t.isImportSpecifier(spec) && spec.imported.name === 'memo') {
              hasMemoImport = true;
            }
          });
        }
      }
    });

    // Track components to memoize
    const componentsToMemoize = [];
    
    traverse(ast, {
      // Function components
      VariableDeclarator(path) {
        const id = path.node.id;
        const init = path.node.init;
        
        if (t.isIdentifier(id) && /^[A-Z]/.test(id.name)) {
          // Check if it's a function component
          if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
            if (shouldMemoize(id.name)) {
              // Check if already memoized
              if (!t.isCallExpression(init) || 
                  !(init.callee.name === 'memo' || init.callee.name === 'React.memo')) {
                componentsToMemoize.push({
                  path,
                  name: id.name
                });
              }
            }
          }
        }
      },
      
      // Export default function components
      ExportDefaultDeclaration(path) {
        const declaration = path.node.declaration;
        
        if (t.isFunctionDeclaration(declaration) && declaration.id) {
          const name = declaration.id.name;
          if (shouldMemoize(name)) {
            // Convert to const + memo
            const memoizedComponent = t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier(name),
                t.callExpression(
                  t.identifier('memo'),
                  [t.functionExpression(
                    null,
                    declaration.params,
                    declaration.body,
                    declaration.generator,
                    declaration.async
                  )]
                )
              )
            ]);
            
            // Replace with variable declaration + export
            path.insertBefore(memoizedComponent);
            path.node.declaration = t.identifier(name);
            
            hasChanges = true;
            memoizedCount++;
          }
        }
      }
    });
    
    // Apply memoization
    componentsToMemoize.forEach(({ path: componentPath, name }) => {
      const init = componentPath.node.init;
      
      // Wrap in memo()
      componentPath.node.init = t.callExpression(
        t.identifier('memo'),
        [init]
      );
      
      hasChanges = true;
      memoizedCount++;
    });
    
    // Add memo import if needed
    if (hasChanges && !hasMemoImport && hasReactImport) {
      traverse(ast, {
        ImportDeclaration(path) {
          if (path.node.source.value === 'react') {
            // Add memo to existing React import
            path.node.specifiers.push(
              t.importSpecifier(
                t.identifier('memo'),
                t.identifier('memo')
              )
            );
            path.stop();
          }
        }
      });
    }

    if (hasChanges) {
      const { code: newCode } = generate(ast, {
        retainLines: false,
        compact: false,
      });
      
      // Backup and save
      const backupPath = filePath + '.backup';
      fs.copyFileSync(filePath, backupPath);
      fs.writeFileSync(filePath, newCode);
      
      return { 
        updated: true, 
        memoizedCount,
        backup: backupPath 
      };
    }
  } catch (error) {
    return { error: error.message };
  }

  return { noChanges: true };
}

// Main execution
console.log('🚀 Adding React.memo for performance optimization...\n');

// Target component directories
const patterns = [
  'src/components/common/*.tsx',
  'src/components/manga/*Card.tsx',
  'src/components/manga/*List.tsx',
  'src/components/library/*Card.tsx',
  'src/components/library/*List.tsx'
];

let files = [];
patterns.forEach(pattern => {
  files = files.concat(glob.sync(pattern));
});

console.log(`Processing ${files.length} component files...\n`);

let updatedCount = 0;
let totalMemoized = 0;
let errorCount = 0;

files.forEach(file => {
  const result = processFile(file);
  
  if (result.updated) {
    console.log(`✅ Updated: ${file} (${result.memoizedCount} components memoized)`);
    updatedCount++;
    totalMemoized += result.memoizedCount;
  } else if (result.error) {
    console.log(`❌ Error in ${file}: ${result.error}`);
    errorCount++;
  }
});

console.log('\n📊 Summary:');
console.log(`   Files updated: ${updatedCount}`);
console.log(`   Components memoized: ${totalMemoized}`);
console.log(`   Files with errors: ${errorCount}`);

if (updatedCount > 0) {
  console.log('\n⚠️  Next steps:');
  console.log('   1. Run TypeScript check: npx tsc --noEmit');
  console.log('   2. Test component rendering');
  console.log('   3. Verify performance improvements');
}

console.log('\n✨ React.memo optimization complete!');
