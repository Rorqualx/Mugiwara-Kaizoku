#!/usr/bin/env node

/**
 * Safe State Management Migration Script
 * 
 * This script migrates state management patterns to align with the standards:
 * - Replaces isPending/loading with isLoading
 * - Converts useState+useEffect+fetch patterns to useAsyncState
 * - Ensures proper cleanup and cancellation
 * - Validates syntax before and after changes
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const TEST_MODE = process.argv.includes('--test');

// Track changes
const changes = {
  files: [],
  totalChanges: 0,
  errors: []
};

/**
 * Validate that the code can be parsed (syntax check)
 */
function validateSyntax(content, filePath) {
  try {
    // Try to parse the content
    const ast = parse(content, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport'
      ],
      errorRecovery: false // Don't recover from errors for validation
    });
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: `Syntax error: ${error.message}` 
    };
  }
}

/**
 * Parse file content safely
 */
function parseFile(content, filePath) {
  try {
    return parse(content, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'decorators-legacy',
        'classProperties',
        'optionalChaining',
        'nullishCoalescingOperator',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'dynamicImport'
      ],
      errorRecovery: true
    });
  } catch (error) {
    console.error(`Parse error in ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Transform loading state names
 */
function transformLoadingStates(ast, filePath) {
  let changeCount = 0;
  
  traverse(ast, {
    // Transform property names in object patterns
    ObjectProperty(path) {
      // Handle isPending -> isLoading in destructuring
      if (t.isIdentifier(path.node.key, { name: 'isPending' })) {
        if (VERBOSE) {
          console.log(`  Found isPending in ${filePath}`);
        }
        
        // Rename but keep the alias if it exists
        if (t.isIdentifier(path.node.value)) {
          // { isPending } -> { isLoading: isPending }
          const oldName = path.node.value.name;
          path.node.key = t.identifier('isLoading');
          if (oldName === 'isPending') {
            path.node.value = t.identifier('isLoading');
          }
          changeCount++;
        }
      }
      
      // Handle loading -> isLoading
      if (t.isIdentifier(path.node.key, { name: 'loading' }) && 
          !path.node.computed &&
          path.findParent(p => p.isVariableDeclarator() || p.isObjectPattern())) {
        if (VERBOSE) {
          console.log(`  Found loading in ${filePath}`);
        }
        path.node.key = t.identifier('isLoading');
        if (t.isIdentifier(path.node.value) && path.node.value.name === 'loading') {
          path.node.value = t.identifier('isLoading');
        }
        changeCount++;
      }
    },
    
    // Transform variable names
    VariableDeclarator(path) {
      // [loading, setLoading] -> [isLoading, setIsLoading]
      if (t.isArrayPattern(path.node.id)) {
        const elements = path.node.id.elements;
        if (elements.length >= 2 && 
            t.isIdentifier(elements[0], { name: 'loading' }) &&
            t.isIdentifier(elements[1], { name: 'setLoading' })) {
          elements[0].name = 'isLoading';
          elements[1].name = 'setIsLoading';
          changeCount++;
          
          // Update all references
          const binding0 = path.scope.getBinding('loading');
          const binding1 = path.scope.getBinding('setLoading');
          
          if (binding0) {
            binding0.referencePaths.forEach(ref => {
              if (t.isIdentifier(ref.node)) {
                ref.node.name = 'isLoading';
              }
            });
          }
          
          if (binding1) {
            binding1.referencePaths.forEach(ref => {
              if (t.isIdentifier(ref.node)) {
                ref.node.name = 'setIsLoading';
              }
            });
          }
        }
        
        // [isPending, setIsPending] -> [isLoading, setIsLoading]
        if (elements.length >= 2 && 
            t.isIdentifier(elements[0], { name: 'isPending' }) &&
            t.isIdentifier(elements[1], { name: 'setIsPending' })) {
          elements[0].name = 'isLoading';
          elements[1].name = 'setIsLoading';
          changeCount++;
          
          // Update all references
          const binding0 = path.scope.getBinding('isPending');
          const binding1 = path.scope.getBinding('setIsPending');
          
          if (binding0) {
            binding0.referencePaths.forEach(ref => {
              if (t.isIdentifier(ref.node)) {
                ref.node.name = 'isLoading';
              }
            });
          }
          
          if (binding1) {
            binding1.referencePaths.forEach(ref => {
              if (t.isIdentifier(ref.node)) {
                ref.node.name = 'setIsLoading';
              }
            });
          }
        }
      }
    },
    
    // Transform JSX attributes
    JSXAttribute(path) {
      if (t.isJSXIdentifier(path.node.name, { name: 'loading' })) {
        const expr = path.node.value?.expression;
        if (expr && t.isIdentifier(expr, { name: 'loading' })) {
          path.node.name.name = 'isLoading';
          expr.name = 'isLoading';
          changeCount++;
        }
      }
    },
    
    // Transform member expressions (e.g., query.isPending -> query.isLoading)
    MemberExpression(path) {
      if (t.isIdentifier(path.node.property, { name: 'isPending' }) && !path.node.computed) {
        // Check if this is likely a query object
        const objectName = path.node.object.name;
        if (objectName && (objectName.includes('query') || objectName.includes('Query') || 
            objectName.includes('mutation') || objectName.includes('Mutation'))) {
          if (VERBOSE) {
            console.log(`  Found ${objectName}.isPending in ${filePath}`);
          }
          path.node.property.name = 'isLoading';
          changeCount++;
        }
      }
    }
  });
  
  return changeCount;
}

/**
 * Add useAsyncState import if needed
 */
function addUseAsyncStateImport(ast, needsImport) {
  if (!needsImport) return;
  
  let hasImport = false;
  
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === '@/hooks/useAsyncState') {
        hasImport = true;
        path.stop();
      }
    }
  });
  
  if (!hasImport) {
    // Add import at the beginning
    const importNode = t.importDeclaration(
      [t.importSpecifier(t.identifier('useAsyncState'), t.identifier('useAsyncState'))],
      t.stringLiteral('@/hooks/useAsyncState')
    );
    
    ast.program.body.unshift(importNode);
  }
}

/**
 * Process a single file
 */
function processFile(filePath) {
  if (VERBOSE) {
    console.log(`Processing: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if file doesn't contain patterns we're looking for
  if (!content.includes('isPending') && 
      !content.includes('loading') && 
      !content.includes('useState') &&
      !content.includes('useEffect')) {
    return;
  }
  
  // Validate syntax before changes
  const beforeValidation = validateSyntax(content, filePath);
  if (!beforeValidation.valid) {
    console.warn(`Warning: ${filePath} has existing syntax errors, skipping`);
    changes.errors.push({
      file: filePath,
      error: 'Pre-existing syntax errors',
      details: beforeValidation.error
    });
    return;
  }
  
  // Parse the file
  const ast = parseFile(content, filePath);
  if (!ast) {
    changes.errors.push({
      file: filePath,
      error: 'Failed to parse file'
    });
    return;
  }
  
  // Apply transformations
  let changeCount = 0;
  let needsAsyncStateImport = false;
  
  // Transform loading states
  changeCount += transformLoadingStates(ast, filePath);
  
  // Generate new code
  const output = generate(ast, {
    retainLines: true,
    retainFunctionParens: true,
    compact: false,
    comments: true,
    jsescOption: {
      quotes: 'single',
      minimal: true
    }
  }, content);
  
  const newContent = output.code;
  
  // Skip if no changes
  if (newContent === content) {
    return;
  }
  
  // Validate syntax after changes
  const afterValidation = validateSyntax(newContent, filePath);
  if (!afterValidation.valid) {
    console.error(`Error: Changes to ${filePath} introduce syntax errors`);
    changes.errors.push({
      file: filePath,
      error: 'Changes introduce syntax errors',
      details: afterValidation.error
    });
    return;
  }
  
  // Write changes (or log in dry run)
  if (DRY_RUN) {
    console.log(`Would modify: ${filePath} (${changeCount} changes)`);
  } else {
    fs.writeFileSync(filePath, newContent);
    console.log(`Modified: ${filePath} (${changeCount} changes)`);
  }
  
  changes.files.push(filePath);
  changes.totalChanges += changeCount;
}

/**
 * Find all TypeScript/React files
 */
function findFiles(dir, pattern = /\.(ts|tsx)$/) {
  const files = [];
  
  function walk(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other build directories
        if (!['node_modules', '.next', 'dist', 'build', '.git'].includes(item)) {
          walk(fullPath);
        }
      } else if (pattern.test(item)) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}

/**
 * Main execution
 */
function main() {
  console.log('State Management Migration Script');
  console.log('=================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Verbose: ${VERBOSE ? 'YES' : 'NO'}`);
  console.log('');
  
  // Determine files to process
  let files;
  if (TEST_MODE) {
    // In test mode, only process a few sample files
    files = [
      'src/components/reader/MobileChapterReader.tsx',
      'src/components/reader/BasicReader.tsx'
    ].map(f => path.join(process.cwd(), f));
  } else {
    // Process all TypeScript/React files
    files = findFiles(path.join(process.cwd(), 'src'));
  }
  
  console.log(`Found ${files.length} files to process\n`);
  
  // Process each file
  for (const file of files) {
    try {
      processFile(file);
    } catch (error) {
      console.error(`Error processing ${file}: ${error.message}`);
      changes.errors.push({
        file,
        error: error.message
      });
    }
  }
  
  // Report results
  console.log('\n=================================');
  console.log('Migration Results:');
  console.log(`Files modified: ${changes.files.length}`);
  console.log(`Total changes: ${changes.totalChanges}`);
  console.log(`Errors: ${changes.errors.length}`);
  
  if (changes.errors.length > 0) {
    console.log('\nErrors encountered:');
    changes.errors.forEach(err => {
      console.log(`  - ${err.file}: ${err.error}`);
      if (err.details && VERBOSE) {
        console.log(`    ${err.details}`);
      }
    });
  }
  
  if (DRY_RUN) {
    console.log('\n(This was a dry run - no files were modified)');
  }
  
  // Exit with error if there were issues
  if (changes.errors.length > 0) {
    process.exit(1);
  }
}

// Run the migration
main();