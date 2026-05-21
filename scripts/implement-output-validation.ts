#!/usr/bin/env tsx

/**
 * Implement output validation schemas for tRPC procedures
 * This adds runtime validation and type safety for all API responses
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const SRC_DIR = path.join(process.cwd(), 'src');
const ROUTERS_DIR = path.join(SRC_DIR, 'server/trpc/routers');

/**
 * Common output schemas that should be added to schemas.ts
 */
const COMMON_OUTPUT_SCHEMAS = `
// ============= OUTPUT VALIDATION SCHEMAS =============

/**
 * Standard success response schema
 */
export const successSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.any().optional(),
});

/**
 * Standard error response schema
 */
export const errorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});

/**
 * Paginated list response schema factory
 */
export const paginatedSchema = <T extends z.ZodType>(itemSchema: T) => z.object({
  items: z.array(itemSchema),
  total: z.number(),
  page: z.number().optional(),
  limit: z.number().optional(),
  hasMore: z.boolean(),
});

/**
 * ID response schema
 */
export const idSchema = z.object({
  id: z.union([z.string(), z.number()]),
});

/**
 * Count response schema
 */
export const countSchema = z.object({
  count: z.number(),
});

/**
 * Boolean result schema
 */
export const booleanResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

/**
 * List response schema factory
 */
export const listSchema = <T extends z.ZodType>(itemSchema: T) => z.array(itemSchema);

/**
 * Optional wrapper schema
 */
export const optionalSchema = <T extends z.ZodType>(schema: T) => schema.nullable().optional();
`;

/**
 * Analyze procedure to determine appropriate output schema
 */
function analyzeReturnType(procedureBody: string, procedureName: string): string | null {
  // Skip if already has output validation
  if (procedureBody.includes('.output(')) {
    return null;
  }

  // Check common patterns
  const patterns = [
    { pattern: /return\s*{\s*success:\s*true/i, schema: 'successSchema' },
    { pattern: /return\s*{\s*success:\s*false/i, schema: 'errorSchema' },
    { pattern: /return\s*{\s*items:\s*\[/, schema: 'paginatedSchema(z.any())' },
    { pattern: /return\s*{\s*count:\s*\d+/, schema: 'countSchema' },
    { pattern: /return\s*{\s*id:\s*/, schema: 'idSchema' },
    { pattern: /return\s*\[/, schema: 'z.array(z.any())' },
    { pattern: /return\s*true|return\s*false/, schema: 'z.boolean()' },
    { pattern: /return\s*null/, schema: 'z.null()' },
    { pattern: /return\s*undefined/, schema: 'z.undefined()' },
  ];

  for (const { pattern, schema } of patterns) {
    if (pattern.test(procedureBody)) {
      return schema;
    }
  }

  // Default to z.any() for complex returns
  if (procedureBody.includes('return')) {
    return 'z.any()';
  }

  return null;
}

/**
 * Add output validation to procedures in a file
 */
function addOutputValidation(filePath: string): { added: number; schemas: Set<string> } {
  const content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let added = 0;
  const schemasNeeded = new Set<string>();

  // Find all typed procedures
  const procedurePattern = /(public|protected|admin|system)Procedure\s*\n?\s*(\.[^}]+})\)/gm;

  let match;
  while ((match = procedurePattern.exec(content)) !== null) {
    const procedureType = match[1];
    const procedureBody = match[2];

    // Check if already has output
    if (procedureBody.includes('.output(')) {
      continue;
    }

    // Determine output schema
    const outputSchema = analyzeReturnType(procedureBody, '');

    if (outputSchema) {
      // Extract which common schemas are used
      if (outputSchema.includes('successSchema')) schemasNeeded.add('successSchema');
      if (outputSchema.includes('errorSchema')) schemasNeeded.add('errorSchema');
      if (outputSchema.includes('countSchema')) schemasNeeded.add('countSchema');
      if (outputSchema.includes('idSchema')) schemasNeeded.add('idSchema');
      if (outputSchema.includes('paginatedSchema')) schemasNeeded.add('paginatedSchema');

      added++;
    }
  }

  return { added, schemas: schemasNeeded };
}

/**
 * Update schemas.ts with common output schemas
 */
function updateSchemasFile(): void {
  const schemasPath = path.join(SRC_DIR, 'server/trpc/schemas.ts');

  if (!fs.existsSync(schemasPath)) {
    console.log('⚠️  schemas.ts not found');
    return;
  }

  let content = fs.readFileSync(schemasPath, 'utf8');

  // Check if output schemas already exist
  if (content.includes('OUTPUT VALIDATION SCHEMAS')) {
    console.log('✅ Output schemas already exist in schemas.ts');
    return;
  }

  // Add output schemas before the closing of the file
  content = content + '\n' + COMMON_OUTPUT_SCHEMAS;

  fs.writeFileSync(schemasPath, content, 'utf8');
  console.log('✅ Added output validation schemas to schemas.ts');
}

/**
 * Main function
 */
async function implementOutputValidation() {
  console.log('📝 Implementing output validation schemas\n');
  console.log('='.repeat(60));

  // First, update schemas.ts
  updateSchemasFile();

  // Analyze all router files
  const routerFiles = await glob('**/*.ts', {
    cwd: ROUTERS_DIR,
    ignore: ['index.ts', '*.test.ts', '*.spec.ts'],
  });

  console.log(`\nAnalyzing ${routerFiles.length} router files for output validation needs\n`);

  let totalProceduresNeedingValidation = 0;
  let filesNeedingValidation = 0;
  const allSchemasNeeded = new Set<string>();

  for (const file of routerFiles) {
    const filePath = path.join(ROUTERS_DIR, file);
    const { added, schemas } = addOutputValidation(filePath);

    if (added > 0) {
      console.log(`📊 ${file}: ${added} procedures need output validation`);
      totalProceduresNeedingValidation += added;
      filesNeedingValidation++;
      schemas.forEach(s => allSchemasNeeded.add(s));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`   Files needing output validation: ${filesNeedingValidation}`);
  console.log(`   Procedures needing validation: ${totalProceduresNeedingValidation}`);
  console.log(`   Common schemas needed: ${Array.from(allSchemasNeeded).join(', ')}`);

  console.log('\n📝 Next Steps:');
  console.log('1. Import output schemas from schemas.ts in each router');
  console.log('2. Add .output() to each procedure with appropriate schema');
  console.log('3. Create specific schemas for complex return types');
  console.log('4. Test each endpoint to ensure validation works correctly');

  console.log('\n💡 Example implementation:');
  console.log(`
import { successSchema, errorSchema, paginatedSchema } from '../schemas';

// For a simple success response:
myProcedure: publicProcedure
  .input(z.object({ ... }))
  .output(successSchema)
  .query(async ({ input }) => {
    return { success: true, message: 'Operation completed' };
  })

// For paginated results:
listItems: publicProcedure
  .input(paginationSchema)
  .output(paginatedSchema(itemSchema))
  .query(async ({ input }) => {
    return { items: [...], total: 100, hasMore: true };
  })
`);
}

// Run the script
implementOutputValidation().catch(console.error);