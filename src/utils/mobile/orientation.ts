/**
 * Mobile Orientation Utilities
 *
 * Utilities for handling device orientation:
 * - Orientation detection
 * - Orientation locking
 * - Fullscreen management
 * - Viewport handling
 */
/* global screen, getComputedStyle */
// import { logger } from '@/utils/logger';
import { createSuccessResult, createErrorResult } from '../async-result';

import type { AsyncResult} from '../async-result';

/**
 * Type augmentations for browser APIs with vendor prefixes
 */
interface CustomScreenOrientation extends ScreenOrientation {
  lock(orientation: OrientationLock): Promise<void>;
  unlock(): void;
}

interface ScreenWithOrientation extends Screen {
  orientation: CustomScreenOrientation;
}

interface HTMLElementWithFullscreen extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

interface DocumentWithFullscreen extends Document {
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

/**
 * Helper to get typed screen with orientation support
 */
function getScreenWithOrientation(): ScreenWithOrientation {
  return screen as unknown as ScreenWithOrientation;
}

/**
 * Helper to get typed document with fullscreen support
 */
function getDocumentWithFullscreen(): DocumentWithFullscreen {
  return document as unknown as DocumentWithFullscreen;
}

/**
 * Helper to get typed element with fullscreen support
 */
function getElementWithFullscreen(element: HTMLElement): HTMLElementWithFullscreen {
  return element as unknown as HTMLElementWithFullscreen;
}

export type OrientationType = 'portrait' | 'landscape';
export type OrientationLock = 'portrait' | 'landscape' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary' | 'natural' | 'any';
export interface OrientationInfo {
    type: OrientationType;
    angle: number;
    isPortrait: boolean;
    isLandscape: boolean;
}
/**
 * Get current device orientation
 */
export function getOrientation(): OrientationInfo {
    // Check screen orientation API
    if ('orientation' in screen) {
        const screenExt = getScreenWithOrientation();
        const orientation = screenExt.orientation;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const angle = orientation.angle ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const type = orientation.type ?? '';
        const isPortrait = type.includes('portrait') || angle === 0 || angle === 180;
        return {
            type: isPortrait ? 'portrait' : 'landscape',
            angle,
            isPortrait,
            isLandscape: !isPortrait
        };
    }
    // Fallback to window dimensions
    const isPortrait = window.innerHeight > window.innerWidth;
    return {
        type: isPortrait ? 'portrait' : 'landscape',
        angle: 0,
        isPortrait,
        isLandscape: !isPortrait
    };
}
/**
 * Lock screen orientation
 */
export async function lockOrientation(orientation: OrientationLock): Promise<AsyncResult<void, Error>> {
    try {
        // Check if orientation lock is supported
        const screenExt = getScreenWithOrientation();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!('orientation' in screen) || !screenExt.orientation.lock) {
            return createErrorResult(new Error('Orientation lock not supported'));
        }
        // Must be in fullscreen to lock orientation on most browsers
        if (!document.fullscreenElement) {
            const elem = getElementWithFullscreen(document.documentElement as HTMLElement);
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (elem.requestFullscreen) {
                await elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                await elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                await elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                await elem.msRequestFullscreen();
            }
        }
        // Lock orientation
        await screenExt.orientation.lock(orientation);
        return createSuccessResult(undefined);
    } catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to lock orientation'));
    }
}
/**
 * Unlock screen orientation
 */
export function unlockOrientation(): Promise<AsyncResult<void, Error>> {
    try {
        // Check if orientation lock is supported
        const screenExt = getScreenWithOrientation();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!('orientation' in screen) || !screenExt.orientation.unlock) {
            return Promise.resolve(createErrorResult(new Error('Orientation unlock not supported')));
        }
        // Unlock orientation
        screenExt.orientation.unlock();
        return Promise.resolve(createSuccessResult(undefined));
    } catch (error: unknown) {
        return Promise.resolve(createErrorResult(error instanceof Error ? error : new Error('Failed to unlock orientation')));
    }
}
/**
 * Request fullscreen
 */
export async function requestFullscreen(element?: HTMLElement): Promise<AsyncResult<void, Error>> {
    try {
        const elemExt = getElementWithFullscreen(element ?? document.documentElement as HTMLElement);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (elemExt.requestFullscreen) {
            await elemExt.requestFullscreen();
        } else if (elemExt.webkitRequestFullscreen) {
            await elemExt.webkitRequestFullscreen();
        } else if (elemExt.mozRequestFullScreen) {
            await elemExt.mozRequestFullScreen();
        } else if (elemExt.msRequestFullscreen) {
            await elemExt.msRequestFullscreen();
        } else {
            return createErrorResult(new Error('Fullscreen not supported'));
        }
        return createSuccessResult(undefined);
    } catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to enter fullscreen'));
    }
}
/**
 * Exit fullscreen
 */
export async function exitFullscreen(): Promise<AsyncResult<void, Error>> {
    try {
        if (!document.fullscreenElement) {
            return createSuccessResult(undefined);
        }
        const docExt = getDocumentWithFullscreen();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (document.exitFullscreen) {
            await document.exitFullscreen();
        } else if (docExt.webkitExitFullscreen) {
            await docExt.webkitExitFullscreen();
        } else if (docExt.mozCancelFullScreen) {
            await docExt.mozCancelFullScreen();
        } else if (docExt.msExitFullscreen) {
            await docExt.msExitFullscreen();
        } else {
            return createErrorResult(new Error('Exit fullscreen not supported'));
        }
        return createSuccessResult(undefined);
    } catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to exit fullscreen'));
    }
}
/**
 * Toggle fullscreen
 */
export async function toggleFullscreen(element?: HTMLElement): Promise<AsyncResult<boolean, Error>> {
    try {
        if (document.fullscreenElement) {
            await exitFullscreen();
            return createSuccessResult(false);
        } else {
            await requestFullscreen(element);
            return createSuccessResult(true);
        }
    } catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to toggle fullscreen'));
    }
}
/**
 * Check if fullscreen is enabled
 */
export function isFullscreenEnabled(): boolean {
    const docExt = getDocumentWithFullscreen();
    return !!(document.fullscreenEnabled ||
        docExt.webkitFullscreenEnabled ||
        docExt.mozFullScreenEnabled ||
        docExt.msFullscreenEnabled);
}
/**
 * Get fullscreen element
 */
export function getFullscreenElement(): Element | null {
    const docExt = getDocumentWithFullscreen();
    return (document.fullscreenElement ??
        docExt.webkitFullscreenElement ??
        docExt.mozFullScreenElement ??
        docExt.msFullscreenElement ??
        null);
}
/**
 * Add orientation change listener
 */
export function onOrientationChange(callback: (orientation: OrientationInfo) => void): () => void {
    const handleChange = (): void => {
        callback(getOrientation());
    };
    // Modern API
    const screenExt = getScreenWithOrientation();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if ('orientation' in screen && screenExt.orientation) {
        screenExt.orientation.addEventListener('change', handleChange);
        return () => {
            screenExt.orientation.removeEventListener('change', handleChange);
        };
    }
    // Legacy API
    window.addEventListener('orientationchange', handleChange);
    window.addEventListener('resize', handleChange);
    return () => {
        window.removeEventListener('orientationchange', handleChange);
        window.removeEventListener('resize', handleChange);
    };
}
/**
 * Add fullscreen change listener
 */
export function onFullscreenChange(callback: (isFullscreen: boolean) => void): () => void {
    const handleChange = (): void => {
        callback(!!getFullscreenElement());
    };
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    document.addEventListener('mozfullscreenchange', handleChange);
    document.addEventListener('MSFullscreenChange', handleChange);
    return () => {
        document.removeEventListener('fullscreenchange', handleChange);
        document.removeEventListener('webkitfullscreenchange', handleChange);
        document.removeEventListener('mozfullscreenchange', handleChange);
        document.removeEventListener('MSFullscreenChange', handleChange);
    };
}
/**
 * Get safe area insets for notched devices
 */
export function getSafeAreaInsets(): {
    top: number;
    right: number;
    bottom: number;
    left: number;
} {
    const computedStyle = getComputedStyle(document.documentElement);
    return {
        top: parseInt(computedStyle.getPropertyValue('--sat') || '0', 10),
        right: parseInt(computedStyle.getPropertyValue('--sar') || '0', 10),
        bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0', 10),
        left: parseInt(computedStyle.getPropertyValue('--sal') || '0', 10)
    };
}
