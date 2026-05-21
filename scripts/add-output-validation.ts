#!/usr/bin/env tsx

/**
 * Add output validation to remaining procedures
 * Target: procedures returning { success: true/false } patterns
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.join(process.cwd(), 'src');
const ROUTERS_DIR = path.join(SRC_DIR, 'server/trpc/routers');

// Files that need output validation
const filesToUpdate = [
  'notifications.ts',
  'settings.ts',
  'config.ts',
  'backup.ts',
  'events.ts'
];

/**
 * Add output validation to a file
 */
function addOutputValidation(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modifications = 0;

  // First, ensure schemas are imported
  if (!content.includes("from '../schemas'")) {
    // Add import after z import
    const zImportMatch = content.match(/import\s*{\s*z\s*}\s*from\s*['"]zod['"]\s*;?\s*\n/);
    if (zImportMatch) {
      const insertPos = zImportMatch.index! + zImportMatch[0].length;
      const importStatement = `import { successSchema, booleanResultSchema, errorSchema } from '../schemas';\n`;
      content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);
      console.log(`  Added schema imports`);
    }
  }

  // Pattern 1: Procedures returning { success: true }
  // Add .output(successSchema) before .mutation or .query
  const successPatterns = [
    // For mutations with { success: true } return
    {
      pattern: /(\w+):\s*(protected|public|admin)Procedure\s*\n?\s*\.input\([^)]*\)\s*\n?\s*\.mutation\(async[^{]*{[^}]*return\s*{\s*success:\s*true[^}]*}/g,
      name: 'mutation with success'
    },
    // For queries with { success: true, ... } return
    {
      pattern: /(\w+):\s*(protected|public|admin)Procedure\s*\n?\s*\.query\(async[^{]*{[^}]*return\s*{\s*success:\s*true[^}]*}/g,
      name: 'query with success'
    }
  ];

  // Find procedures that need output validation
  for (const { pattern, name } of successPatterns) {
    const matches = content.match(pattern) || [];

    for (const match of matches) {
      if (!match.includes('.output(')) {
        console.log(`  Found ${name}: ${match.substring(0, 50)}...`);

        // Add .output(successSchema) before .mutation or .query
        const updatedMatch = match
          .replace(/\.mutation\(/, '.output(successSchema)\n  .mutation(')
          .replace(/\.query\(/, '.output(successSchema)\n  .query(');

        if (updatedMatch !== match) {
          content = content.replace(match, updatedMatch);
          modifications++;
        }
      }
    }
  }

  // Write back if modified
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return modifications;
  }

  return 0;
}

/**
 * Main function
 */
async function main() {
  console.log('📝 Adding output validation to remaining procedures\n');
  console.log('='.repeat(60));

  let totalModifications = 0;
  let filesUpdated = 0;

  for (const file of filesToUpdate) {
    const filePath = path.join(ROUTERS_DIR, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${file} not found`);
      continue;
    }

    console.log(`\n🔍 Processing ${file}...`);
    const mods = addOutputValidation(filePath);

    if (mods > 0) {
      console.log(`  ✅ Added ${mods} output validations`);
      totalModifications += mods;
      filesUpdated++;
    } else {
      console.log(`  ℹ️  No modifications needed`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary:`);
  console.log(`   Files updated: ${filesUpdated}`);
  console.log(`   Total validations added: ${totalModifications}`);

  if (totalModifications > 0) {
    console.log('\n✅ Output validation successfully added!');
    console.log('\n📝 Note: Review the changes to ensure schemas match actual return types');
  } else {
    console.log('\n💡 Manual approach needed for complex return types');
  }
}

// Run the script
main().catch(console.error);