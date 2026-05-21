/**
 * SSR-Safe Browser Utilities
 *
 * Aggregates all browser utilities with SSR safety.
 * Provides safe access to browser APIs with fallback values during server-side rendering.
 *
 * @module utils/browser
 */

import { logger } from '@/utils/logger';

// ============================================================================
// Location Utilities
// ============================================================================

export type {
  LocationInfo,
} from './location';

export {
  isBrowser as isBrowserLocation,
  getLocation,
  getLocationAsync,
  isHttps,
  isLocalhost,
  isSecureEnvironment,
  getPathname,
  getSearchParams,
  getSearchParam,
  navigateTo,
  reloadPage,
} from './location';

// ============================================================================
// Computed Style Utilities
// ============================================================================

export type {
  ComputedStyleInfo,
} from './computed-style';

export {
  isBrowser as isBrowserComputedStyle,
  isComputedStyleAvailable,
  getComputedStyle,
  getComputedStyleAsync,
  getComputedStyleProperty,
  getComputedStylePropertyAsync,
  hasCustomProperty,
  getRootComputedStyle,
  getRootComputedStyleAsync,
  getRootComputedStyleProperty,
  getRootComputedStylePropertyAsync,
  hasRootCustomProperty,
} from './computed-style';

// ============================================================================
// Common Browser Utilities
// ============================================================================

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Check if running in server environment
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Get user agent string with SSR safety
 */
export function getUserAgent(): string {
  if (!isBrowser()) {
    return 'server';
  }

  return window.navigator.userAgent;
}

/**
 * Check if browser supports specific feature
 */
export function isFeatureSupported(feature: string): boolean {
  if (!isBrowser()) {
    return false;
  }

  // Check for common browser features
  switch (feature) {
    case 'localStorage':
      return typeof window.localStorage !== 'undefined';
    case 'sessionStorage':
      return typeof window.sessionStorage !== 'undefined';
    case 'indexedDB':
      return typeof window.indexedDB !== 'undefined';
    case 'serviceWorker':
      return 'serviceWorker' in window.navigator;
    case 'webWorker':
      return typeof Worker !== 'undefined';
    case 'fetch':
      return typeof window.fetch !== 'undefined';
    case 'intersectionObserver':
      return 'IntersectionObserver' in window;
    case 'resizeObserver':
      return 'ResizeObserver' in window;
    case 'matchMedia':
      return typeof window.matchMedia !== 'undefined';
    case 'performance':
      return 'performance' in window;
    case 'requestAnimationFrame':
      return typeof window.requestAnimationFrame !== 'undefined';
    case 'cancelAnimationFrame':
      return typeof window.cancelAnimationFrame !== 'undefined';
    default:
      return false;
  }
}

/**
 * Execute callback only in browser environment
 */
export function executeInBrowser<T>(callback: () => T, fallback?: T): T {
  if (!isBrowser()) {
    return fallback as T;
  }

  try {
    return callback();
  } catch (error) {
    logger.warn('Browser execution failed:', error);
    return fallback as T;
  }
}

/**
 * Execute async callback only in browser environment
 */
export async function executeInBrowserAsync<T>(
  callback: () => Promise<T>,
  fallback?: T
): Promise<T> {
  if (!isBrowser()) {
    return fallback as T;
  }

  try {
    return await callback();
  } catch (error) {
    logger.warn('Browser async execution failed:', error);
    return fallback as T;
  }
}