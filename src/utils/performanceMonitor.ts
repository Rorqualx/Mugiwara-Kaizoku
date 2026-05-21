/**
 * Performance Monitor for System Navigation
 *
 * Tracks and reports performance metrics for navigation between system tabs
 * to help identify and debug navigation issues.
 *
 * @module utils/performanceMonitor
 */
import React, { useEffect } from 'react';

import { logger } from '../utils/logger';
export class NavigationPerformanceMonitor {
    private marks: Map<string, number> = new Map();
    private measures: Map<string, number[]> = new Map();
    /**
     * Start measuring a navigation operation
     *
     * @param name - Name of the operation to measure
     */
    startMeasure(name: string): void {
        this.marks.set(name, performance.now());
        // Only log in development if explicitly enabled via environment variable
        if (process.env.NODE_ENV === 'development' && process.env['DEBUG_PERFORMANCE'] === 'true') {
            logger.info(`[Performance] Started measuring: ${name}`);
        }
    }
    /**
     * End a measurement and return the duration
     *
     * @param name - Name of the operation
     * @returns Duration in milliseconds
     */
    endMeasure(name: string): number {
        const start = this.marks.get(name);
        if (!start) {
            logger.warn(`[Performance] No start mark found for: ${name}`);
            return 0;
        }
        const duration = performance.now() - start;
        this.marks.delete(name);
        // Store measurement history
        if (!this.measures.has(name)) {
            this.measures.set(name, []);
        }
        const measurements = this.measures.get(name);
        if (measurements) {
            measurements.push(duration);
            // Keep only last 10 measurements
            if (measurements.length > 10) {
                measurements.shift();
            }
        }
        // Log slow operations
        if (duration > 100) {
            logger.warn(`[Performance] Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
        }
        else if (process.env.NODE_ENV === 'development' && process.env['DEBUG_PERFORMANCE'] === 'true') {
            logger.info(`[Performance] ${name} completed in ${duration.toFixed(2)}ms`);
        }
        return duration;
    }
    /**
     * Get average duration for a specific operation
     *
     * @param name - Name of the operation
     * @returns Average duration or null if no measurements
     */
    getAverageDuration(name: string): number | null {
        const measurements = this.measures.get(name);
        if (!measurements || measurements.length === 0) {
            return null;
        }
        const sum = measurements.reduce((acc, val) => acc + val, 0);
        return sum / measurements.length;
    }
    /**
     * Get all performance statistics
     *
     * @returns Object with all measurements
     */
    getStats(): Record<string, {
        count: number;
        average: number;
        last: number;
    }> {
        const stats: Record<string, {
            count: number;
            average: number;
            last: number;
        }> = {};
        this.measures.forEach((measurements, name) => {
            if (measurements.length > 0) {
                const sum = measurements.reduce((acc, val) => acc + val, 0);
                const last = measurements[measurements.length - 1];
                if (last !== undefined) {
                    stats[name] = {
                        count: measurements.length,
                        average: sum / measurements.length,
                        last
                    };
                }
            }
        });
        return stats;
    }
    /**
     * Clear all measurements
     */
    clear(): void {
        this.marks.clear();
        this.measures.clear();
    }
    /**
     * Log current performance statistics
     */
    logStats(): void {
        const stats = this.getStats();
        logger.info('[Performance] Navigation Statistics');
        Object.entries(stats).forEach(([name, data]) => {
            logger.info(`${name}:`, {
                'Average': `${data.average.toFixed(2)}ms`,
                'Last': `${data.last.toFixed(2)}ms`,
                'Samples': data.count
            });
        });
    }
}
// Singleton instance for global use
export const navigationPerfMonitor = new NavigationPerformanceMonitor();
/**
 * React hook for performance monitoring
 *
 * @param componentName - Name of the component being monitored
 * @returns Performance monitoring functions
 */
export function usePerformanceMonitor(componentName: string): {
    startMeasure: (operation: string) => void;
    endMeasure: (operation: string) => number;
    getStats: () => Record<string, { count: number; average: number; last: number }>;
} {
    // Use useRef to maintain the same monitor instance across renders
    const monitorRef = React.useRef<NavigationPerformanceMonitor | null>(null);

    // Create monitor only once
    monitorRef.current ??= new NavigationPerformanceMonitor();

    const monitor = monitorRef.current;

    // Monitor component mount/unmount
    useEffect(() => {
        monitor.startMeasure(`${componentName}-mount`);
        return () => {
            const duration = monitor.endMeasure(`${componentName}-mount`);
            // Log if component was mounted for a very short time (possible navigation issue)
            if (duration < 100) {
                logger.warn(`[Performance] ${componentName} unmounted very quickly (${duration.toFixed(2)}ms) - possible navigation issue`);
            }
        };
    }, [componentName, monitor]);

    return {
        startMeasure: (operation: string) => monitor.startMeasure(`${componentName}-${operation}`),
        endMeasure: (operation: string) => monitor.endMeasure(`${componentName}-${operation}`),
        getStats: () => monitor.getStats()
    };
}
// Add to window for debugging in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    interface WindowWithPerfMonitor extends Window {
        navigationPerfMonitor?: NavigationPerformanceMonitor;
    }
    const windowWithMonitor = window as unknown as WindowWithPerfMonitor;
    windowWithMonitor.navigationPerfMonitor = navigationPerfMonitor;
}
