#!/usr/bin/env node

/**
 * Smart Type Safety Script
 * 
 * Replaces 'any' with 'unknown' AND adds appropriate type guards
 * to prevent errors
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const glob = require('glob');

// Common type guard patterns
const TYPE_GUARD_PATTERNS = {
  event: {
    pattern: /^(e|event|evt)$/,
    guard: 'as Event',
    import: null
  },
  error: {
    pattern: /^(err|error|ex|exception)$/,
    guard: 'as Error',
    import: null
  },
  progressEvent: {
    pattern: /onprogress|upload\.on/,
    guard: 'as ProgressEvent',
    import: null
  },
  messageEvent: {
    pattern: /onmessage|message/,
    guard: 'as MessageEvent',
    import: null
  },
  response: {
    pattern: /^(res|response|result|data)$/,
    guard: null,
    needsCheck: true
  }
};

function shouldSkipFile(filePath) {
  const skipPatterns = [
    '.d.ts',
    'node_modules',
    'backups',
    '.next',
    'test.',
    'spec.'
  ];
  return skipPatterns.some(pattern => filePath.includes(pattern));
}

function getAppropriateGuard(paramName, context) {
  // Check parameter name patterns
  for (const [type, config] of Object.entries(TYPE_GUARD_PATTERNS)) {
    if (config.pattern.test(paramName)) {
      return config;
    }
  }
  
  // Check context patterns
  if (context && context.includes('catch')) {
    return TYPE_GUARD_PATTERNS.error;
  }
  
  return null;
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return { skipped: true };
  }

  const code = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  let replacements = 0;
  let guardsAdded = 0;
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
    });

    // Track if we need to import type guards
    let needsTypeGuardImport = false;
    let hasTypeGuardImport = false;

    // Check for existing type guard import
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === '../utils/type-guards' ||
            path.node.source.value === '../../utils/type-guards' ||
            path.node.source.value === './type-guards') {
          hasTypeGuardImport = true;
        }
      }
    });

    traverse(ast, {
      // Replace any in type annotations
      TSAnyKeyword(path) {
        // Skip 'as any' assertions
        if (path.parent.type === 'TSAsExpression') {
          return;
        }
        
        // Replace with unknown
        path.replaceWith(t.tsUnknownKeyword());
        hasChanges = true;
        replacements++;
      },
      
      // Handle function parameters
      FunctionDeclaration(path) {
        handleFunctionParams(path);
      },
      FunctionExpression(path) {
        handleFunctionParams(path);
      },
      ArrowFunctionExpression(path) {
        handleFunctionParams(path);
      },
      
      // Handle catch clauses
      CatchClause(path) {
        if (path.node.param && t.isIdentifier(path.node.param)) {
          if (!path.node.param.typeAnnotation) {
            path.node.param.typeAnnotation = t.tsTypeAnnotation(
              t.tsUnknownKeyword()
            );
            hasChanges = true;
            replacements++;
          }
          
          // Add type guard at the beginning of catch block
          const errorVar = path.node.param.name;
          const body = path.node.body;
          
          // Check if guard already exists
          const hasGuard = body.body.some(stmt => 
            t.isVariableDeclaration(stmt) && 
            stmt.declarations.some(decl => 
              decl.init && t.isTSAsExpression(decl.init)
            )
          );
          
          if (!hasGuard && body.body.length > 0) {
            // Add error type assertion as first statement
            const errorAssertion = t.variableDeclaration('const', [
              t.variableDeclarator(
                t.identifier('typedError'),
                t.tsAsExpression(
                  t.identifier(errorVar),
                  t.tsTypeReference(t.identifier('Error'))
                )
              )
            ]);
            
            // Insert at beginning
            body.body.unshift(errorAssertion);
            guardsAdded++;
            hasChanges = true;
          }
        }
      },
      
      // Handle property access on unknown values
      MemberExpression(path) {
        const object = path.node.object;
        
        // Check if accessing properties on a parameter
        if (t.isIdentifier(object)) {
          const binding = path.scope.getBinding(object.name);
          
          if (binding && binding.path.isIdentifier()) {
            const param = binding.path.node;
            
            // Check if it has unknown type annotation
            if (param.typeAnnotation && 
                param.typeAnnotation.typeAnnotation.type === 'TSUnknownKeyword') {
              
              // Wrap in type assertion if not already wrapped
              if (path.parent.type !== 'TSAsExpression') {
                const guard = getAppropriateGuard(object.name, '');
                
                if (guard && guard.guard) {
                  // Add type assertion
                  const assertion = t.tsAsExpression(
                    t.identifier(object.name),
                    t.tsTypeReference(t.identifier(guard.guard.replace('as ', '')))
                  );
                  
                  path.node.object = assertion;
                  guardsAdded++;
                  hasChanges = true;
                }
              }
            }
          }
        }
      }
    });
    
    function handleFunctionParams(path) {
      const params = path.node.params;
      const body = path.node.body;
      
      params.forEach((param, index) => {
        if (t.isIdentifier(param)) {
          const paramName = param.name;
          const guard = getAppropriateGuard(paramName, '');
          
          // Add unknown type if missing
          if (!param.typeAnnotation) {
            param.typeAnnotation = t.tsTypeAnnotation(t.tsUnknownKeyword());
            hasChanges = true;
            replacements++;
            
            // Add type guard in function body if needed
            if (guard && guard.guard && t.isBlockStatement(body)) {
              const guardVar = t.variableDeclaration('const', [
                t.variableDeclarator(
                  t.identifier(`typed${paramName.charAt(0).toUpperCase() + paramName.slice(1)}`),
                  t.tsAsExpression(
                    t.identifier(paramName),
                    t.tsTypeReference(t.identifier(guard.guard.replace('as ', '')))
                  )
                )
              ]);
              
              // Add at beginning of function
              body.body.unshift(guardVar);
              guardsAdded++;
              needsTypeGuardImport = guard.needsCheck || false;
            }
          }
        }
      });
    }

    // Add type guard import if needed
    if (needsTypeGuardImport && !hasTypeGuardImport) {
      const importDecl = t.importDeclaration(
        [t.importSpecifier(
          t.identifier('isObject'),
          t.identifier('isObject')
        )],
        t.stringLiteral('../utils/type-guards')
      );
      
      ast.program.body.unshift(importDecl);
      hasChanges = true;
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
        replacements, 
        guardsAdded,
        backup: backupPath 
      };
    }
  } catch (error) {
    return { error: error.message };
  }

  return { noChanges: true };
}

// Main execution
console.log('🔍 Smart type safety improvements...\n');

// Process specific problematic files first
const targetFiles = [
  'src/hooks/useBackupProgress.ts',
  'src/hooks/useBackupUpload.ts',
  'src/hooks/useCalendar.ts',
  'src/hooks/useFormValidation.ts',
  'src/hooks/useLibraryScanner.ts',
  'src/hooks/useAsyncState.ts'
];

console.log(`Processing ${targetFiles.length} targeted files...\n`);

let updatedCount = 0;
let totalReplacements = 0;
let totalGuards = 0;
let errorCount = 0;

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`⚠️ File not found: ${file}`);
    return;
  }
  
  const result = processFile(file);
  
  if (result.updated) {
    console.log(`✅ Updated: ${file}`);
    console.log(`   Replacements: ${result.replacements}, Guards added: ${result.guardsAdded}`);
    updatedCount++;
    totalReplacements += result.replacements;
    totalGuards += result.guardsAdded;
  } else if (result.error) {
    console.log(`❌ Error in ${file}: ${result.error}`);
    errorCount++;
  }
});

console.log('\n📊 Summary:');
console.log(`   Files updated: ${updatedCount}`);
console.log(`   Total any→unknown: ${totalReplacements}`);
console.log(`   Type guards added: ${totalGuards}`);
console.log(`   Files with errors: ${errorCount}`);

if (updatedCount > 0) {
  console.log('\n⚠️  Next steps:');
  console.log('   1. Run TypeScript check: npx tsc --noEmit');
  console.log('   2. Review the added type guards');
  console.log('   3. Test affected functionality');
}

console.log('\n✨ Smart type safety complete!');
