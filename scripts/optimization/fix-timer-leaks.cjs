#!/usr/bin/env node

/**
 * Fix Timer Memory Leaks
 * 
 * Ensures all setTimeout and setInterval calls are properly cleaned up
 * in React components to prevent memory leaks.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const glob = require('glob');

function processFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  let timerCount = 0;
  let fixedCount = 0;
  
  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy']
    });

    // Track timer references for cleanup
    const timersInComponent = new Map(); // component -> timers
    const currentComponent = { name: null };

    traverse(ast, {
      // Track which component we're in
      FunctionDeclaration(path) {
        if (path.node.id && /^[A-Z]/.test(path.node.id.name)) {
          currentComponent.name = path.node.id.name;
        }
      },
      FunctionExpression(path) {
        if (path.parent.type === 'VariableDeclarator' && 
            path.parent.id.name && /^[A-Z]/.test(path.parent.id.name)) {
          currentComponent.name = path.parent.id.name;
        }
      },
      ArrowFunctionExpression(path) {
        if (path.parent.type === 'VariableDeclarator' && 
            path.parent.id.name && /^[A-Z]/.test(path.parent.id.name)) {
          currentComponent.name = path.parent.id.name;
        }
      },

      CallExpression(path) {
        const callee = path.node.callee;
        
        // Check for setTimeout/setInterval
        if (t.isIdentifier(callee) && 
            (callee.name === 'setTimeout' || callee.name === 'setInterval')) {
          timerCount++;
          
          // Check if it's inside a useEffect
          let inUseEffect = false;
          let useEffectPath = null;
          let currentPath = path;
          
          while (currentPath) {
            if (currentPath.isCallExpression() && 
                currentPath.node.callee.name === 'useEffect') {
              inUseEffect = true;
              useEffectPath = currentPath;
              break;
            }
            currentPath = currentPath.parentPath;
          }

          if (inUseEffect) {
            // Check if there's already a cleanup function
            const effectCallback = useEffectPath.node.arguments[0];
            if (t.isArrowFunctionExpression(effectCallback) || 
                t.isFunctionExpression(effectCallback)) {
              const body = effectCallback.body;
              
              // Check if cleanup exists
              let hasCleanup = false;
              if (t.isBlockStatement(body)) {
                const returnStmt = body.body.find(stmt => t.isReturnStatement(stmt));
                if (returnStmt && returnStmt.argument) {
                  hasCleanup = true;
                }
              }

              if (!hasCleanup) {
                // Need to add cleanup
                const timerVar = t.identifier(`timer${Date.now()}`);
                
                // Wrap timer call in variable assignment
                if (path.parent.type !== 'VariableDeclarator') {
                  const assignment = t.variableDeclaration('const', [
                    t.variableDeclarator(timerVar, path.node)
                  ]);
                  
                  if (t.isBlockStatement(body)) {
                    // Find where to insert
                    const stmtPath = path.findParent(p => body.body.includes(p.node));
                    if (stmtPath) {
                      const index = body.body.indexOf(stmtPath.node);
                      body.body[index] = assignment;
                      
                      // Add cleanup return
                      const clearFn = callee.name === 'setTimeout' ? 'clearTimeout' : 'clearInterval';
                      const cleanup = t.arrowFunctionExpression(
                        [],
                        t.blockStatement([
                          t.expressionStatement(
                            t.callExpression(t.identifier(clearFn), [timerVar])
                          )
                        ])
                      );
                      
                      body.body.push(t.returnStatement(cleanup));
                      hasChanges = true;
                      fixedCount++;
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (hasChanges) {
      const { code: newCode } = generate(ast, {
        retainLines: false,
        compact: false
      });
      
      // Backup and save
      fs.copyFileSync(filePath, filePath + '.backup');
      fs.writeFileSync(filePath, newCode);
      
      return { fixed: fixedCount, total: timerCount };
    }
  } catch (error) {
    return { error: error.message };
  }

  return { total: timerCount };
}

// Main execution
console.log('🔍 Scanning for timer memory leaks...\n');

const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['**/node_modules/**', '**/backups/**']
});

let totalTimers = 0;
let totalFixed = 0;
let errorCount = 0;

files.forEach(file => {
  const result = processFile(file);
  
  if (result.error) {
    console.log(`❌ Error in ${file}: ${result.error}`);
    errorCount++;
  } else if (result.fixed) {
    console.log(`✅ Fixed ${result.fixed}/${result.total} timers in ${file}`);
    totalFixed += result.fixed;
    totalTimers += result.total;
  } else if (result.total > 0) {
    totalTimers += result.total;
  }
});

console.log('\n📊 Summary:');
console.log(`   Total timers found: ${totalTimers}`);
console.log(`   Timers fixed: ${totalFixed}`);
console.log(`   Files with errors: ${errorCount}`);

if (totalFixed > 0) {
  console.log('\n⚠️  Please review changes and test thoroughly');
}

console.log('\n✨ Timer leak analysis complete!');
