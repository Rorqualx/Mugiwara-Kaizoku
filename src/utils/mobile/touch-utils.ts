// import { logger } from '@/utils/logger';

/**
 * Touch and gesture utilities for mobile interactions
 */
export interface TouchPosition {
    x: number;
    y: number;
}
export interface SwipeDirection {
    direction: 'up' | 'down' | 'left' | 'right' | null;
    distance: number;
    velocity: number;
}
// Alias for backwards compatibility
export type SwipeInfo = SwipeDirection;
/**
 * Calculates the distance between two touch points
 */
export function getTouchDistance(start: TouchPosition, end: TouchPosition): number {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.sqrt(dx * dx + dy * dy);
}
/**
 * Determines swipe direction from touch positions
 */
export function getSwipeDirection(start: TouchPosition, end: TouchPosition, minDistance = 50): SwipeDirection {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Calculate velocity (pixels per millisecond)
    const velocity = distance / 100; // Assuming 100ms swipe time
    if (distance < minDistance) {
        return { direction: null, distance, velocity };
    }
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    let direction: 'up' | 'down' | 'left' | 'right';
    if (absX > absY) {
        direction = dx > 0 ? 'right' : 'left';
    }
    else {
        direction = dy > 0 ? 'down' : 'up';
    }
    return { direction, distance, velocity };
}
/**
 * Gets touch position from TouchEvent
 */
export function getTouchPosition(event: TouchEvent): TouchPosition | null {
    if (event.touches.length === 0) {
        return null;
    }
    const touch = event.touches[0];
    if (!touch) {
        return null;
    }
    return {
        x: touch.clientX,
        y: touch.clientY
    };
}
/**
 * Prevents default touch behavior (useful for preventing scroll)
 */
export function preventTouchDefault(event: TouchEvent): void {
    if (event.cancelable) {
        event.preventDefault();
    }
}
/**
 * Checks if a touch event is a tap (not a swipe or long press)
 */
export function isTap(start: TouchPosition, end: TouchPosition, maxDistance = 10, _maxDuration = 300): boolean {
    const distance = getTouchDistance(start, end);
    return distance <= maxDistance;
}
/**
 * Normalizes touch event coordinates relative to an element
 */
export function normalizeTouch(event: TouchEvent, element: HTMLElement): TouchPosition | null {
    const touch = getTouchPosition(event);
    if (!touch)
        return null;
    const rect = element.getBoundingClientRect();
    return {
        x: touch.x - rect.left,
        y: touch.y - rect.top
    };
}
/**
 * Creates a passive touch event listener options object
 */
export function getPassiveTouchOptions(): AddEventListenerOptions | boolean {
    // Modern browsers support passive event listeners
    // Fallback to false for older browsers
    try {
        const opts = Object.defineProperty({}, 'passive', {
            get: function () {
                return true;
            }
        });
        // Test if passive is supported
        const dummyListener = (): void => { /* no-op */ };
        window.addEventListener('testPassive', dummyListener, opts);
        window.removeEventListener('testPassive', dummyListener, opts);
        return { passive: true };
    }
    catch (_e: unknown) {
        // Passive not supported - use default behavior
        return false;
    }
}
