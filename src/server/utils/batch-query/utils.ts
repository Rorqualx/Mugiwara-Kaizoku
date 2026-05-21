/**
 * Batch Query Utilities
 *
 * Helper functions for batch operations:
 * - Array chunking
 * - Parallel processing with concurrency control
 * - Promise-based delay
 *
 * Extracted from: batchQuery.ts (lines 376-422)
 *
 * @module server/utils/batch-query/utils
 */

/**
 * Split array into fixed-size chunks
 *
 * @template T - Type of array elements
 * @param array - Array to split into chunks
 * @param size - Maximum size of each chunk
 * @returns Array of chunked arrays
 *
 * @example
 * ```typescript
 * const items = [1, 2, 3, 4, 5];
 * const chunks = chunkArray(items, 2);
 * // [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Process items in parallel with concurrency control
 *
 * Implements proper concurrency limiting by processing items in batches.
 * Processes all batches sequentially, but items within each batch in parallel.
 *
 * @template T - Type of input items
 * @template R - Type of processing results
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param concurrency - Maximum number of concurrent operations
 * @returns Promise resolving to array of results in original order
 *
 * @example
 * ```typescript
 * const urls = ['url1', 'url2', 'url3'];
 * const results = await processInParallel(
 *   urls,
 *   async (url) => fetch(url),
 *   2 // Max 2 concurrent requests
 * );
 * ```
 */
export async function processInParallel<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  // Create indexed items for tracking
  const indexedItems = items.map((item, index) => ({ item, index }));
  const chunks = chunkArray(indexedItems, concurrency);

  // Process all chunks and flatten results
  const chunkPromises = chunks.map(async chunk => {
    return Promise.all(
      chunk.map(({ item, index }) =>
        processor(item, index).then(result => ({ result, index }))
      )
    );
  });

  const allChunkResults = await Promise.all(chunkPromises);

  // Reconstruct results in original order
  const results: R[] = new Array(items.length) as R[];
  allChunkResults.flat().forEach(({ result, index }) => {
    results[index] = result;
  });

  return results;
}

/**
 * Promise-based delay utility
 *
 * Creates a promise that resolves after specified milliseconds.
 * Useful for rate limiting, retries, and testing.
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 *
 * @example
 * ```typescript
 * await delay(1000); // Wait 1 second
 * ```
 */
export function delay(ms: number): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}
