#!/usr/bin/env tsx

/**
 * Script to replace Error throws with TRPCError
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');
const ROUTERS_DIR = path.join(SRC_DIR, 'server/trpc/routers');

/**
 * Map error messages to appropriate TRPCError codes
 */
function determineErrorCode(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('not found') || lowerMessage.includes('does not exist')) {
    return 'NOT_FOUND';
  }
  
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('not authenticated')) {
    return 'UNAUTHORIZED';
  }
  
  if (lowerMessage.includes('forbidden') || lowerMessage.includes('permission') || lowerMessage.includes('not allowed')) {
    return 'FORBIDDEN';
  }
  
  if (lowerMessage.includes('already exists') || lowerMessage.includes('duplicate')) {
    return 'CONFLICT';
  }
  
  if (lowerMessage.includes('invalid') || lowerMessage.includes('validation') || lowerMessage.includes('required')) {
    return 'BAD_REQUEST';
  }
  
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'TIMEOUT';
  }
  
  if (lowerMessage.includes('too many') || lowerMessage.includes('rate limit')) {
    return 'TOO_MANY_REQUESTS';
  }
  
  if (lowerMessage.includes('failed') || lowerMessage.includes('error')) {
    return 'INTERNAL_SERVER_ERROR';
  }
  
  return 'INTERNAL_SERVER_ERROR';
}

/**
 * Replace Error throws in a file
 */
function replaceErrorsInFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let replacements = 0;
  
  // Pattern 1: throw new Error('message')
  const throwNewErrorPattern = /throw\s+new\s+Error\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  
  content = content.replace(throwNewErrorPattern, (match, quote, message) => {
    const code = determineErrorCode(message);
    replacements++;
    return `throw new TRPCError({\n      code: '${code}',\n      message: ${quote}${message}${quote}\n    })`;
  });
  
  // Pattern 2: throw new Error(someVariable)
  const throwNewErrorVarPattern = /throw\s+new\s+Error\s*\(\s*([^)]+)\s*\)/g;
  
  content = content.replace(throwNewErrorVarPattern, (match, variable) => {
    // Skip if already replaced or if it's a string literal
    if (match.includes('TRPCError') || /['"`]/.test(variable)) {
      return match;
    }
    
    replacements++;
    return `throw new TRPCError({\n      code: 'INTERNAL_SERVER_ERROR',\n      message: ${variable}\n    })`;
  });
  
  // Pattern 3: throw Error('message') without 'new'
  const throwErrorPattern = /throw\s+Error\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  
  content = content.replace(throwErrorPattern, (match, quote, message) => {
    const code = determineErrorCode(message);
    replacements++;
    return `throw new TRPCError({\n      code: '${code}',\n      message: ${quote}${message}${quote}\n    })`;
  });
  
  // Add TRPCError import if needed and we made replacements
  if (replacements > 0 && !content.includes('import { TRPCError }') && !content.includes('import { TRPCError,')) {
    // Find the first import statement
    const firstImportIndex = content.search(/^import /m);
    if (firstImportIndex !== -1) {
      // Add TRPCError import before the first import
      content = content.slice(0, firstImportIndex) + 
                "import { TRPCError } from '@trpc/server';\n" +
                content.slice(firstImportIndex);
    }
  }
  
  // Write back if modified
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  return replacements;
}

/**
 * Main function
 */
async function replaceAllErrors() {
  console.log('🔄 Replacing Error throws with TRPCError\n');
  console.log('='.repeat(60));
  
  // Get all router files
  const routerFiles = await glob('*.ts', {
    cwd: ROUTERS_DIR,
    ignore: ['index.ts', '*.test.ts', '*.spec.ts'],
  });
  
  console.log(`Found ${routerFiles.length} router files to process\n`);
  
  let totalReplacements = 0;
  let filesModified = 0;
  
  for (const file of routerFiles) {
    const filePath = path.join(ROUTERS_DIR, file);
    const replacements = replaceErrorsInFile(filePath);
    
    if (replacements > 0) {
      console.log(`✅ ${file}: Replaced ${replacements} Error throws`);
      totalReplacements += replacements;
      filesModified++;
    }
  }
  
  // Also process the procedures and errors files if they exist
  const additionalFiles = [
    path.join(SRC_DIR, 'server/trpc/procedures.ts'),
    path.join(SRC_DIR, 'server/trpc/errors.ts'),
    path.join(SRC_DIR, 'server/trpc/trpc.ts'),
  ];
  
  for (const filePath of additionalFiles) {
    if (fs.existsSync(filePath)) {
      const replacements = replaceErrorsInFile(filePath);
      if (replacements > 0) {
        console.log(`✅ ${path.basename(filePath)}: Replaced ${replacements} Error throws`);
        totalReplacements += replacements;
        filesModified++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   Files modified: ${filesModified}`);
  console.log(`   Error throws replaced: ${totalReplacements}`);
  console.log('\n✅ Error replacement complete!');
}

// Run the script
replaceAllErrors().catch(console.error);