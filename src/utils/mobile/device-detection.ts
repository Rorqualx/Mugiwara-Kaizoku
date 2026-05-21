// import { logger } from '@/utils/logger';
import { createSuccessResult, createErrorResult, isSuccess } from '../async-result';

import type { AsyncResult} from '../async-result';
/**
 * Device detection utilities following AsyncResult pattern
 */
export interface DeviceInfo {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    isTouchDevice: boolean;
}
/**
 * Detects device type based on user agent and screen size
 * Following Mantine v7 breakpoints: xs: 576px, sm: 768px, md: 992px
 */
export function detectDevice(): AsyncResult<DeviceInfo, Error> {
    try {
        // Get user agent
        const userAgent = typeof navigator !== 'undefined'
            ? navigator.userAgent
            : '';
        // Get screen dimensions
         
        const screenWidth = typeof window !== 'undefined'
            ? window.screen.width
            : 0;
         
        const screenHeight = typeof window !== 'undefined'
            ? window.screen.height
            : 0;
         
        const devicePixelRatio = typeof window !== 'undefined'
            ? window.devicePixelRatio
            : 1;
        // Check for touch device

        const isTouchDevice = typeof window !== 'undefined' &&
            ('ontouchstart' in window ||
                navigator.maxTouchPoints > 0 ||
                (('msMaxTouchPoints' in navigator) && typeof navigator['msMaxTouchPoints'] === 'number' && navigator['msMaxTouchPoints'] > 0));
        // Mobile detection patterns (iPad excluded - it's a tablet)
        const mobilePatterns = /Android(?=.*Mobile)|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const tabletPatterns = /iPad|Android(?!.*Mobile)|Tablet/i;
        // Detect based on patterns and screen size
        const isMobileUA = mobilePatterns.test(userAgent);
        const isTabletUA = tabletPatterns.test(userAgent);
        // Use Mantine breakpoints for size-based detection
        const isMobileSize = screenWidth < 768; // Below sm breakpoint
        const isTabletSize = screenWidth >= 768 && screenWidth < 992; // sm to md breakpoint
        // Combine UA and size detection - tablet takes priority over mobile size detection
        const isTablet = isTabletUA || (isTabletSize && isTouchDevice && !isMobileUA);
        const isMobile = isMobileUA || (isMobileSize && isTouchDevice && !isTablet);
        const isDesktop = !isMobile && !isTablet;
        const deviceInfo: DeviceInfo = {
            isMobile,
            isTablet,
            isDesktop,
            userAgent,
            screenWidth,
            screenHeight,
            devicePixelRatio,
            isTouchDevice
        };
        return createSuccessResult(deviceInfo);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error
            ? error
            : new Error(`Device detection failed: ${String(error)}`));
    }
}
/**
 * Cached device info for performance
 */
let cachedDeviceInfo: DeviceInfo | null = null;
/**
 * Gets cached device info or detects if not available
 */
export function getDeviceInfo(): AsyncResult<DeviceInfo, Error> {
    if (cachedDeviceInfo) {
        return createSuccessResult(cachedDeviceInfo);
    }
    const result = detectDevice();
    if (isSuccess(result)) {
        cachedDeviceInfo = result.data;
    }
    return result;
}
/**
 * Invalidates cached device info (useful for orientation changes)
 */
export function invalidateDeviceCache(): void {
    cachedDeviceInfo = null;
}
/**
 * Checks if the current device is mobile
 */
export async function isMobileDevice(): Promise<boolean> {
    const result = await getDeviceInfo();
    return isSuccess(result) ? result.data.isMobile : false;
}
/**
 * Checks if the current device is tablet
 */
export async function isTabletDevice(): Promise<boolean> {
    const result = await getDeviceInfo();
    return isSuccess(result) ? result.data.isTablet : false;
}
/**
 * Checks if the current device is desktop
 */
export async function isDesktopDevice(): Promise<boolean> {
    const result = await getDeviceInfo();
    return isSuccess(result) ? result.data.isDesktop : true; // Default to desktop
}
/**
 * Gets the current viewport size
 */
export function getViewportSize(): {
    width: number;
    height: number;
} {
    if (typeof window === 'undefined') {
        return { width: 0, height: 0 };
    }
    return {
        width: window.innerWidth,
        height: window.innerHeight
    };
}
/**
 * Listens for orientation changes and invalidates cache
 */
let resizeTimer: NodeJS.Timeout | undefined;
 
if (typeof window !== 'undefined') {
    window.addEventListener('orientationchange', invalidateDeviceCache);
    window.addEventListener('resize', () => {
        // Debounce resize events
        if (resizeTimer) {
            clearTimeout(resizeTimer);
        }
        resizeTimer = setTimeout(invalidateDeviceCache, 300);
    });
}
