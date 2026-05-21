import { logger } from '@/utils/logger';

import { createSuccessResult, createErrorResult } from '../async-result';

import type { AsyncResult} from '../async-result';
/**
 * Performance monitoring utilities for mobile optimization
 */
export interface PerformanceMetrics {
    // Core Web Vitals
    fcp?: number; // First Contentful Paint
    lcp?: number; // Largest Contentful Paint
    fid?: number; // First Input Delay
    cls?: number; // Cumulative Layout Shift
    ttfb?: number; // Time to First Byte
    // Additional metrics
    tti?: number; // Time to Interactive
    totalBlockingTime?: number;
    memoryUsage?: number;
    frameRate?: number;
}
export interface PerformanceThresholds {
    fcp: {
        good: number;
        needsImprovement: number;
    }; // ms
    lcp: {
        good: number;
        needsImprovement: number;
    }; // ms
    fid: {
        good: number;
        needsImprovement: number;
    }; // ms
    cls: {
        good: number;
        needsImprovement: number;
    }; // score
    ttfb: {
        good: number;
        needsImprovement: number;
    }; // ms
}
/**
 * Default performance thresholds based on Web Vitals
 */
export const DEFAULT_THRESHOLDS: PerformanceThresholds = {
    fcp: { good: 1800, needsImprovement: 3000 },
    lcp: { good: 2500, needsImprovement: 4000 },
    fid: { good: 100, needsImprovement: 300 },
    cls: { good: 0.1, needsImprovement: 0.25 },
    ttfb: { good: 800, needsImprovement: 1800 }
};
/**
 * Collects current performance metrics
 */
export async function collectPerformanceMetrics(): Promise<AsyncResult<PerformanceMetrics, Error>> {
    try {
        if (typeof window === 'undefined') {
            return createErrorResult(new Error('Performance API not available'));
        }
        const metrics: PerformanceMetrics = {};
        // Get navigation timing
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (navigation !== undefined) {
            metrics.ttfb = navigation.responseStart - navigation.requestStart;
        }
        // Get paint timing
        const paintEntries = performance.getEntriesByType('paint');
        for (const entry of paintEntries) {
            if (entry["name"] === 'first-contentful-paint') {
                metrics.fcp = entry.startTime;
            }
        }
        // Get largest contentful paint
        if ('PerformanceObserver' in window) {
            try {
                // Create a promise to capture LCP
                const lcpPromise = new Promise<number>((resolve) => {
                    let lcpValue = 0;
                    const observer = new PerformanceObserver((list) => {
                        const entries = list.getEntries();
                        const lastEntry = entries[entries.length - 1];
                        if (lastEntry !== undefined) {
                            lcpValue = lastEntry.startTime;
                        }
                    });
                    observer.observe({ entryTypes: ['largest-contentful-paint'] });
                    // Resolve after a short delay to capture the value
                    setTimeout(() => {
                        observer.disconnect();
                        resolve(lcpValue);
                    }, 100);
                });
                metrics.lcp = await lcpPromise;
            }
            catch (_error: unknown) {
                // LCP metric collection failed - non-critical, continue without it
                logger.debug('Failed to collect LCP metric', { error: _error });
            }
        }
        // Get memory usage if available
        interface PerformanceWithMemory extends Performance {
            memory?: {
                usedJSHeapSize: number;
                jsHeapSizeLimit: number;
                totalJSHeapSize: number;
            };
        }
        const performanceWithMemory = performance as PerformanceWithMemory;
        if ('memory' in performance && performanceWithMemory.memory) {
            const memory = performanceWithMemory.memory;
            metrics.memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
        }
        // Calculate frame rate
        metrics.frameRate = await calculateFrameRate();
        return createSuccessResult(metrics);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error
            ? error
            : new Error(`Failed to collect performance metrics: ${String(error)}`));
    }
}
/**
 * Calculates the current frame rate
 */
async function calculateFrameRate(): Promise<number> {
    return new Promise((resolve) => {
        let frames = 0;
        const lastTime = performance.now();
        function countFrame(): void {
            frames++;
            const currentTime = performance.now();
            if (currentTime >= lastTime + 1000) {
                resolve(frames);
            }
            else {
                requestAnimationFrame(countFrame);
            }
        }
        requestAnimationFrame(countFrame);
    });
}
/**
 * Evaluates performance metrics against thresholds
 */
export function evaluatePerformance(metrics: PerformanceMetrics, thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS): Record<string, 'good' | 'needs-improvement' | 'poor' | 'unknown'> {
    const evaluation: Record<string, 'good' | 'needs-improvement' | 'poor' | 'unknown'> = {};
    // Evaluate FCP
    if (metrics.fcp !== undefined) {
        if (metrics.fcp <= thresholds.fcp.good) {
            evaluation["fcp"] = 'good';
        }
        else if (metrics.fcp <= thresholds.fcp.needsImprovement) {
            evaluation["fcp"] = 'needs-improvement';
        }
        else {
            evaluation["fcp"] = 'poor';
        }
    }
    else {
        evaluation["fcp"] = 'unknown';
    }
    // Evaluate LCP
    if (metrics.lcp !== undefined) {
        if (metrics.lcp <= thresholds.lcp.good) {
            evaluation["lcp"] = 'good';
        }
        else if (metrics.lcp <= thresholds.lcp.needsImprovement) {
            evaluation["lcp"] = 'needs-improvement';
        }
        else {
            evaluation["lcp"] = 'poor';
        }
    }
    else {
        evaluation["lcp"] = 'unknown';
    }
    // Evaluate TTFB
    if (metrics.ttfb !== undefined) {
        if (metrics.ttfb <= thresholds.ttfb.good) {
            evaluation["ttfb"] = 'good';
        }
        else if (metrics.ttfb <= thresholds.ttfb.needsImprovement) {
            evaluation["ttfb"] = 'needs-improvement';
        }
        else {
            evaluation["ttfb"] = 'poor';
        }
    }
    else {
        evaluation["ttfb"] = 'unknown';
    }
    return evaluation;
}
/**
 * Monitors performance and logs warnings for poor metrics
 */
export async function monitorPerformance(): Promise<void> {
    const result = await collectPerformanceMetrics();
    if (result["status"] === 'success') {
        const evaluation = evaluatePerformance(result.data);
        // Log warnings for poor performance
        Object.entries(evaluation).forEach(([metric, rating]) => {
            if (rating === 'poor') {
                logger.warn(`Performance warning: ${metric} is rated as poor`);
            }
        });
    }
}
