#!/usr/bin/env tsx

/**
 * Convert the final remaining procedures to typed variants
 * Target: search.ts, settings.ts, reader.ts, calendar.ts, settings-extensions.ts, downloadClients.ts, config.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const ROUTERS_DIR = path.join(process.cwd(), 'src/server/trpc/routers');

const filesToConvert = [
  'search.ts',
  'settings.ts',
  'reader.ts',
  'calendar.ts',
  'settings-extensions.ts',
  'downloadClients.ts',
  'config.ts'
];

/**
 * Determine procedure type based on name and context
 */
function determineProcedureType(name: string, content: string, position: number): string {
  const lowerName = name.toLowerCase();

  // Look ahead to see if it's a mutation
  const nextContent = content.substring(position, position + 500);
  const isMutation = /\.(mutation|input\([^)]*\)\.mutation)/.test(nextContent);

  // Admin/system operations
  if (lowerName.includes('admin') ||
      lowerName.includes('system') ||
      lowerName.includes('reset') ||
      lowerName.includes('clear')) {
    return 'adminProcedure';
  }

  // Protected mutations
  if (isMutation ||
      lowerName.includes('update') ||
      lowerName.includes('set') ||
      lowerName.includes('save') ||
      lowerName.includes('create') ||
      lowerName.includes('delete') ||
      lowerName.includes('toggle') ||
      lowerName.includes('import') ||
      lowerName.includes('export')) {
    return 'protectedProcedure';
  }

  // Public queries
  return 'publicProcedure';
}

/**
 * Convert a file
 */
function convertFile(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let conversions = 0;

  // Find all procedure patterns
  const patterns = [
    // Pattern: name: procedure.
    /(\w+):\s*procedure\s*\n/g,
    // Pattern: name: procedure.query/mutation
    /(\w+):\s*procedure\.(query|mutation)/g,
    // Pattern: name: procedure.input
    /(\w+):\s*procedure\.input/g,
  ];

  for (const pattern of patterns) {
    let match;
    const replacements: Array<{from: string, to: string}> = [];

    while ((match = pattern.exec(content)) !== null) {
      const name = match[1];
      const procedureType = determineProcedureType(name, content, match.index + match[0].length);

      const from = match[0];
      const to = from.replace(/\bprocedure\b/, procedureType);

      if (!replacements.some(r => r.from === from)) {
        replacements.push({ from, to });
        conversions++;
      }
    }

    // Apply replacements
    for (const { from, to } of replacements) {
      content = content.replace(from, to);
    }
  }

  // Fix imports
  if (conversions > 0) {
    // Remove procedure from trpc import
    content = content.replace(
      /import\s*\{\s*([^}]*),?\s*procedure\s*,?\s*([^}]*)\}\s*from\s*['"](\.\.\/trpc|\.\.\/\.\.\/trpc)['"]/,
      (match, before, after) => {
        const imports = [before, after].filter(Boolean).map(s => s.trim()).filter(Boolean);
        const importPath = match.includes('../../trpc') ? '../../trpc' : '../trpc';
        return imports.length > 0
          ? `import { ${imports.join(', ')} } from '${importPath}'`
          : '';
      }
    );

    // Add procedures import
    const neededProcedures = new Set<string>();
    if (content.includes('publicProcedure')) neededProcedures.add('publicProcedure');
    if (content.includes('protectedProcedure')) neededProcedures.add('protectedProcedure');
    if (content.includes('adminProcedure')) neededProcedures.add('adminProcedure');

    if (neededProcedures.size > 0 && !content.includes("from '../procedures'")) {
      // Find the right import path based on file location
      const importPath = filePath.includes('integrations/') ? '../../procedures' : '../procedures';

      // Add after router import
      const routerImportMatch = content.match(/import\s*\{\s*router[^}]*\}\s*from\s*['"](\.\.\/trpc|\.\.\/\.\.\/trpc)['"]\s*;?\s*\n/);
      if (routerImportMatch) {
        const insertPos = routerImportMatch.index! + routerImportMatch[0].length;
        const importStatement = `import { ${Array.from(neededProcedures).sort().join(', ')} } from '${importPath}';\n`;
        content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);
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
async function convertFinalProcedures() {
  console.log('🚀 Converting final remaining procedures to typed variants\n');
  console.log('='.repeat(60));

  let totalConversions = 0;
  let filesConverted = 0;

  for (const file of filesToConvert) {
    const filePath = path.join(ROUTERS_DIR, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${file} not found`);
      continue;
    }

    console.log(`🔍 Processing ${file}...`);
    const conversions = convertFile(filePath);

    if (conversions > 0) {
      console.log(`   ✅ Converted ${conversions} procedures`);
      totalConversions += conversions;
      filesConverted++;
    } else {
      console.log(`   ℹ️  No conversions needed`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   Files converted: ${filesConverted}`);
  console.log(`   Total procedures converted: ${totalConversions}`);
  console.log('\n✅ Conversion complete!');
}

// Run the script
convertFinalProcedures().catch(console.error);