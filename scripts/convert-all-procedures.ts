#!/usr/bin/env tsx

/**
 * Comprehensive script to convert ALL procedure patterns in tRPC routers
 * Handles:
 * - Single line: methodName: procedure.query(...)
 * - Multi-line: methodName: procedure.\n  query(...)
 * - With input: methodName: procedure.input(...).query(...)
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');
const ROUTERS_DIR = path.join(SRC_DIR, 'server/trpc/routers');

/**
 * Determine procedure type based on context
 */
function determineProcedureType(procedureName: string, methodType: 'query' | 'mutation'): 'public' | 'protected' | 'admin' | 'system' {
  const lowerName = procedureName.toLowerCase();

  // System operations
  if (lowerName.includes('system') ||
      lowerName.includes('health') ||
      lowerName.includes('status') ||
      lowerName === 'getBackups' ||
      lowerName === 'restoreBackup' ||
      lowerName === 'deleteBackup') {
    return 'system';
  }

  // Admin operations
  if (lowerName.includes('admin') ||
      lowerName.includes('migrate') ||
      lowerName.includes('restart') ||
      lowerName.includes('shutdown') ||
      lowerName === 'deleteUser' ||
      lowerName === 'createBackup') {
    return 'admin';
  }

  // Mutations are generally protected
  if (methodType === 'mutation') {
    if (lowerName.includes('create') ||
        lowerName.includes('update') ||
        lowerName.includes('edit') ||
        lowerName.includes('save') ||
        lowerName.includes('add') ||
        lowerName.includes('remove') ||
        lowerName.includes('set') ||
        lowerName.includes('toggle') ||
        lowerName.includes('delete') ||
        lowerName.includes('bind') ||
        lowerName.includes('unbind')) {
      return 'protected';
    }
  }

  // Public queries
  if (methodType === 'query') {
    return 'public';
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
  const replacements: Array<{from: string, to: string}> = [];

  // Find all procedure patterns using a more comprehensive regex
  // This matches both single-line and multi-line patterns
  const procedurePatterns = [
    // Pattern 1: methodName: procedure.query/mutation
    /(\w+):\s*procedure\.(query|mutation|subscription)/g,
    // Pattern 2: methodName: procedure.\n  query/mutation
    /(\w+):\s*procedure\.\s*\n\s*(query|mutation|subscription)/g,
    // Pattern 3: methodName: procedure.input(...).query/mutation
    /(\w+):\s*procedure\.input\([^)]*\)\.(query|mutation|subscription)/g,
    // Pattern 4: methodName: procedure.\n  input(...).query/mutation
    /(\w+):\s*procedure\.\s*\n\s*input\([^)]*\)\.(query|mutation|subscription)/g,
    // Pattern 5: methodName: procedure.\n  input(...)\n  .query/mutation
    /(\w+):\s*procedure\.\s*\n\s*input\([^)]*\)\s*\n\s*\.(query|mutation|subscription)/g,
  ];

  // Process each pattern
  for (const pattern of procedurePatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      const methodType = (match[2] || match[3]) as 'query' | 'mutation';
      const procedureType = determineProcedureType(name, methodType);

      // Store the replacement
      const originalMatch = match[0];
      const replacementMatch = originalMatch.replace(/\bprocedure\b/, `${procedureType}Procedure`);

      // Check if this replacement hasn't been done already
      if (!replacements.some(r => r.from === originalMatch)) {
        replacements.push({ from: originalMatch, to: replacementMatch });
        conversions++;
      }
    }
  }

  // Apply all replacements
  for (const { from, to } of replacements) {
    content = content.replace(from, to);
  }

  // Update imports if we made changes
  if (conversions > 0) {
    // Collect needed procedure types
    const neededProcedures = new Set<string>();
    if (content.includes('publicProcedure')) neededProcedures.add('publicProcedure');
    if (content.includes('protectedProcedure')) neededProcedures.add('protectedProcedure');
    if (content.includes('adminProcedure')) neededProcedures.add('adminProcedure');
    if (content.includes('systemProcedure')) neededProcedures.add('systemProcedure');

    // Check if procedures import exists
    const hasProceduresImport = content.includes("from '../procedures'");

    if (neededProcedures.size > 0) {
      if (!hasProceduresImport) {
        // Add new import after the router import
        const routerImportMatch = content.match(/import\s*{\s*router\s*}\s*from\s*['"]\.\.\/trpc['"]\s*;?\s*\n/);
        if (routerImportMatch) {
          const insertPos = routerImportMatch.index! + routerImportMatch[0].length;
          const importStatement = `import { ${Array.from(neededProcedures).sort().join(', ')} } from '../procedures';\n`;
          content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);
        }
      } else {
        // Update existing import
        const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/procedures['"]\s*;?/);
        if (importMatch) {
          const currentImports = importMatch[1].split(',').map(s => s.trim());
          const allImports = [...new Set([...currentImports, ...neededProcedures])].sort();

          content = content.replace(
            importMatch[0],
            `import { ${allImports.join(', ')} } from '../procedures';`
          );
        }
      }
    }

    // Remove old procedure import from '../trpc' if present
    content = content.replace(
      /import\s*\{\s*([^}]*),?\s*procedure\s*,?\s*([^}]*)\}\s*from\s*['"]\.\.\/trpc['"]\s*;?/,
      (match, before, after) => {
        const imports = [before, after].filter(Boolean).map(s => s.trim()).filter(Boolean);
        return imports.length > 0 ? `import { ${imports.join(', ')} } from '../trpc';` : '';
      }
    );
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
async function convertAllProcedures() {
  console.log('🚀 Converting ALL procedures to typed variants\n');
  console.log('='.repeat(60));

  // Get all router files, including subdirectories
  const routerFiles = await glob('**/*.ts', {
    cwd: ROUTERS_DIR,
    ignore: ['index.ts', '*.test.ts', '*.spec.ts'],
  });

  console.log(`Found ${routerFiles.length} router files to process\n`);

  let totalConversions = 0;
  let filesConverted = 0;

  for (const file of routerFiles) {
    const filePath = path.join(ROUTERS_DIR, file);

    console.log(`🔍 Processing ${file}...`);
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
convertAllProcedures().catch(console.error);