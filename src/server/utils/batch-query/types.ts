/**
 * Batch Query Types
 *
 * Type definitions and constants for batch database operations.
 * Extracted from: batchQuery.ts (lines 17-64)
 */

/**
 * Batch query options
 */
export interface BatchQueryOptions {
  /** Maximum items per batch */
  batchSize?: number;
  /** Maximum concurrent batches */
  concurrency?: number;
  /** Delay between batches in ms */
  delayBetweenBatches?: number;
  /** Continue on error */
  continueOnError?: boolean;
  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;
  /** Error callback */
  onError?: (error: Error, batch: unknown[]) => void;
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  success: number;
  failed: number;
  results: T[];
  errors: Array<{ error: Error; batch: unknown[] }>;
  duration: number;
}

/**
 * Default batch configuration
 */
export const DEFAULT_BATCH_OPTIONS: Required<BatchQueryOptions> = {
  batchSize: 100,
  concurrency: 3,
  delayBetweenBatches: 0,
  continueOnError: true,
  onProgress: () => {},
  onError: () => {},
};
