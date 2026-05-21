#!/usr/bin/env ts-node
/**
 * Zod Schema Type Extractor
 * Week 2-3 - Type Safety Blitz
 *
 * Extracts Zod schemas from routers and generates TypeScript types
 */

import * as fs from 'fs';
import * as path from 'path';

interface ZodSchema {
  name: string;
  schema: string;
  file: string;
  line: number;
}

/**
 * Recursively find all TypeScript files in a directory
 */
function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.includes('node_modules')) {
      files.push(...findTypeScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract Zod schemas from a file
 */
function extractZodSchemas(filePath: string): ZodSchema[] {
  const schemas: ZodSchema[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Pattern 1: Named schema definitions
  // const userSchema = z.object({ ... })
  const namedSchemaRegex = /const\s+(\w+Schema)\s*=\s*(z\.object\({[\s\S]*?}\))/g;

  let match;
  while ((match = namedSchemaRegex.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split('\n').length;
    schemas.push({
      name: match[1],
      schema: match[2],
      file: filePath,
      line: lineNumber
    });
  }

  // Pattern 2: Inline .input() schemas
  // .input(z.object({ ... }))
  const inlineSchemaRegex = /\.input\((z\.object\({[\s\S]*?}\))\)/g;

  while ((match = inlineSchemaRegex.exec(content)) !== null) {
    // Find the procedure/mutation name before .input
    const before = content.substring(Math.max(0, match.index - 200), match.index);
    const procedureMatch = before.match(/(?:export\s+)?const\s+(\w+)\s*=\s*(?:publicProcedure|protectedProcedure)/);

    if (procedureMatch) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      schemas.push({
        name: `${procedureMatch[1]}InputSchema`,
        schema: match[1],
        file: filePath,
        line: lineNumber
      });
    }
  }

  return schemas;
}

/**
 * Generate TypeScript type file from schemas
 */
function generateTypeFile(schemas: ZodSchema[]): string {
  const header = `/**
 * Auto-generated TypeScript types from Zod schemas
 * Generated: ${new Date().toISOString()}
 *
 * DO NOT EDIT MANUALLY - Regenerate with: npx ts-node scripts/extract-zod-types.ts
 */

import { z } from 'zod';

`;

  // Group schemas by source file
  const byFile = schemas.reduce((acc, schema) => {
    if (!acc[schema.file]) acc[schema.file] = [];
    acc[schema.file].push(schema);
    return acc;
  }, {} as Record<string, ZodSchema[]>);

  let output = header;

  for (const [file, fileSchemas] of Object.entries(byFile)) {
    const relativePath = path.relative(process.cwd(), file);
    output += `// From: ${relativePath}\n`;

    for (const schema of fileSchemas) {
      const typeName = schema.name.replace('Schema', '').replace('Input', '');

      output += `\n// Line ${schema.line}\n`;
      output += `export const ${schema.name} = ${schema.schema};\n`;
      output += `export type ${typeName} = z.infer<typeof ${schema.name}>;\n`;
    }

    output += '\n';
  }

  return output;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Extracting Zod schemas from routers...\n');

  // Search in routers directory
  const routersDir = path.join(process.cwd(), 'src/server/trpc/routers');
  const files = findTypeScriptFiles(routersDir);

  console.log(`Found ${files.length} router files\n`);

  let allSchemas: ZodSchema[] = [];

  for (const file of files) {
    const schemas = extractZodSchemas(file);
    if (schemas.length > 0) {
      console.log(`  ${path.basename(file)}: ${schemas.length} schemas`);
      allSchemas.push(...schemas);
    }
  }

  console.log(`\n✅ Extracted ${allSchemas.length} total Zod schemas\n`);

  if (allSchemas.length === 0) {
    console.log('⚠️  No Zod schemas found. Make sure routers use Zod for validation.');
    return;
  }

  // Generate type file
  const typeFileContent = generateTypeFile(allSchemas);

  // Create output directory if it doesn't exist
  const outputDir = path.join(process.cwd(), 'src/types/generated');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to file
  const outputPath = path.join(outputDir, 'zod-extracted-types.ts');
  fs.writeFileSync(outputPath, typeFileContent);

  console.log(`📁 Types written to: ${path.relative(process.cwd(), outputPath)}`);
  console.log('\nNext steps:');
  console.log('1. Import these types where needed');
  console.log('2. Replace unknown with specific types from this file');
  console.log('3. Use Zod schema.parse() for runtime validation\n');
}

export { extractZodSchemas, generateTypeFile };

// Run if called directly
main().catch(console.error);
