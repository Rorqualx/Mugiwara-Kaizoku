#!/usr/bin/env node

/**
 * Master Code Deduplication Script
 * 
 * This script orchestrates the migration of duplicate code patterns
 * to use centralized utility functions.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { execSync } from 'child_process';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Statistics tracking
const stats = {
  filesProcessed: 0,
  filesModified: 0,
  errorPatternsFixed: 0,
  notificationPatternsFixed: 0,
  asyncResultPatternsFixed: 0,
  loadingPatternsFixed: 0,
  linesRemoved: 0
};

/**
 * Logger utility
 */
class Logger {
  static info(message: string) {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
  }

  static success(message: string) {
    console.log(`${colors.green}✓${colors.reset} ${message}`);
  }

  static warning(message: string) {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
  }

  static error(message: string) {
    console.log(`${colors.red}✖${colors.reset} ${message}`);
  }

  static header(message: string) {
    console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${message}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
  }
}

/**
 * Create a backup of the current state
 */
function createBackup(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `backups/deduplication-${timestamp}`;
  
  Logger.info(`Creating backup at ${backupDir}...`);
  
  execSync(`mkdir -p ${backupDir}`);
  execSync(`cp -r src ${backupDir}/`);
  
  Logger.success(`Backup created successfully`);
  return backupDir;
}

/**
 * Calculate relative import path
 */
function calculateRelativePath(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  let relativePath = path.relative(fromDir, toFile);
  
  if (!relativePath.startsWith('.')) {
    relativePath = './' + relativePath;
  }
  
  // Remove file extension
  relativePath = relativePath.replace(/\.(ts|tsx)$/, '');
  
  return relativePath;
}

/**
 * Transform error patterns
 */
function transformErrorPatterns(sourceFile: ts.SourceFile, filePath: string): {
  transformed: ts.SourceFile;
  modified: boolean;
  count: number;
} {
  let modificationCount = 0;
  let needsImport = false;

  const visitor = (node: ts.Node): ts.Node => {
    // Pattern 1: error instanceof Error ? error.message : String(error)
    if (ts.isConditionalExpression(node)) {
      const { condition, whenTrue, whenFalse } = node;
      
      if (ts.isBinaryExpression(condition) && 
          condition.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword &&
          ts.isIdentifier(condition.right) && condition.right.text === 'Error') {
        
        const errorVar = condition.left;
        
        // Check for .message access
        if (ts.isPropertyAccessExpression(whenTrue) &&
            ts.isIdentifier(whenTrue.name) && whenTrue.name.text === 'message') {
          
          modificationCount++;
          needsImport = true;
          
          // Create getErrorMessage call
          return ts.factory.createCallExpression(
            ts.factory.createIdentifier('getErrorMessage'),
            undefined,
            [errorVar]
          );
        }
      }
    }
    
    // Pattern 2: error?.message || 'fallback'
    if (ts.isBinaryExpression(node) && 
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      
      const left = node.left;
      
      if (ts.isPropertyAccessExpression(left) &&
          ts.isIdentifier(left.name) && left.name.text === 'message' &&
          (ts.isIdentifier(left.expression) && left.expression.text.includes('error'))) {
        
        modificationCount++;
        needsImport = true;
        
        return ts.factory.createCallExpression(
          ts.factory.createIdentifier('formatError'),
          undefined,
          [left.expression, node.right]
        );
      }
    }
    
    return ts.visitEachChild(node, visitor, undefined);
  };
  
  let transformed = ts.visitNode(sourceFile, visitor) as ts.SourceFile;
  
  // Add import if needed
  if (needsImport) {
    const importPath = calculateRelativePath(filePath, 'src/utils/errors/helpers');
    const hasImport = sourceFile.statements.some(stmt =>
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text.includes('errors/helpers')
    );
    
    if (!hasImport) {
      const importDecl = ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamedImports([
            ts.factory.createImportSpecifier(
              false,
              undefined,
              ts.factory.createIdentifier('getErrorMessage')
            ),
            ts.factory.createImportSpecifier(
              false,
              undefined,
              ts.factory.createIdentifier('formatError')
            )
          ])
        ),
        ts.factory.createStringLiteral(importPath)
      );
      
      transformed = ts.factory.updateSourceFile(
        transformed,
        [importDecl, ...transformed.statements]
      );
    }
  }
  
  return {
    transformed,
    modified: modificationCount > 0,
    count: modificationCount
  };
}

/**
 * Transform notification patterns
 */
function transformNotificationPatterns(sourceFile: ts.SourceFile, filePath: string): {
  transformed: ts.SourceFile;
  modified: boolean;
  count: number;
} {
  let modificationCount = 0;
  const requiredImports = new Set<string>();

  const visitor = (node: ts.Node): ts.Node => {
    // Pattern: notifications.show({ title: '...', message: '...', color: '...' })
    if (ts.isCallExpression(node) && 
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) && 
        node.expression.expression.text === 'notifications' &&
        ts.isIdentifier(node.expression.name) && 
        node.expression.name.text === 'show') {
      
      const arg = node.arguments[0];
      
      if (ts.isObjectLiteralExpression(arg)) {
        const properties = new Map<string, ts.Expression>();
        
        arg.properties.forEach(prop => {
          if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            properties.set(prop.name.text, prop.initializer);
          }
        });
        
        const color = properties.get('color');
        const message = properties.get('message');
        const title = properties.get('title');
        
        if (color && ts.isStringLiteral(color)) {
          let functionName: string | null = null;
          
          switch (color.text) {
            case 'green':
              functionName = 'showSuccess';
              break;
            case 'red':
              functionName = 'showError';
              break;
            case 'yellow':
              functionName = 'showWarning';
              break;
            case 'blue':
              functionName = 'showInfo';
              break;
          }
          
          if (functionName) {
            modificationCount++;
            requiredImports.add(functionName);
            
            // Create new function call
            let args: ts.Expression[] = [];
            
            if (functionName === 'showError' && message) {
              // For errors, first arg is the error/message
              args = [message];
              if (title && !ts.isStringLiteral(title)) {
                args.push(title);
              }
            } else if (message) {
              // For other notifications, pass an object or string
              if (title) {
                args = [ts.factory.createObjectLiteralExpression([
                  ts.factory.createPropertyAssignment('title', title),
                  ts.factory.createPropertyAssignment('message', message)
                ])];
              } else {
                args = [message];
              }
            }
            
            return ts.factory.createCallExpression(
              ts.factory.createIdentifier(functionName),
              undefined,
              args
            );
          }
        }
      }
    }
    
    return ts.visitEachChild(node, visitor, undefined);
  };
  
  let transformed = ts.visitNode(sourceFile, visitor) as ts.SourceFile;
  
  // Add imports if needed
  if (requiredImports.size > 0) {
    const importPath = calculateRelativePath(filePath, 'src/utils/notifications/helpers');
    const hasImport = sourceFile.statements.some(stmt =>
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text.includes('notifications/helpers')
    );
    
    if (!hasImport) {
      const importDecl = ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamedImports(
            Array.from(requiredImports).map(name =>
              ts.factory.createImportSpecifier(
                false,
                undefined,
                ts.factory.createIdentifier(name)
              )
            )
          )
        ),
        ts.factory.createStringLiteral(importPath)
      );
      
      // Remove old notifications import if exists
      const filteredStatements = transformed.statements.filter(stmt => {
        if (ts.isImportDeclaration(stmt) &&
            ts.isStringLiteral(stmt.moduleSpecifier) &&
            stmt.moduleSpecifier.text.includes('@mantine/notifications')) {
          return false;
        }
        return true;
      });
      
      transformed = ts.factory.updateSourceFile(
        transformed,
        [importDecl, ...filteredStatements]
      );
    }
  }
  
  return {
    transformed,
    modified: modificationCount > 0,
    count: modificationCount
  };
}

/**
 * Transform AsyncResult patterns
 */
function transformAsyncResultPatterns(sourceFile: ts.SourceFile, filePath: string): {
  transformed: ts.SourceFile;
  modified: boolean;
  count: number;
} {
  let modificationCount = 0;
  const requiredImports = new Set<string>();

  const visitor = (node: ts.Node): ts.Node => {
    // Pattern: if (isSuccess(result)) { ... return result.data ... }
    if (ts.isIfStatement(node) && !node.elseStatement) {
      const condition = node.expression;
      
      if (ts.isCallExpression(condition) &&
          ts.isIdentifier(condition.expression) &&
          condition.expression.text === 'isSuccess' &&
          condition.arguments.length === 1) {
        
        const resultVar = condition.arguments[0];
        const thenStatement = node.thenStatement;
        
        // Check for simple return result.data pattern
        if (ts.isBlock(thenStatement) &&
            thenStatement.statements.length === 1 &&
            ts.isReturnStatement(thenStatement.statements[0]) &&
            thenStatement.statements[0].expression) {
          
          const returnExpr = thenStatement.statements[0].expression;
          
          if (ts.isPropertyAccessExpression(returnExpr) &&
              ts.isIdentifier(returnExpr.name) &&
              returnExpr.name.text === 'data') {
            
            modificationCount++;
            requiredImports.add('unwrapResult');
            
            return ts.factory.createReturnStatement(
              ts.factory.createCallExpression(
                ts.factory.createIdentifier('unwrapResult'),
                undefined,
                [resultVar]
              )
            );
          }
        }
      }
    }
    
    // Pattern: isSuccess(result) ? result.data : defaultValue
    if (ts.isConditionalExpression(node)) {
      const condition = node.condition;
      
      if (ts.isCallExpression(condition) &&
          ts.isIdentifier(condition.expression) &&
          condition.expression.text === 'isSuccess' &&
          condition.arguments.length === 1) {
        
        const resultVar = condition.arguments[0];
        const whenTrue = node.whenTrue;
        const whenFalse = node.whenFalse;
        
        if (ts.isPropertyAccessExpression(whenTrue) &&
            ts.isIdentifier(whenTrue.name) &&
            whenTrue.name.text === 'data') {
          
          modificationCount++;
          requiredImports.add('unwrapOr');
          
          return ts.factory.createCallExpression(
            ts.factory.createIdentifier('unwrapOr'),
            undefined,
            [resultVar, whenFalse]
          );
        }
      }
    }
    
    return ts.visitEachChild(node, visitor, undefined);
  };
  
  let transformed = ts.visitNode(sourceFile, visitor) as ts.SourceFile;
  
  // Add imports if needed
  if (requiredImports.size > 0) {
    const importPath = calculateRelativePath(filePath, 'src/utils/async-result/helpers');
    const hasImport = sourceFile.statements.some(stmt =>
      ts.isImportDeclaration(stmt) &&
      ts.isStringLiteral(stmt.moduleSpecifier) &&
      stmt.moduleSpecifier.text.includes('async-result/helpers')
    );
    
    if (!hasImport) {
      const importDecl = ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamedImports(
            Array.from(requiredImports).map(name =>
              ts.factory.createImportSpecifier(
                false,
                undefined,
                ts.factory.createIdentifier(name)
              )
            )
          )
        ),
        ts.factory.createStringLiteral(importPath)
      );
      
      transformed = ts.factory.updateSourceFile(
        transformed,
        [importDecl, ...transformed.statements]
      );
    }
  }
  
  return {
    transformed,
    modified: modificationCount > 0,
    count: modificationCount
  };
}

/**
 * Process a single file
 */
function processFile(filePath: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
    
    stats.filesProcessed++;
    
    // Apply transformations
    let currentFile = sourceFile;
    let wasModified = false;
    
    // Transform error patterns
    const errorResult = transformErrorPatterns(currentFile, filePath);
    if (errorResult.modified) {
      currentFile = errorResult.transformed;
      stats.errorPatternsFixed += errorResult.count;
      wasModified = true;
    }
    
    // Transform notification patterns
    const notificationResult = transformNotificationPatterns(currentFile, filePath);
    if (notificationResult.modified) {
      currentFile = notificationResult.transformed;
      stats.notificationPatternsFixed += notificationResult.count;
      wasModified = true;
    }
    
    // Transform AsyncResult patterns
    const asyncResult = transformAsyncResultPatterns(currentFile, filePath);
    if (asyncResult.modified) {
      currentFile = asyncResult.transformed;
      stats.asyncResultPatternsFixed += asyncResult.count;
      wasModified = true;
    }
    
    // Write back if modified
    if (wasModified) {
      const printer = ts.createPrinter({
        newLine: ts.NewLineKind.LineFeed,
        removeComments: false
      });
      
      const result = printer.printFile(currentFile);
      fs.writeFileSync(filePath, result);
      
      stats.filesModified++;
      
      // Estimate lines removed
      const originalLines = content.split('\n').length;
      const newLines = result.split('\n').length;
      stats.linesRemoved += Math.max(0, originalLines - newLines);
      
      Logger.success(`Modified: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    Logger.error(`Failed to process ${filePath}: ${error}`);
    return false;
  }
}

/**
 * Main migration function
 */
async function main() {
  Logger.header('Code Deduplication Migration');
  
  // Create backup
  const backupDir = createBackup();
  
  // Get all TypeScript files
  const files = glob.sync('src/**/*.{ts,tsx}', {
    ignore: [
      '**/node_modules/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/utils/errors/helpers.ts',
      '**/utils/notifications/helpers.ts',
      '**/utils/async-result/helpers.ts'
    ]
  });
  
  Logger.info(`Found ${files.length} files to process`);
  
  // Process files
  Logger.header('Processing Files');
  
  for (const file of files) {
    processFile(file);
  }
  
  // Print statistics
  Logger.header('Migration Statistics');
  
  console.log(`Files Processed: ${colors.cyan}${stats.filesProcessed}${colors.reset}`);
  console.log(`Files Modified: ${colors.green}${stats.filesModified}${colors.reset}`);
  console.log(`Error Patterns Fixed: ${colors.green}${stats.errorPatternsFixed}${colors.reset}`);
  console.log(`Notification Patterns Fixed: ${colors.green}${stats.notificationPatternsFixed}${colors.reset}`);
  console.log(`AsyncResult Patterns Fixed: ${colors.green}${stats.asyncResultPatternsFixed}${colors.reset}`);
  console.log(`Estimated Lines Removed: ${colors.green}${stats.linesRemoved}${colors.reset}`);
  
  // Run type check
  Logger.header('Running Type Check');
  
  try {
    execSync('npm run type-check', { stdio: 'inherit' });
    Logger.success('Type check passed!');
  } catch (error) {
    Logger.error('Type check failed. Please review the changes.');
    Logger.warning(`Restore from backup if needed: ${backupDir}`);
  }
  
  Logger.header('Migration Complete!');
  Logger.info(`Backup saved at: ${backupDir}`);
  Logger.info('Please review the changes and run tests before committing.');
}

// Run the migration
main().catch(error => {
  Logger.error(`Migration failed: ${error}`);
  process.exit(1);
});

export { transformErrorPatterns, transformNotificationPatterns, transformAsyncResultPatterns };