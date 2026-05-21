#!/usr/bin/env tsx

/**
 * Script to convert multi-line procedure patterns in tRPC routers
 * Handles patterns like:
 *   methodName: procedure.
 *   query(async () => { ... })
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');
const ROUTERS_DIR = path.join(SRC_DIR, 'server/trpc/routers');

/**
 * Determine procedure type based on context
 */
function determineProcedureType(procedureName: string, methodType: 'query' | 'mutation'): 'public' | 'protected' | 'admin' {
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

  // Pattern for multi-line procedures:
  // methodName: procedure.
  // query(...) or mutation(...)
  const multiLinePattern = /(\w+):\s*procedure\.\s*\n\s*(query|mutation|subscription)/g;

  let match;
  while ((match = multiLinePattern.exec(content)) !== null) {
    const name = match[1];
    const methodType = match[2] as 'query' | 'mutation';
    const procedureType = determineProcedureType(name, methodType);

    // Replace just the word "procedure" with the typed variant
    const replacement = match[0].replace('procedure', `${procedureType}Procedure`);
    content = content.substring(0, match.index) + replacement + content.substring(match.index + match[0].length);
    conversions++;
  }

  // Also handle single-line patterns
  const singleLinePattern = /(\w+):\s*procedure\.(query|mutation|subscription)/g;

  content = content.replace(singleLinePattern, (match, name, methodType) => {
    const procedureType = determineProcedureType(name, methodType as 'query' | 'mutation');
    return `${name}: ${procedureType}Procedure.${methodType}`;
  });

  // Count single-line replacements
  const singleLineMatches = originalContent.match(singleLinePattern);
  if (singleLineMatches) {
    conversions += singleLineMatches.length;
  }

  // Update imports if we made changes
  if (conversions > 0) {
    // Collect needed procedure types
    const neededProcedures = new Set<string>();
    if (content.includes('publicProcedure')) neededProcedures.add('publicProcedure');
    if (content.includes('protectedProcedure')) neededProcedures.add('protectedProcedure');
    if (content.includes('adminProcedure')) neededProcedures.add('adminProcedure');

    // Check if procedures import exists
    const hasProceduresImport = content.includes("from '../procedures'");

    if (neededProcedures.size > 0 && !hasProceduresImport) {
      // Add new import after the router import
      const routerImportMatch = content.match(/import\s*{\s*router\s*}\s*from\s*['"]\.\.\/trpc['"]\s*;?\s*\n/);
      if (routerImportMatch) {
        const insertPos = routerImportMatch.index! + routerImportMatch[0].length;
        const importStatement = `import { ${Array.from(neededProcedures).join(', ')} } from '../procedures';\n`;
        content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);
      }
    } else if (hasProceduresImport) {
      // Update existing import
      const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/procedures['"]\s*;?/);
      if (importMatch) {
        const currentImports = importMatch[1].split(',').map(s => s.trim());
        const allImports = [...new Set([...currentImports, ...neededProcedures])];

        content = content.replace(
          importMatch[0],
          `import { ${allImports.join(', ')} } from '../procedures';`
        );
      }
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
async function convertMultilineProcedures() {
  console.log('🚀 Converting multi-line procedures to typed variants\n');
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
}

// Run the script
convertMultilineProcedures().catch(console.error);