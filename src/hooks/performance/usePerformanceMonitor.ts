/**
 * Performance Monitor Hook
 *
 * Monitors and reports performance metrics:
 * - Core Web Vitals
 * - Custom metrics
 * - Performance budgets
 * - Real-time monitoring
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, createLoadingResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import {
  measurePerformance,
  getNetworkInfo,
  getDeviceCapabilities,
  isLowEndDevice,
  type PerformanceMetrics,
  type NetworkInfo,
  type DeviceCapabilities } from '@/utils/mobile/performance';

export interface PerformanceData {
  metrics: PerformanceMetrics;
  network: NetworkInfo;
  device: DeviceCapabilities;
  isLowEnd: boolean;
  timestamp: number;
}

export interface PerformanceBudget {
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  tti?: number;
  tbt?: number;
}

export interface UsePerformanceMonitorOptions {
  /** Enable monitoring */
  enabled?: boolean;
  /** Monitoring interval in ms */
  interval?: number;
  /** Performance budget thresholds */
  budget?: PerformanceBudget;
  /** Callback when budget exceeded */
  onBudgetExceeded?: (metric: string, value: number, budget: number) => void;
  /** Callback for performance data */
  onPerformanceData?: (data: PerformanceData) => void;
}

export interface UsePerformanceMonitorReturn {
  /** Current performance data */
  data: AsyncResult<PerformanceData, Error>;
  /** Whether monitoring is active */
  isMonitoring: boolean;
  /** Start monitoring */
  startMonitoring: () => void;
  /** Stop monitoring */
  stopMonitoring: () => void;
  /** Measure performance now */
  measureNow: () => Promise<void>;
  /** Get performance recommendations */
  getRecommendations: () => string[];
}

// Default performance budgets (in ms)
const DEFAULT_BUDGET: PerformanceBudget = {
  fcp: 1800, // First Contentful Paint
  lcp: 2500, // Largest Contentful Paint
  fid: 100, // First Input Delay
  cls: 0.1, // Cumulative Layout Shift
  tti: 3800, // Time to Interactive
  tbt: 200 // Total Blocking Time
};

export function usePerformanceMonitor({
  enabled = true,
  interval = 10000, // 10 seconds
  budget = DEFAULT_BUDGET,
  onBudgetExceeded,
  onPerformanceData
}: UsePerformanceMonitorOptions = {}): UsePerformanceMonitorReturn {
  const [data, setData] = useState<AsyncResult<PerformanceData, Error>>(
    createLoadingResult()
  );
  const [isMonitoring, setIsMonitoring] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const observersRef = useRef<PerformanceObserver[]>([]);

  // Measure performance
  const measureNow = useCallback(async () => {
    try {
      // Get performance metrics
      const metricsResult = await measurePerformance();
      if (metricsResult["status"] === 'error') {
        throw metricsResult.error;
      }

      if (metricsResult["status"] !== 'success') {
        throw new Error('Failed to measure performance');
      }

      const performanceData: PerformanceData = {
        metrics: metricsResult.data,
        network: getNetworkInfo(),
        device: getDeviceCapabilities(),
        isLowEnd: isLowEndDevice(),
        timestamp: Date.now()
      };

      // Check budgets
      Object.entries(performanceData.metrics).forEach(([key, value]: [string, number | undefined]) => {
        const metricKey = key as keyof PerformanceBudget;
        const budgetValue = budget[metricKey];
        if (budgetValue !== undefined && value !== undefined && value > budgetValue) {
          onBudgetExceeded?.(metricKey, value, budgetValue);

          logger.warn(
            `[Performance] ${key} exceeded budget: ${value}ms > ${budgetValue}ms`
          );
        }
      });

      setData(createSuccessResult(performanceData));
      onPerformanceData?.(performanceData);
    } catch (error: unknown) {
      logger.error('[Performance] Measurement failed', { error });
      setData(createErrorResult(
        error instanceof Error ? error : new Error('Performance measurement failed')
      ));
    }
  }, [budget, onBudgetExceeded, onPerformanceData]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (isMonitoring || !enabled) return;

    setIsMonitoring(true);

    // Initial measurement
    void measureNow();

    // Set up interval
    intervalRef.current = setInterval(() => { void measureNow(); }, interval);

    // Set up performance observers for real-time metrics
    try {
      // Observe layout shifts
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0;
        for (const entry of list.getEntries()) {
          const entryObj = entry as unknown as Record<string, unknown>;
          if (!entryObj['hadRecentInput']) {
            clsValue += typeof entryObj['value'] === 'number' ? entryObj['value'] : 0;
          }
        }

        if (budget.cls && clsValue > budget.cls) {
          onBudgetExceeded?.('cls', clsValue, budget.cls);
        }
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      observersRef.current.push(clsObserver);

      // Observe long tasks
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            logger.warn(`[Performance] Long task detected: ${entry.duration}ms`);
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      observersRef.current.push(longTaskObserver);
    } catch (error: unknown) {
      logger.error('[Performance] Failed to set up observers', { error });
    }
  }, [enabled, interval, measureNow, budget, onBudgetExceeded, isMonitoring]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }

    // Disconnect observers
    observersRef.current.forEach((observer) => observer.disconnect());
    observersRef.current = [];
  }, []);

  // Get performance recommendations
  const getRecommendations = useCallback(() => {
    const recommendations: string[] = [];

    if (data["status"] !== 'success') {
      return recommendations;
    }

    const { metrics, network, device, isLowEnd } = data.data;

    // Device-based recommendations
    if (isLowEnd) {
      recommendations.push('Enable reduced motion for better performance');
      recommendations.push('Use smaller image sizes and lower quality');
      recommendations.push('Limit concurrent network requests');
    }

    // Network-based recommendations
    if (network.saveData) {
      recommendations.push('User has data saver enabled - minimize data usage');
    }

    if (network.effectiveType === '2g' || network.effectiveType === 'slow-2g') {
      recommendations.push('Poor network detected - use aggressive caching');
      recommendations.push('Defer non-critical resources');
    }

    // Metric-based recommendations
    if (metrics.fcp && metrics.fcp > 3000) {
      recommendations.push('Optimize initial bundle size to improve FCP');
    }

    if (metrics.lcp && metrics.lcp > 4000) {
      recommendations.push('Optimize largest content element (images, fonts)');
    }

    if (metrics.cls && metrics.cls > 0.25) {
      recommendations.push('Reserve space for dynamic content to reduce layout shifts');
    }

    if (metrics.tti && metrics.tti > 5000) {
      recommendations.push('Reduce JavaScript execution time for faster interactivity');
    }

    // Device capability recommendations
    if (device.hardwareConcurrency <= 2) {
      recommendations.push('Limit parallel operations on low-core devices');
    }

    if (device.deviceMemory && device.deviceMemory < 4) {
      recommendations.push('Reduce memory usage - implement aggressive cleanup');
    }

    return recommendations;
  }, [data]);

  // Auto-start monitoring on mount if enabled
  useEffect(() => {
    if (enabled) {
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]); // Only depend on enabled to avoid re-creating observers

  return {
    data,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    measureNow,
    getRecommendations
  };
}

/**
 * Return type for useComponentPerformance hook
 */
export interface UseComponentPerformanceReturn {
  renderTime: number | null;
  renderCount: number;
  averageRenderTime: number | null;
}

/**
 * Hook for component-level performance tracking
 */
export function useComponentPerformance(componentName: string): UseComponentPerformanceReturn {
  const [renderTime, setRenderTime] = useState<number | null>(null);
  const [renderCount, setRenderCount] = useState(0);
  const renderStartRef = useRef<number | undefined>(undefined);

  // Track render start
  useEffect(() => {
    renderStartRef.current = performance.now();
  });

  // Track render end
  useEffect(() => {
    if (renderStartRef.current) {
      const renderEnd = performance.now();
      const duration = renderEnd - renderStartRef.current;

      setRenderTime(duration);
      setRenderCount((prev) => prev + 1);

      // Log slow renders in development
      if (process.env.NODE_ENV === 'development' && duration > 16) {
        logger.warn(
          `[Performance] Slow render detected in ${componentName}: ${duration.toFixed(2)}ms`
        );
      }
    }
  }, [componentName]);

  return {
    renderTime,
    renderCount,
    averageRenderTime: renderTime && renderCount > 0 ? renderTime / renderCount : null
  };
}