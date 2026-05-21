#!/usr/bin/env tsx

/**
 * Script to convert remaining untyped procedures in tRPC routers
 * This is a more aggressive version that converts all remaining procedures
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');
const ROUTERS_DIR = path.join(SRC_DIR, 'server/trpc/routers');

/**
 * Determine procedure type based on context
 */
function determineProcedureType(content: string, procedureName: string, methodType: 'query' | 'mutation'): 'public' | 'protected' | 'admin' {
  const lowerName = procedureName.toLowerCase();
  
  // Check for admin operations
  if (lowerName.includes('admin') || 
      lowerName.includes('system') ||
      lowerName.includes('migrate') ||
      lowerName.includes('restart') ||
      lowerName.includes('shutdown') ||
      (lowerName.includes('delete') && !lowerName.includes('my'))) {
    return 'admin';
  }
  
  // Check for user-specific operations
  if (methodType === 'mutation') {
    if (lowerName.includes('create') ||
        lowerName.includes('update') ||
        lowerName.includes('edit') ||
        lowerName.includes('save') ||
        lowerName.includes('add') ||
        lowerName.includes('remove') ||
        lowerName.includes('set') ||
        lowerName.includes('toggle')) {
      return 'protected';
    }
  }
  
  // Public queries by default
  if (methodType === 'query') {
    if (lowerName.includes('get') ||
        lowerName.includes('list') ||
        lowerName.includes('search') ||
        lowerName.includes('check') ||
        lowerName.includes('status')) {
      return 'public';
    }
  }
  
  // Default: queries are public, mutations are protected
  return methodType === 'query' ? 'public' : 'protected';
}

/**
 * Convert procedures in a file
 */
function convertFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let conversions = 0;
  
  // Pattern 1: Named procedures in router definition
  // e.g., methodName: procedure.input(...).query(...)
  const namedProcedurePattern = /(\w+):\s*procedure\.(input\([^)]*\)\.)?((query|mutation|subscription)\()/g;
  
  let match;
  const replacements: Array<{start: number, end: number, replacement: string}> = [];
  
  while ((match = namedProcedurePattern.exec(content)) !== null) {
    const name = match[1];
    const methodType = match[4] as 'query' | 'mutation';
    const procedureType = determineProcedureType(content, name, methodType);
    
    const start = match.index + name.length + 1; // After "name:"
    const end = match.index + match[0].length - match[3].length; // Before .query/mutation
    
    replacements.push({
      start,
      end,
      replacement: ` ${procedureType}Procedure.`
    });
    conversions++;
  }
  
  // Pattern 2: Standalone procedure usage
  // e.g., return procedure.input(...).query(...)
  const standaloneProcedurePattern = /(?<!\w)procedure\.(input|query|mutation|subscription)/g;
  
  while ((match = standaloneProcedurePattern.exec(content)) !== null) {
    // Skip if already in replacements
    const isInReplacement = replacements.some(r => 
      match.index >= r.start && match.index < r.end
    );
    
    if (!isInReplacement) {
      // Determine type based on method
      const methodType = match[1] === 'mutation' ? 'mutation' : 'query';
      const procedureType = methodType === 'mutation' ? 'protected' : 'public';
      
      replacements.push({
        start: match.index,
        end: match.index + 'procedure'.length,
        replacement: `${procedureType}Procedure`
      });
      conversions++;
    }
  }
  
  // Apply replacements in reverse order to maintain positions
  replacements.sort((a, b) => b.start - a.start);
  
  for (const { start, end, replacement } of replacements) {
    content = content.slice(0, start) + replacement + content.slice(end);
  }
  
  // Update imports if we made changes
  if (conversions > 0) {
    // Collect needed procedure types
    const neededProcedures = new Set<string>();
    if (content.includes('publicProcedure')) neededProcedures.add('publicProcedure');
    if (content.includes('protectedProcedure')) neededProcedures.add('protectedProcedure');
    if (content.includes('adminProcedure')) neededProcedures.add('adminProcedure');
    
    // Check current imports
    const hasRouterImport = content.includes("import { router");
    const hasProcedureImport = content.includes("import { procedure");
    const hasProceduresImport = content.includes("from '../procedures'");
    
    if (neededProcedures.size > 0) {
      // Add or update imports
      if (!hasProceduresImport) {
        // Add new import
        const firstImportMatch = content.match(/^import .* from/m);
        if (firstImportMatch) {
          const importStatement = `import { ${Array.from(neededProcedures).join(', ')} } from '../procedures';\n`;
          const insertPos = firstImportMatch.index;
          content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);
        }
      } else {
        // Update existing import
        const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/(procedures)['"];?/);
        if (importMatch) {
          const currentImports = importMatch[1].split(',').map(s => s.trim());
          const allImports = [...new Set([...currentImports, ...neededProcedures])]
            .filter(i => i !== 'procedure');
          
          content = content.replace(
            importMatch[0],
            `import { ${allImports.join(', ')} } from '../procedures';`
          );
        }
      }
      
      // Ensure router is imported from '../trpc'
      if (!hasRouterImport) {
        const firstImportMatch = content.match(/^import .* from/m);
        if (firstImportMatch) {
          const importStatement = `import { router } from '../trpc';\n`;
          const insertPos = firstImportMatch.index;
          content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);
        }
      }
      
      // Remove procedure import from '../trpc' if present
      content = content.replace(
        /import\s*\{\s*([^}]*),?\s*procedure\s*,?\s*([^}]*)\}\s*from\s*['"]\.\.\/(trpc)['"];?/,
        (match, before, after) => {
          const imports = [before, after].filter(Boolean).join(', ');
          return imports ? `import { ${imports} } from '../trpc';` : '';
        }
      );
    }
  }
  
  // Write if modified
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return conversions;
  }
  
  return 0;
}

/**
 * Main function
 */
async function convertRemainingProcedures() {
  console.log('🚀 Converting remaining procedures to typed variants\n');
  console.log('='.repeat(60));
  
  // Target routers that need conversion
  const targetRouters = [
    'activity.ts',
    'bulk.ts',
    'calendar.ts',
    'chapter.ts',
    'config.ts',
    'downloadClients.ts',
    'events.ts',
    'library.ts',
    'metadata.ts',
    'search.ts',
    'settings-events.ts',
    'settings-extensions.ts',
    'settings.ts',
    'suwayomi.ts',
    'tasks.ts'
  ];
  
  let totalConversions = 0;
  let filesConverted = 0;
  
  for (const router of targetRouters) {
    const filePath = path.join(ROUTERS_DIR, router);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${router} not found`);
      continue;
    }
    
    console.log(`🔍 Processing ${router}...`);
    const conversions = convertFile(filePath);
    
    if (conversions > 0) {
      console.log(`   ✅ Converted ${conversions} procedures`);
      totalConversions += conversions;
      filesConverted++;
    } else {
      console.log(`   ℹ️ No conversions needed`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   Files converted: ${filesConverted}`);
  console.log(`   Total procedures converted: ${totalConversions}`);
  console.log('\n✅ Conversion complete!');
  
  // Run analysis to show progress
  console.log('\n📈 Running pattern analysis...\n');
  import('child_process').then(({ execSync }) => {
    try {
      execSync('npx tsx scripts/analyze-trpc-patterns.ts', { stdio: 'inherit' });
    } catch (e) {
      console.log('Could not run analysis');
    }
  });
}

// Run the script
convertRemainingProcedures().catch(console.error);