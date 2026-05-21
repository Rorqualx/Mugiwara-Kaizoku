/**
 * Checklist Runner Utility
 *
 * Separates business logic from UI components for checklist operations:
 * - Running checklist items sequentially
 * - Calculating scores
 * - Managing checklist state
 * - Error handling
 *
 * Follows AsyncResult pattern for robust error handling
 */

import {
  AsyncResult,
  createSuccessResult,
  createErrorResult,
  createContextualError,
  isSuccess,
  isError,
  withEnhancedErrorHandling
} from '@/utils/async-result';

/**
 * Checklist item status types
 */
export type ChecklistItemStatus = 'pass' | 'fail' | 'warning' | 'checking';

/**
 * Checklist item definition
 */
export interface ChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  check: () => Promise<boolean> | boolean;
  weight: number;
  status?: ChecklistItemStatus;
  details?: string;
}

/**
 * Checklist run result
 */
export interface ChecklistRunResult {
  /** Updated checklist items with status and details */
  items: ChecklistItem[];
  /** Overall score (0-100) */
  score: number;
  /** Number of passed items */
  passedCount: number;
  /** Total number of items */
  totalCount: number;
  /** Total possible score */
  totalWeight: number;
  /** Actual score achieved */
  achievedScore: number;
}

/**
 * Checklist runner options
 */
export interface ChecklistRunnerOptions {
  /** Whether to update items sequentially with status changes */
  sequentialUpdates?: boolean;
  /** Callback for progress updates */
  onProgress?: (items: ChecklistItem[], currentIndex: number) => void;
  /** Timeout for individual checks (in milliseconds) */
  timeout?: number;
}

/**
 * Checklist runner error types
 */
export enum ChecklistRunnerErrorType {
  CHECK_TIMEOUT = 'CHECK_TIMEOUT',
  CHECK_FAILED = 'CHECK_FAILED',
  INVALID_ITEM = 'INVALID_ITEM',
  RUN_CANCELLED = 'RUN_CANCELLED'
}

/**
 * Runs a checklist and returns the results
 *
 * @param items - Array of checklist items to run
 * @param options - Runner configuration options
 * @returns AsyncResult with checklist run results
 */
export async function runChecklist(
  items: ChecklistItem[],
  options: ChecklistRunnerOptions = {}
): Promise<AsyncResult<ChecklistRunResult>> {
  return withEnhancedErrorHandling(async () => {
    const {
      sequentialUpdates = false,
      onProgress,
      timeout = 10000 // 10 second default timeout
    } = options;

    // Validate input
    if (!Array.isArray(items) || items.length === 0) {
      return createErrorResult(
        createContextualError(
          'No checklist items provided',
          ChecklistRunnerErrorType.INVALID_ITEM
        )
      );
    }

    // Initialize tracking variables
    let totalScore = 0;
    let totalWeight = 0;
    const updatedItems: ChecklistItem[] = [...items];

    // Run checks sequentially
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      if (!item) {
        continue;
      }

      // Update status to checking
      if (sequentialUpdates) {
        item.status = 'checking';
        onProgress?.([...updatedItems], i);
      }

      try {
        // Execute check with timeout
        // eslint-disable-next-line no-await-in-loop -- Sequential execution required: items are mutated in place and onProgress callback reports status updates after each check
        const checkResult = await executeCheckWithTimeout(item.check, timeout);

        if (isError(checkResult)) {
          item.status = 'warning';
          item.details = checkResult.error.message;
        } else if (isSuccess(checkResult)) {
          const passed = checkResult.data;
          item.status = passed ? 'pass' : 'fail';

          if (passed) {
            totalScore += item.weight;
          }
        } else {
          // Handle loading or idle states (shouldn't happen here)
          item.status = 'warning';
          item.details = 'Check did not complete properly';
        }

        totalWeight += item.weight;
      } catch (error: unknown) {
        // Handle unexpected errors
        item.status = 'warning';
        item.details = error instanceof Error ? error.message : String(error);
      }

      // Update progress after each item
      if (sequentialUpdates) {
        onProgress?.([...updatedItems], i);
      }
    }

    // Calculate final score
    const score = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) : 0;
    const passedCount = updatedItems.filter(item => item.status === 'pass').length;

    const result: ChecklistRunResult = {
      items: updatedItems,
      score,
      passedCount,
      totalCount: updatedItems.length,
      totalWeight,
      achievedScore: totalScore
    };

    return createSuccessResult(result);
  });
}

/**
 * Executes a checklist check with timeout protection
 *
 * @param checkFn - The check function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @returns AsyncResult with boolean result
 */
async function executeCheckWithTimeout(
  checkFn: () => Promise<boolean> | boolean,
  timeoutMs: number
): Promise<AsyncResult<boolean>> {
  return withEnhancedErrorHandling(async () => {
    try {
      // Handle both async and sync functions
      let result: boolean;
      if (checkFn.constructor.name === 'AsyncFunction') {
        // Use Promise.race for timeout on async functions
        const checkPromise = Promise.resolve(checkFn());
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Check timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        result = await Promise.race([checkPromise, timeoutPromise]);
      } else {
        // Sync function - execute directly
        result = checkFn() as boolean;
      }

      return createSuccessResult(result);
    } catch (error: unknown) {
      return createErrorResult(
        createContextualError(
          error instanceof Error ? error.message : String(error),
          ChecklistRunnerErrorType.CHECK_FAILED
        )
      );
    }
  });
}

/**
 * Calculates score from checklist items without running checks
 *
 * @param items - Checklist items with status
 * @returns Calculated score and statistics
 */
export function calculateChecklistScore(items: ChecklistItem[]): {
  score: number;
  passedCount: number;
  totalCount: number;
  totalWeight: number;
  achievedScore: number;
} {
  const passedItems = items.filter(item => item.status === 'pass');
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const achievedScore = passedItems.reduce((sum, item) => sum + item.weight, 0);

  const score = totalWeight > 0 ? Math.round((achievedScore / totalWeight) * 100) : 0;

  return {
    score,
    passedCount: passedItems.length,
    totalCount: items.length,
    totalWeight,
    achievedScore
  };
}

/**
 * Resets checklist items to initial state
 *
 * @param items - Checklist items to reset
 * @returns Reset checklist items
 */
export function resetChecklist(items: ChecklistItem[]): ChecklistItem[] {
  return items.map(item => {
    const { status: _status, details: _details, ...rest } = item;
    return rest;
  });
}

/**
 * Filters checklist items by category
 *
 * @param items - Checklist items
 * @param category - Category to filter by
 * @returns Filtered items
 */
export function filterChecklistByCategory(
  items: ChecklistItem[],
  category: string
): ChecklistItem[] {
  return items.filter(item => item.category === category);
}

/**
 * Gets checklist statistics
 *
 * @param items - Checklist items
 * @returns Statistics object
 */
export function getChecklistStatistics(items: ChecklistItem[]): {
  categories: Array<{
    category: string;
    passedCount: number;
    totalCount: number;
    percentage: number;
  }>;
  overall: {
    passed: number;
    total: number;
    percentage: number;
  };
} {
  const categories = Array.from(new Set(items.map(item => item.category)));
  const categoryStats = categories.map(category => {
    const categoryItems = filterChecklistByCategory(items, category);
    const passedCount = categoryItems.filter(item => item.status === 'pass').length;
    const totalCount = categoryItems.length;

    return {
      category,
      passedCount,
      totalCount,
      percentage: totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0
    };
  });

  const overallStats = calculateChecklistScore(items);

  return {
    categories: categoryStats,
    overall: {
      passed: overallStats.passedCount,
      total: overallStats.totalCount,
      percentage: overallStats.totalCount > 0
        ? Math.round((overallStats.passedCount / overallStats.totalCount) * 100)
        : 0
    }
  };
}

/**
 * Creates a checklist runner with predefined options
 *
 * @param defaultOptions - Default runner options
 * @returns Configured runner function
 */
export function createChecklistRunner(
  defaultOptions: ChecklistRunnerOptions = {}
): (items: ChecklistItem[], options?: Partial<ChecklistRunnerOptions>) => Promise<AsyncResult<ChecklistRunResult>> {
  return async (
    items: ChecklistItem[],
    options?: Partial<ChecklistRunnerOptions>
  ): Promise<AsyncResult<ChecklistRunResult>> => {
    const mergedOptions = { ...defaultOptions, ...options };
    return runChecklist(items, mergedOptions);
  };
}