#!/usr/bin/env tsx

/**
 * Fix remaining procedures that end a line
 * Pattern: methodName: procedure.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');
const ROUTERS_DIR = path.join(SRC_DIR, 'server/trpc/routers');

/**
 * Determine procedure type based on name and next method
 */
function determineProcedureType(procedureName: string, fileContent: string, position: number): 'public' | 'protected' | 'admin' | 'system' {
  const lowerName = procedureName.toLowerCase();

  // Look ahead for the method type
  const nextContent = fileContent.substring(position, position + 200);
  const isMutation = /^\s*(mutation|input\([^)]*\)\.mutation)/.test(nextContent);

  // System operations
  if (lowerName.includes('system') ||
      lowerName.includes('health') ||
      lowerName.includes('status') ||
      lowerName === 'getbackups') {
    return 'system';
  }

  // Admin operations
  if (lowerName.includes('admin') ||
      lowerName.includes('migrate') ||
      lowerName.includes('restart') ||
      lowerName.includes('shutdown') ||
      lowerName.includes('clear') ||
      lowerName === 'firsttimesetup') {
    return 'admin';
  }

  // Mutations are generally protected
  if (isMutation ||
      lowerName.includes('create') ||
      lowerName.includes('update') ||
      lowerName.includes('edit') ||
      lowerName.includes('save') ||
      lowerName.includes('add') ||
      lowerName.includes('remove') ||
      lowerName.includes('set') ||
      lowerName.includes('toggle') ||
      lowerName.includes('delete') ||
      lowerName.includes('perform') ||
      lowerName.includes('queue') ||
      lowerName.includes('mark') ||
      lowerName.includes('change') ||
      lowerName.includes('download') ||
      lowerName.includes('cancel') ||
      lowerName.includes('install') ||
      lowerName.includes('uninstall') ||
      lowerName.includes('export')) {
    return 'protected';
  }

  // Default to public for queries
  return 'public';
}

/**
 * Fix procedures in a file
 */
function fixFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fixes = 0;

  // Pattern: methodName: procedure.$
  const pattern = /(\w+):\s*procedure\.$/gm;

  let match;
  const replacements: Array<{index: number, length: number, replacement: string}> = [];

  while ((match = pattern.exec(content)) !== null) {
    const name = match[1];
    const procedureType = determineProcedureType(name, content, match.index + match[0].length);

    replacements.push({
      index: match.index,
      length: match[0].length,
      replacement: `${name}: ${procedureType}Procedure.`
    });
    fixes++;
  }

  // Apply replacements in reverse order
  for (const { index, length, replacement } of replacements.reverse()) {
    content = content.substring(0, index) + replacement + content.substring(index + length);
  }

  // Also fix inline patterns we might have missed
  content = content.replace(
    /(\w+):\s*procedure\.(input|query|mutation)/g,
    (match, name, method) => {
      const procedureType = determineProcedureType(name, content, 0);
      fixes++;
      return `${name}: ${procedureType}Procedure.${method}`;
    }
  );

  // Update imports if we made changes
  if (fixes > 0) {
    // Collect needed procedure types
    const neededProcedures = new Set<string>();
    if (content.includes('publicProcedure')) neededProcedures.add('publicProcedure');
    if (content.includes('protectedProcedure')) neededProcedures.add('protectedProcedure');
    if (content.includes('adminProcedure')) neededProcedures.add('adminProcedure');
    if (content.includes('systemProcedure')) neededProcedures.add('systemProcedure');

    // Check if procedures import exists
    const hasProceduresImport = content.includes("from '../procedures'");

    if (neededProcedures.size > 0 && !hasProceduresImport) {
      // Add new import after the router import
      const routerImportMatch = content.match(/import\s*{\s*router\s*}\s*from\s*['"]\.\.\/trpc['"]\s*;?\s*\n/);
      if (routerImportMatch) {
        const insertPos = routerImportMatch.index! + routerImportMatch[0].length;
        const importStatement = `import { ${Array.from(neededProcedures).sort().join(', ')} } from '../procedures';\n`;
        content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);
      }
    } else if (hasProceduresImport) {
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

  // Write if modified
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return fixes;
  }

  return 0;
}

/**
 * Main function
 */
async function fixRemainingProcedures() {
  console.log('🔧 Fixing remaining procedures\n');
  console.log('='.repeat(60));

  // Get all router files
  const routerFiles = await glob('**/*.ts', {
    cwd: ROUTERS_DIR,
    ignore: ['index.ts', '*.test.ts', '*.spec.ts'],
  });

  console.log(`Checking ${routerFiles.length} router files\n`);

  let totalFixes = 0;
  let filesFixed = 0;

  for (const file of routerFiles) {
    const filePath = path.join(ROUTERS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if file has untyped procedures
    if (content.includes(': procedure.')) {
      console.log(`🔍 Processing ${file}...`);
      const fixes = fixFile(filePath);

      if (fixes > 0) {
        console.log(`   ✅ Fixed ${fixes} procedures`);
        totalFixes += fixes;
        filesFixed++;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   Files fixed: ${filesFixed}`);
  console.log(`   Total procedures fixed: ${totalFixes}`);
  console.log('\n✅ Fix complete!');
}

// Run the script
fixRemainingProcedures().catch(console.error);