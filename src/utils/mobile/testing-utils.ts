/**
 * Mobile Testing Utilities
 *
 * Testing tools for mobile features:
 * - Touch event simulation
 * - Gesture testing
 * - Viewport testing
 * - Device emulation
 * - Performance testing
 */
import { logger } from '@/utils/logger';

export interface TouchSimulationOptions {
    clientX: number;
    clientY: number;
    force?: number;
    radiusX?: number;
    radiusY?: number;
    rotationAngle?: number;
    identifier?: number;
}
export interface GestureSimulationOptions {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    duration?: number;
    steps?: number;
}
export interface DeviceEmulationOptions {
    width: number;
    height: number;
    deviceScaleFactor?: number;
    isMobile?: boolean;
    hasTouch?: boolean;
    userAgent?: string;
}
/**
 * Simulate touch event
 */
export function simulateTouchEvent(element: HTMLElement, type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel', options: TouchSimulationOptions): void {
    const touch = new Touch({
        identifier: options.identifier ?? Date.now(),
        target: element,
        clientX: options.clientX,
        clientY: options.clientY,
        radiusX: options.radiusX ?? 1,
        radiusY: options.radiusY ?? 1,
        rotationAngle: options.rotationAngle ?? 0,
        force: options.force ?? 1
    });
    const touchEvent = new TouchEvent(type, {
        touches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
        changedTouches: [touch],
        bubbles: true,
        cancelable: true
    });
    element.dispatchEvent(touchEvent);
}
/**
 * Simulate swipe gesture
 */
export async function simulateSwipe(element: HTMLElement, options: GestureSimulationOptions): Promise<void> {
    const { startX, startY, endX, endY, duration = 300, steps = 10 } = options;
    // Start touch
    simulateTouchEvent(element, 'touchstart', {
        clientX: startX,
        clientY: startY
    });
    // Move in steps
    const deltaX = (endX - startX) / steps;
    const deltaY = (endY - startY) / steps;
    const stepDuration = duration / steps;
    for (let i = 1; i <= steps; i++) {
        // eslint-disable-next-line no-await-in-loop -- Sequential timing required: touch events must fire in order with realistic delays to simulate continuous swipe gesture
        await new Promise<void>((resolve) => {
            setTimeout(resolve, stepDuration);
        });
        simulateTouchEvent(element, 'touchmove', {
            clientX: startX + deltaX * i,
            clientY: startY + deltaY * i
        });
    }
    // End touch
    simulateTouchEvent(element, 'touchend', {
        clientX: endX,
        clientY: endY
    });
}
/**
 * Simulate pinch gesture
 */
export async function simulatePinch(element: HTMLElement, scale: number, duration: number = 300): Promise<void> {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const initialDistance = 100;
    const finalDistance = initialDistance * scale;
    const steps = 10;
    const stepDuration = duration / steps;
    for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const currentDistance = initialDistance + (finalDistance - initialDistance) * progress;
        const touch1 = new Touch({
            identifier: 1,
            target: element,
            clientX: centerX - currentDistance / 2,
            clientY: centerY
        });
        const touch2 = new Touch({
            identifier: 2,
            target: element,
            clientX: centerX + currentDistance / 2,
            clientY: centerY
        });
        const event = new TouchEvent(i === 0 ? 'touchstart' : i === steps ? 'touchend' : 'touchmove', {
            touches: i === steps ? [] : [touch1, touch2],
            changedTouches: [touch1, touch2],
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(event);
        if (i < steps) {
            // eslint-disable-next-line no-await-in-loop -- Sequential timing required: touch events must fire in order with calculated progress to simulate realistic pinch gesture
            await new Promise<void>((resolve) => {
                setTimeout(resolve, stepDuration);
            });
        }
    }
}
/**
 * Simulate long press
 */
export async function simulateLongPress(element: HTMLElement, duration: number = 500, x?: number, y?: number): Promise<void> {
    const rect = element.getBoundingClientRect();
    const clientX = x ?? rect.left + rect.width / 2;
    const clientY = y ?? rect.top + rect.height / 2;
    simulateTouchEvent(element, 'touchstart', { clientX, clientY });
    await new Promise<void>((resolve) => {
        setTimeout(resolve, duration);
    });
    simulateTouchEvent(element, 'touchend', { clientX, clientY });
}
/**
 * Set viewport size
 */
export function setViewport(width: number, height: number): void {
    // Update window dimensions (for testing)
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width
    });
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: height
    });
    // Dispatch resize event
    window.dispatchEvent(new Event('resize'));
    // Update viewport meta tag
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
        viewport = document.createElement('meta');
        viewport.setAttribute('name', 'viewport');
        document.head.appendChild(viewport);
    }
    viewport.setAttribute('content', `width=${width}, height=${height}`);
}
/**
 * Emulate device
 */
export function emulateDevice(options: DeviceEmulationOptions): () => void {
    const originalValues = {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
        orientation: window.screen.orientation
    };
    // Set viewport
    setViewport(options.width, options.height);
    // Set device pixel ratio
    if (options.deviceScaleFactor) {
        Object.defineProperty(window, 'devicePixelRatio', {
            writable: true,
            configurable: true,
            value: options.deviceScaleFactor
        });
    }
    // Set touch support
    if (options.hasTouch !== undefined) {
        Object.defineProperty(navigator, 'maxTouchPoints', {
            writable: true,
            configurable: true,
            value: options.hasTouch ? 5 : 0
        });
    }
    // Set user agent
    if (options.userAgent) {
        Object.defineProperty(navigator, 'userAgent', {
            writable: true,
            configurable: true,
            value: options.userAgent
        });
    }
    // Return cleanup function
    return () => {
        Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: originalValues.innerWidth
        });
        Object.defineProperty(window, 'innerHeight', {
            writable: true,
            configurable: true,
            value: originalValues.innerHeight
        });
        Object.defineProperty(window, 'devicePixelRatio', {
            writable: true,
            configurable: true,
            value: originalValues.devicePixelRatio
        });
        Object.defineProperty(navigator, 'maxTouchPoints', {
            writable: true,
            configurable: true,
            value: originalValues.maxTouchPoints
        });
        Object.defineProperty(navigator, 'userAgent', {
            writable: true,
            configurable: true,
            value: originalValues.userAgent
        });
        window.dispatchEvent(new Event('resize'));
    };
}
/**
 * Common device presets
 */
export const DEVICE_PRESETS = {
    'iPhone 14 Pro': {
        width: 393,
        height: 852,
        deviceScaleFactor: 3,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    },
    'iPhone SE': {
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    },
    'iPad Air': {
        width: 820,
        height: 1180,
        deviceScaleFactor: 2,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    },
    'Pixel 7': {
        width: 412,
        height: 915,
        deviceScaleFactor: 2.625,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36'
    },
    'Galaxy S22': {
        width: 360,
        height: 780,
        deviceScaleFactor: 3,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36'
    }
};
/**
 * Test mobile features
 */
export function testMobileFeatures(): {
    touch: boolean;
    orientation: boolean;
    deviceMotion: boolean;
    vibration: boolean;
    geolocation: boolean;
    camera: boolean;
    webShare: boolean;
    wakeLock: boolean;
    notifications: boolean;
} {
    return {
        touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        orientation: 'DeviceOrientationEvent' in window,
        deviceMotion: 'DeviceMotionEvent' in window,
        vibration: 'vibrate' in navigator,
        geolocation: 'geolocation' in navigator,
        camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
        webShare: 'share' in navigator,
        wakeLock: 'wakeLock' in navigator,
        notifications: 'Notification' in window
    };
}
/**
 * Performance testing helper
 */
export async function measurePerformance<T>(name: string, fn: () => Promise<T>): Promise<{
    result: T;
    duration: number;
}> {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    performance.mark(startMark);
    const result = await fn();
    performance.mark(endMark);
    performance.measure(name, startMark, endMark);
    const measure = performance.getEntriesByName(name, 'measure')[0];
    if (measure === undefined) {
        return {
            result,
            duration: 0
        };
    }
    return {
        result,
        duration: measure.duration
    };
}
/**
 * Network conditions simulation
 */
export interface NetworkConditions {
    offline: boolean;
    downloadThroughput: number; // bytes/s
    uploadThroughput: number; // bytes/s
    latency: number; // ms
}
export const NETWORK_PRESETS = {
    'offline': {
        offline: true,
        downloadThroughput: 0,
        uploadThroughput: 0,
        latency: 0
    },
    '2g': {
        offline: false,
        downloadThroughput: 250 * 1024 / 8, // 250kb/s
        uploadThroughput: 50 * 1024 / 8, // 50kb/s
        latency: 300
    },
    '3g': {
        offline: false,
        downloadThroughput: 750 * 1024 / 8, // 750kb/s
        uploadThroughput: 250 * 1024 / 8, // 250kb/s
        latency: 100
    },
    '4g': {
        offline: false,
        downloadThroughput: 4 * 1024 * 1024 / 8, // 4Mb/s
        uploadThroughput: 3 * 1024 * 1024 / 8, // 3Mb/s
        latency: 20
    }
};
/**
 * Simulate network conditions
 */
export function simulateNetworkConditions(conditions: NetworkConditions): void {
    // Set online/offline status
    Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: !conditions.offline
    });
    // Dispatch online/offline events
    window.dispatchEvent(new Event(conditions.offline ? 'offline' : 'online'));
    // Note: Actual network throttling would require browser DevTools API
    logger.info('Network conditions simulated:', conditions);
}
