/**
 * Mobile Development Tools
 *
 * Utilities for mobile development environment setup,
 * debugging, and device simulation
 */
import { logger } from '@/utils/logger';

import { isSuccess } from '../async-result';

import { getDeviceInfo } from './device-detection';
import { collectPerformanceMetrics } from './performance-monitor';
/**
 * Mobile debug configuration
 */
export interface MobileDebugConfig {
    showDeviceInfo: boolean;
    showPerformanceMetrics: boolean;
    showTouchIndicators: boolean;
    showBreakpointIndicator: boolean;
    logGestures: boolean;
    simulateDevice?: 'mobile' | 'tablet' | 'desktop';
}
/**
 * Default debug configuration
 */
const defaultDebugConfig: MobileDebugConfig = {
    showDeviceInfo: false,
    showPerformanceMetrics: false,
    showTouchIndicators: false,
    showBreakpointIndicator: false,
    logGestures: false
};
/**
 * Current debug configuration
 */
let debugConfig: MobileDebugConfig = { ...defaultDebugConfig };
/**
 * Enables mobile debug mode with specified options
 */
export function enableMobileDebug(config: Partial<MobileDebugConfig> = {}): void {
    debugConfig = { ...defaultDebugConfig, ...config };

    if (typeof window !== 'undefined') {
        // Map to global MobileDebugConfig interface (from mobile-debug.d.ts)
        window.__MOBILE_DEBUG__ = {
            enabled: true,
            showDeviceInfo: debugConfig.showDeviceInfo,
            showPerformanceMetrics: debugConfig.showPerformanceMetrics,
            showNetworkInfo: false,
            logTouches: debugConfig.showTouchIndicators,
            showBreakpoints: debugConfig.showBreakpointIndicator
        };
        if (debugConfig.showDeviceInfo) {
            void logDeviceInfo();
        }
        if (debugConfig.showPerformanceMetrics) {
            startPerformanceMonitoring();
        }
        logger.info('🔧 Mobile debug mode enabled', debugConfig);
    }
}
/**
 * Disables mobile debug mode
 */
export function disableMobileDebug(): void {
    debugConfig = { ...defaultDebugConfig };

    if (typeof window !== 'undefined') {
        delete window.__MOBILE_DEBUG__;
        stopPerformanceMonitoring();
    }
    logger.info('🔧 Mobile debug mode disabled');
}
/**
 * Gets current debug configuration
 */
export function getDebugConfig(): MobileDebugConfig {
    return { ...debugConfig };
}
/**
 * Logs current device information
 */
async function logDeviceInfo(): Promise<void> {
    const result = await getDeviceInfo();
    if (isSuccess(result)) {
        logger.debug('📱 Device Information', {
            deviceType: result.data.isMobile ? 'Mobile' :
                result.data.isTablet ? 'Tablet' : 'Desktop',
            touchDevice: result.data.isTouchDevice ? 'Yes' : 'No',
            screenSize: `${result.data.screenWidth} x ${result.data.screenHeight}`,
            pixelRatio: result.data.devicePixelRatio,
            userAgent: result.data.userAgent.substring(0, 50) + '...'
        });
    }
}
/**
 * Performance monitoring interval
 */
let performanceInterval: NodeJS.Timeout | null = null;
/**
 * Starts performance monitoring
 */
function startPerformanceMonitoring(): void {
    if (performanceInterval)
        return;
    // Initial metrics
    void logPerformanceMetrics();
    // Monitor every 5 seconds
    performanceInterval = setInterval(() => {
        void logPerformanceMetrics();
    }, 5000);
}
/**
 * Stops performance monitoring
 */
function stopPerformanceMonitoring(): void {
    if (performanceInterval) {
        clearInterval(performanceInterval);
        performanceInterval = null;
    }
}
/**
 * Logs current performance metrics
 */
async function logPerformanceMetrics(): Promise<void> {
    const result = await collectPerformanceMetrics();
    if (isSuccess(result)) {
        logger.debug('📊 Performance Metrics', {
            fcp: result.data.fcp ? `${result.data.fcp.toFixed(2)}ms` : 'N/A',
            lcp: result.data.lcp ? `${result.data.lcp.toFixed(2)}ms` : 'N/A',
            ttfb: result.data.ttfb ? `${result.data.ttfb.toFixed(2)}ms` : 'N/A',
            memory: result.data.memoryUsage ? `${(result.data.memoryUsage * 100).toFixed(1)}%` : 'N/A',
            frameRate: result.data.frameRate ? `${result.data.frameRate} fps` : 'N/A'
        });
    }
}
/**
 * Simulates a specific device type for testing
 */
export function simulateDevice(deviceType: 'mobile' | 'tablet' | 'desktop'): void {
    if (typeof window === 'undefined')
        return;
    const simulations = {
        mobile: {
            width: 375,
            height: 812,
            devicePixelRatio: 3,
            touch: true,
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
        },
        tablet: {
            width: 768,
            height: 1024,
            devicePixelRatio: 2,
            touch: true,
            userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)'
        },
        desktop: {
            width: 1920,
            height: 1080,
            devicePixelRatio: 1,
            touch: false,
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        }
    };
    const simulation = simulations[deviceType];
    // Override window properties
    Object.defineProperty(window.screen, 'width', {
        writable: true,
        configurable: true,
        value: simulation.width
    });
    Object.defineProperty(window.screen, 'height', {
        writable: true,
        configurable: true,
        value: simulation.height
    });
    Object.defineProperty(window, 'devicePixelRatio', {
        writable: true,
        configurable: true,
        value: simulation.devicePixelRatio
    });
    logger.info(`🔧 Simulating ${deviceType} device`, simulation);
}
/**
 * Creates a visual breakpoint indicator for development
 */
export function createBreakpointIndicator(): HTMLDivElement | null {
    if (typeof document === 'undefined')
        return null;
    const indicator = document.createElement('div');
    indicator["id"] = 'breakpoint-indicator';
    indicator.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    z-index: 9999;
    pointer-events: none;
  `;
    const updateIndicator = (): void => {
        const width = window.innerWidth;
        let breakpoint = 'xs';
        if (width >= 1408)
            breakpoint = 'xl';
        else if (width >= 1200)
            breakpoint = 'lg';
        else if (width >= 992)
            breakpoint = 'md';
        else if (width >= 768)
            breakpoint = 'sm';
        else if (width >= 576)
            breakpoint = 'xs';
        indicator.textContent = `${breakpoint} (${width}px)`;
    };
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    document.body.appendChild(indicator);
    return indicator;
}
/**
 * Removes the breakpoint indicator
 */
export function removeBreakpointIndicator(): void {
    if (typeof document === 'undefined')
        return;
    const indicator = document.getElementById('breakpoint-indicator');
    if (indicator) {
        indicator.remove();
    }
}
/**
 * Development environment setup
 */
export function setupMobileDevelopment(): void {
    if (process.env.NODE_ENV !== 'development')
        return;
    // Add development commands to window

    if (typeof window !== 'undefined') {
        window.mobileDebug = {
            enable: enableMobileDebug,
            disable: disableMobileDebug,
            simulateDevice,
            showBreakpoint: createBreakpointIndicator,
            hideBreakpoint: removeBreakpointIndicator,
            logDevice: logDeviceInfo,
            logPerformance: logPerformanceMetrics
        };
        logger.info('📱 Mobile development tools loaded. Use window.mobileDebug to access commands.');
    }
}
