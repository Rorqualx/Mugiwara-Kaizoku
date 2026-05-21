/**
 * Performance Timer Utility
 *
 * Provides timing utilities for measuring and logging performance of async operations
 */

import { logger } from '@/utils/logger';

export interface TimerResult<T> {
  result: T;
  duration: number;
  formattedDuration: string;
}

/**
 * Timer class for tracking operation performance
 */
export class PerformanceTimer {
  private startTime: number;
  private marks: Map<string, number> = new Map();
  private readonly name: string;

  constructor(name: string) {
    this["name"] = name;
    this.startTime = Date.now();
    logger.info(`[PERF] Starting timer: ${name}`);
  }

  /**
   * Mark a point in time with a label
   */
  mark(label: string): void {
    const now = Date.now();
    const elapsed = now - this.startTime;
    this.marks.set(label, elapsed);
    logger.info(`[PERF] ${this["name"]} - ${label}: ${this.formatDuration(elapsed)}`);
  }

  /**
   * Get elapsed time since start
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * End the timer and return total duration
   */
  end(): { duration: number; formattedDuration: string } {
    const duration = this.elapsed();
    const formatted = this.formatDuration(duration);
    logger.info(`[PERF] Completed ${this["name"]}: ${formatted}`);

    // Log all marks if any
    if (this.marks.size > 0) {
      const marksLog = Array.from(this.marks.entries())
        .map(([label, time]) => `${label}: ${this.formatDuration(time)}`)
        .join(', ');
      logger.info(`[PERF] ${this["name"]} marks: ${marksLog}`);
    }

    return { duration, formattedDuration: formatted };
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(2)}s`;
  }
}

/**
 * Measure the performance of an async function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>
): Promise<TimerResult<T>> {
  const timer = new PerformanceTimer(name);

  try {
    const result = await fn();
    const { duration, formattedDuration } = timer.end();

    return {
      result,
      duration,
      formattedDuration
    };
  } catch (error) {
    timer.end(); // Still log the duration even on error
    throw error;
  }
}

/**
 * Measure batch processing performance
 */
export class BatchPerformanceTracker {
  private timer: PerformanceTimer;
  private batchCount = 0;
  private itemCount = 0;
  private batchDurations: number[] = [];

  constructor(name: string) {
    this.timer = new PerformanceTimer(name);
  }

  /**
   * Track a batch completion
   */
  trackBatch(items: number, duration?: number): void {
    this.batchCount++;
    this.itemCount += items;

    const batchDuration = duration ?? 0;
    if (batchDuration > 0) {
      this.batchDurations.push(batchDuration);
    }

    const avgBatchTime = this.batchDurations.length > 0
      ? this.batchDurations.reduce((a, b) => a + b, 0) / this.batchDurations.length
      : 0;

    const itemsPerSecond = this.itemCount / (this.timer.elapsed() / 1000);

    logger.info(`[PERF-BATCH] Batch ${this.batchCount} completed: ${items} items, ` +
                `Total: ${this.itemCount}, Rate: ${itemsPerSecond.toFixed(1)} items/s, ` +
                `Avg batch: ${avgBatchTime.toFixed(0)}ms`);
  }

  /**
   * Get performance summary
   */
  getSummary(): {
    totalBatches: number;
    totalItems: number;
    totalDuration: number;
    itemsPerSecond: number;
    averageBatchTime: number;
    formattedDuration: string;
  } {
    const { duration, formattedDuration } = this.timer.end();
    const itemsPerSecond = this.itemCount / (duration / 1000);
    const averageBatchTime = this.batchDurations.length > 0
      ? this.batchDurations.reduce((a, b) => a + b, 0) / this.batchDurations.length
      : 0;

    logger.info(`[PERF-BATCH] Summary: ${this.itemCount} items in ${this.batchCount} batches, ` +
                `${formattedDuration}, ${itemsPerSecond.toFixed(1)} items/s`);

    return {
      totalBatches: this.batchCount,
      totalItems: this.itemCount,
      totalDuration: duration,
      itemsPerSecond,
      averageBatchTime,
      formattedDuration
    };
  }
}

/**
 * Create a simple timer for quick measurements
 */
export function startTimer(name: string): PerformanceTimer {
  return new PerformanceTimer(name);
}