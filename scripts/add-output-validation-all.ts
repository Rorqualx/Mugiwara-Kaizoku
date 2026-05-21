#!/usr/bin/env tsx

/**
 * Add output validation to all procedures that need it
 */

import * as fs from 'fs';
import * as path from 'path';

const ROUTERS_DIR = path.join(process.cwd(), 'src/server/trpc/routers');

// Files to process
const filesToProcess = [
  'settings.ts',
  'config.ts',
  'backup.ts',
  'events.ts'
];

interface ProcedureInfo {
  name: string;
  returnType: string;
  needsValidation: boolean;
}

/**
 * Analyze a file to find procedures needing validation
 */
function analyzeProcedures(content: string): ProcedureInfo[] {
  const procedures: ProcedureInfo[] = [];

  // Match procedure patterns
  const procedureRegex = /(\w+):\s*(public|protected|admin|system)Procedure\s*(?:\n\s*\.input\([^)]*\))?\s*\n?\s*\.(query|mutation)\s*\(async[^{]*\{([\s\S]*?)\}\s*\)/g;

  let match;
  while ((match = procedureRegex.exec(content)) !== null) {
    const [fullMatch, name, _, type, body] = match;

    // Check if it already has output validation
    const hasOutput = fullMatch.includes('.output(');

    // Analyze return type
    let returnType = 'unknown';
    if (body.includes('return { success: true')) {
      returnType = 'success';
    } else if (body.includes('return { success: false')) {
      returnType = 'error';
    } else if (body.includes('return {')) {
      returnType = 'custom';
    } else {
      returnType = 'other';
    }

    procedures.push({
      name,
      returnType,
      needsValidation: !hasOutput && returnType !== 'other'
    });
  }

  return procedures;
}

/**
 * Add output validation to a file
 */
function addOutputValidation(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modifications = 0;

  // Ensure schemas are imported
  if (!content.includes("from '../schemas'")) {
    const zImportMatch = content.match(/import\s*{\s*z\s*}\s*from\s*['"]zod['"]\s*;?\s*\n/);
    if (zImportMatch) {
      const insertPos = zImportMatch.index! + zImportMatch[0].length;
      const importStatement = `import { successSchema, booleanResultSchema, errorSchema } from '../schemas';\n`;

      // Check if it's not already imported
      if (!content.includes(importStatement)) {
        content = content.slice(0, insertPos) + importStatement + content.slice(insertPos);
        console.log(`  ✓ Added schema imports`);
      }
    }
  }

  // Pattern to find procedures returning { success: true/false }
  const successPatterns = [
    {
      // Mutations with success: true
      regex: /([\w]+):\s*(public|protected|admin|system)Procedure\s*(?:\n\s*\.input\([^)]*\))?\s*\n?\s*\.mutation\s*\(async[^{]*\{[\s\S]*?return\s*\{\s*success:\s*true\s*\}[\s\S]*?\}\s*\)/g,
      schema: 'booleanResultSchema'
    },
    {
      // Queries with success: true/false and other fields
      regex: /([\w]+):\s*(public|protected|admin|system)Procedure\s*(?:\n\s*\.input\([^)]*\))?\s*\n?\s*\.query\s*\(async[^{]*\{[\s\S]*?return\s*\{\s*success:\s*(true|false)[^}]*\}[\s\S]*?\}\s*\)/g,
      schema: 'successSchema'
    }
  ];

  for (const { regex, schema } of successPatterns) {
    let match;
    const regex2 = new RegExp(regex.source, regex.flags);

    while ((match = regex2.exec(content)) !== null) {
      const fullMatch = match[0];
      const procedureName = match[1];

      // Skip if already has output
      if (fullMatch.includes('.output(')) {
        continue;
      }

      console.log(`  → Adding ${schema} to ${procedureName}`);

      // Add output validation before .mutation or .query
      let updatedMatch = fullMatch;
      if (fullMatch.includes('.mutation')) {
        updatedMatch = fullMatch.replace(/\.mutation/, `.output(${schema})\n            .mutation`);
      } else if (fullMatch.includes('.query')) {
        updatedMatch = fullMatch.replace(/\.query/, `.output(${schema})\n            .query`);
      }

      if (updatedMatch !== fullMatch) {
        content = content.replace(fullMatch, updatedMatch);
        modifications++;
      }
    }
  }

  // Handle procedures that return arrays
  const arrayPattern = /(\w+):\s*(public|protected|admin|system)Procedure\s*(?:\n\s*\.input\([^)]*\))?\s*\n?\s*\.(query|mutation)\s*\(async[^{]*\{[\s\S]*?return\s+\w+Providers\s*;[\s\S]*?\}\s*\)/g;

  let match;
  while ((match = arrayPattern.exec(content)) !== null) {
    const fullMatch = match[0];
    const procedureName = match[1];

    if (!fullMatch.includes('.output(')) {
      console.log(`  → Adding array output validation to ${procedureName}`);

      const updatedMatch = fullMatch
        .replace(/\.(query|mutation)/, '.output(z.array(z.object({ id: z.string(), name: z.string() })))\n            .$1');

      if (updatedMatch !== fullMatch) {
        content = content.replace(fullMatch, updatedMatch);
        modifications++;
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
  console.log('📝 Adding output validation to procedures\n');
  console.log('='.repeat(60));

  let totalModifications = 0;
  let filesUpdated = 0;

  for (const file of filesToProcess) {
    const filePath = path.join(ROUTERS_DIR, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${file} not found`);
      continue;
    }

    console.log(`\n🔍 Processing ${file}...`);

    // Analyze procedures first
    const content = fs.readFileSync(filePath, 'utf8');
    const procedures = analyzeProcedures(content);
    const needingValidation = procedures.filter(p => p.needsValidation);

    if (needingValidation.length > 0) {
      console.log(`  Found ${needingValidation.length} procedures needing validation:`);
      for (const proc of needingValidation) {
        console.log(`    - ${proc.name} (returns ${proc.returnType})`);
      }
    }

    // Add validation
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
  }
}

// Run the script
main().catch(console.error);