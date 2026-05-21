#!/usr/bin/env tsx

/**
 * Script to merge missing functions from duplicate AsyncResult files into the canonical one
 *
 * This needs to run BEFORE the consolidation script
 */

import * as fs from 'fs';
import * as path from 'path';

const CANONICAL_FILE = path.join(process.cwd(), 'src/utils/async-result.ts');
const HELPERS_FILE = path.join(process.cwd(), 'src/utils/async-result-helpers.ts');

// Functions we need to add to the canonical file
const FUNCTIONS_TO_ADD = `

/**
 * Get data from AsyncResult or return default value
 * Alias for unwrapOr with backward compatibility
 */
export function getDataOr<T, E = Error, D = T>(result: AsyncResult<T, E>, defaultValue: D): T | D {
  return isSuccess(result) ? result.data : defaultValue;
}

/**
 * Process multiple async operations with proper error handling
 *
 * @param items - Items to process
 * @param asyncOperation - Async operation to perform on each item
 * @param options - Processing options
 * @returns Combined results with success/error counts
 */
export async function processAsyncOperations<T, R, E = Error>(
  items: T[],
  asyncOperation: (item: T, index: number) => Promise<AsyncResult<R, E>>,
  options: {
    continueOnError?: boolean;
    batchSize?: number;
    delay?: number;
  } = {}
): Promise<AsyncResult<{
  results: R[];
  successCount: number;
  errors: {
    item: T;
    error: E;
    index: number;
  }[];
}, E>> {
  const results: R[] = [];
  const errors: {
    item: T;
    error: E;
    index: number;
  }[] = [];

  const { continueOnError = true, batchSize = 10, delay = 0 } = options;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchPromises = batch.map(async (item, batchIndex) => {
      const index = i + batchIndex;
      const result = await asyncOperation(item, index);

      if (isSuccess(result)) {
        results.push(result.data);
      } else if (isError(result)) {
        errors.push({ item, error: result.error, index });
        if (!continueOnError) {
          throw result.error;
        }
      }
    });

    await Promise.all(batchPromises);

    if (delay > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return createSuccessResult({
    results,
    successCount: results.length,
    errors
  });
}

/**
 * Safe accessor for AsyncResult data
 * Returns undefined if not in success state
 */
export function safeGetData<T, E = Error>(result: AsyncResult<T, E>): T | undefined {
  return isSuccess(result) ? result.data : undefined;
}

/**
 * Safe accessor for AsyncResult error
 * Returns undefined if not in error state
 */
export function safeGetError<T, E = Error>(result: AsyncResult<T, E>): E | undefined {
  return isError(result) ? result.error : undefined;
}

/**
 * Execute a synchronous function with error handling
 * Wraps the result in AsyncResult
 */
export function safeExecute<T, E = Error>(
  fn: () => T,
  errorMapper: (error: unknown) => E = (err) => (err instanceof Error ? err : new Error(String(err))) as E
): AsyncResult<T, E> {
  try {
    const result = fn();
    return createSuccessResult<T, E>(result);
  } catch (error: unknown) {
    return createErrorResult<T, E>(errorMapper(error));
  }
}`;

async function mergeFunctions() {
  console.log('📝 Reading canonical async-result.ts file...');

  let content = fs.readFileSync(CANONICAL_FILE, 'utf8');

  // Check if functions already exist
  const functionsToCheck = ['getDataOr', 'processAsyncOperations', 'safeGetData', 'safeGetError', 'safeExecute'];
  const missingFunctions: string[] = [];

  for (const funcName of functionsToCheck) {
    if (!content.includes(`export function ${funcName}`)) {
      missingFunctions.push(funcName);
    }
  }

  if (missingFunctions.length === 0) {
    console.log('✅ All functions already exist in canonical file, no merge needed');
    return true;
  }

  console.log(`📋 Functions to add: ${missingFunctions.join(', ')}`);

  // Find the best place to insert - after the last export function
  const lastExportIndex = content.lastIndexOf('export function');
  if (lastExportIndex === -1) {
    console.error('❌ Could not find insertion point');
    return false;
  }

  // Find the end of that function (look for the closing brace at the start of a line)
  let insertIndex = content.indexOf('\n}', lastExportIndex);
  if (insertIndex === -1) {
    console.error('❌ Could not find end of last function');
    return false;
  }
  insertIndex += 2; // Move past the closing brace and newline

  // Insert the new functions
  content = content.slice(0, insertIndex) + FUNCTIONS_TO_ADD + content.slice(insertIndex);

  // Write back the file
  console.log('✏️ Writing updated canonical file...');
  fs.writeFileSync(CANONICAL_FILE, content, 'utf8');

  console.log('✅ Successfully merged missing functions into async-result.ts');
  console.log('\nNext steps:');
  console.log('1. Run: npx tsc --noEmit  (to verify no TypeScript errors)');
  console.log('2. Run: npx tsx scripts/consolidate-async-result.ts  (to update imports)');
  console.log('3. Delete duplicate files after verification');

  return true;
}

mergeFunctions().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});