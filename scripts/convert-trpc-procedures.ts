#!/usr/bin/env tsx

/**
 * Script to convert untyped tRPC procedures to typed variants
 * Transforms: procedure -> publicProcedure/protectedProcedure/adminProcedure
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as ts from 'typescript';

const SRC_DIR = path.join(process.cwd(), 'src');
const ROUTERS_DIR = path.join(SRC_DIR, 'server/trpc/routers');

interface ProcedureInfo {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  hasInput: boolean;
  line: number;
  suggestedType: 'public' | 'protected' | 'admin';
}

/**
 * Analyze procedure name to suggest appropriate type
 */
function suggestProcedureType(name: string, type: 'query' | 'mutation' | 'subscription'): 'public' | 'protected' | 'admin' {
  const lowerName = name.toLowerCase();
  
  // Admin procedures
  if (lowerName.includes('delete') && !lowerName.includes('my')) return 'admin';
  if (lowerName.includes('admin')) return 'admin';
  if (lowerName.includes('system')) return 'admin';
  if (lowerName.includes('config') && type === 'mutation') return 'admin';
  if (lowerName.includes('user') && lowerName.includes('manage')) return 'admin';
  if (lowerName.includes('purge')) return 'admin';
  if (lowerName.includes('reset')) return 'admin';
  if (lowerName.includes('migrate')) return 'admin';
  
  // Protected procedures (user-specific actions)
  if (lowerName.includes('my')) return 'protected';
  if (lowerName.includes('create') && type === 'mutation') return 'protected';
  if (lowerName.includes('update') && type === 'mutation') return 'protected';
  if (lowerName.includes('edit') && type === 'mutation') return 'protected';
  if (lowerName.includes('add') && type === 'mutation') return 'protected';
  if (lowerName.includes('remove') && type === 'mutation') return 'protected';
  if (lowerName.includes('save')) return 'protected';
  if (lowerName.includes('favorite')) return 'protected';
  if (lowerName.includes('subscribe')) return 'protected';
  if (lowerName.includes('download')) return 'protected';
  
  // Public procedures (read-only, public data)
  if (type === 'query' && !lowerName.includes('private')) return 'public';
  if (lowerName.includes('search')) return 'public';
  if (lowerName.includes('list') && type === 'query') return 'public';
  if (lowerName.includes('get') && type === 'query') return 'public';
  if (lowerName.includes('check')) return 'public';
  if (lowerName.includes('health')) return 'public';
  if (lowerName.includes('status')) return 'public';
  if (lowerName.includes('version')) return 'public';
  
  // Default based on type
  return type === 'query' ? 'public' : 'protected';
}

/**
 * Convert a single router file
 */
async function convertRouterFile(filePath: string) {
  console.log(`\n🔍 Processing: ${path.basename(filePath)}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modified = false;
  
  // Skip if already using typed procedures
  if (content.includes('publicProcedure') || 
      content.includes('protectedProcedure') || 
      content.includes('adminProcedure')) {
    console.log('   ✅ Already using typed procedures');
    return { converted: 0, skipped: 0 };
  }
  
  // Parse procedures
  const procedures: ProcedureInfo[] = [];
  const procedureRegex = /(\w+):\s*procedure\.(input\([^)]+\)\.)?((query|mutation|subscription)\()/g;
  let match;
  
  while ((match = procedureRegex.exec(content)) !== null) {
    const name = match[1];
    const hasInput = !!match[2];
    const type = match[4] as 'query' | 'mutation' | 'subscription';
    const line = content.substring(0, match.index).split('\n').length;
    const suggestedType = suggestProcedureType(name, type);
    
    procedures.push({
      name,
      type,
      hasInput,
      line,
      suggestedType
    });
  }
  
  if (procedures.length === 0) {
    console.log('   ℹ️ No procedures found to convert');
    return { converted: 0, skipped: 0 };
  }
  
  console.log(`   Found ${procedures.length} procedures to convert`);
  
  // Count by suggested type
  const typeCounts = procedures.reduce((acc, p) => {
    acc[p.suggestedType] = (acc[p.suggestedType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`   Suggested: ${typeCounts.public || 0} public, ${typeCounts.protected || 0} protected, ${typeCounts.admin || 0} admin`);
  
  // Add imports if needed
  const hasImports = content.includes('import {');
  const importLine = content.indexOf('import { router');
  
  if (importLine !== -1) {
    // Check what procedures we need to import
    const neededProcedures = new Set(procedures.map(p => p.suggestedType + 'Procedure'));
    const procedureImports = Array.from(neededProcedures).join(', ');
    
    // Replace the import line
    const importRegex = /import\s*{([^}]+)}\s*from\s*['"]\.\.\/(trpc|procedures)['"];?/;
    const importMatch = content.match(importRegex);
    
    if (importMatch) {
      const currentImports = importMatch[1].split(',').map(s => s.trim());
      
      // Remove 'procedure' if it exists
      const filteredImports = currentImports.filter(i => i !== 'procedure');
      
      // Add new procedure imports
      const newImports = [...new Set([...filteredImports, ...neededProcedures])];
      
      // Update import
      content = content.replace(
        importMatch[0],
        `import { ${newImports.join(', ')} } from '../procedures';`
      );
      modified = true;
    }
  }
  
  // Replace procedures
  let convertedCount = 0;
  
  // Sort procedures by position (reverse order to maintain positions)
  procedures.sort((a, b) => b.line - a.line);
  
  for (const proc of procedures) {
    const oldPattern = new RegExp(
      `${proc.name}:\\s*procedure\\.`,
      'g'
    );
    
    const newProcedure = `${proc.suggestedType}Procedure`;
    const replacement = `${proc.name}: ${newProcedure}.`;
    
    if (content.match(oldPattern)) {
      content = content.replace(oldPattern, replacement);
      convertedCount++;
      modified = true;
    }
  }
  
  // Also check for standalone procedure. patterns
  const standaloneProcedureRegex = /(?<!\w)procedure\.(?=input|query|mutation|subscription)/g;
  const standaloneMatches = content.match(standaloneProcedureRegex);
  
  if (standaloneMatches) {
    // Default to publicProcedure for standalone uses
    content = content.replace(standaloneProcedureRegex, 'publicProcedure.');
    modified = true;
    convertedCount += standaloneMatches.length;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`   ✅ Converted ${convertedCount} procedures`);
    return { converted: convertedCount, skipped: 0 };
  }
  
  return { converted: 0, skipped: procedures.length };
}

/**
 * Main conversion function
 */
async function convertAllProcedures() {
  console.log('🚀 Converting tRPC procedures to typed variants\n');
  console.log('='.repeat(60));
  
  // Get all router files
  const routerFiles = await glob('*.ts', {
    cwd: ROUTERS_DIR,
    ignore: ['index.ts', '*.test.ts', '*.spec.ts'],
  });
  
  console.log(`Found ${routerFiles.length} router files to process\n`);
  
  let totalConverted = 0;
  let totalSkipped = 0;
  let filesModified = 0;
  
  // Process high-priority routers first
  const priorityOrder = [
    'manga.ts',
    'metadata.ts', 
    'system.ts',
    'users.ts',
    'suwayomi.ts',
    'settings.ts',
    'kapowarr.ts',
    'wanted.ts',
    'api.ts',
    'downloads.ts',
  ];
  
  // Sort files by priority
  const sortedFiles = [...routerFiles].sort((a, b) => {
    const aPriority = priorityOrder.indexOf(a);
    const bPriority = priorityOrder.indexOf(b);
    
    if (aPriority === -1 && bPriority === -1) return 0;
    if (aPriority === -1) return 1;
    if (bPriority === -1) return -1;
    
    return aPriority - bPriority;
  });
  
  // Process each file
  for (const file of sortedFiles) {
    const filePath = path.join(ROUTERS_DIR, file);
    const result = await convertRouterFile(filePath);
    
    totalConverted += result.converted;
    totalSkipped += result.skipped;
    
    if (result.converted > 0) {
      filesModified++;
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Conversion Summary:');
  console.log(`   Files modified: ${filesModified}/${routerFiles.length}`);
  console.log(`   Procedures converted: ${totalConverted}`);
  console.log(`   Procedures skipped: ${totalSkipped}`);
  
  // Create middleware file if it doesn't exist
  const middlewarePath = path.join(SRC_DIR, 'server/trpc/middleware.ts');
  if (!fs.existsSync(middlewarePath)) {
    console.log('\n🔧 Creating middleware.ts...');
    
    const middlewareContent = `/**
 * tRPC Middleware
 * 
 * Reusable middleware for logging, monitoring, and error tracking.
 * 
 * @module server/trpc/middleware
 */

import { logger } from '../../utils/logger';

/**
 * Logging middleware
 * 
 * Logs all procedure calls with timing
 */
export const loggingMiddleware = async ({
  path,
  type,
  next,
  ctx,
}: any) => {
  const start = Date.now();
  
  logger.info(\`[→] \${type} \${path}\`);
  
  const result = await next();
  
  const duration = Date.now() - start;
  logger.info(\`[←] \${type} \${path} (\${duration}ms)\`);
  
  return result;
};

/**
 * Performance monitoring middleware
 * 
 * Tracks slow procedures
 */
export const performanceMiddleware = async ({
  path,
  type,
  next,
}: any) => {
  const start = Date.now();
  const result = await next();
  const duration = Date.now() - start;
  
  // Log slow procedures (>1s)
  if (duration > 1000) {
    logger.warn(\`Slow procedure: \${type} \${path} took \${duration}ms\`);
  }
  
  return result;
};
`;
    
    fs.writeFileSync(middlewarePath, middlewareContent, 'utf8');
    console.log('   ✅ Created middleware.ts');
  }
  
  console.log('\n✅ Procedure conversion complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Review and test the converted procedures');
  console.log('   2. Add input/output validation schemas');
  console.log('   3. Replace Error throws with TRPCError');
  console.log('   4. Implement proper authentication in procedures.ts');
}

// Run the conversion
convertAllProcedures().catch(console.error);