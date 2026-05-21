/**
 * SSR-Safe Location Utilities
 *
 * Provides safe access to window.location with SSR fallback.
 * Handles cases where window is undefined during server-side rendering.
 *
 * @module utils/browser/location
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';

/**
 * Location information interface
 */
export interface LocationInfo {
  /** Full URL including protocol, host, path, and query */
  href: string;
  /** Protocol (http:, https:, etc.) */
  protocol: string;
  /** Hostname and port */
  host: string;
  /** Hostname without port */
  hostname: string;
  /** Port number */
  port: string;
  /** Pathname (e.g., /path/to/page) */
  pathname: string;
  /** Search query string (e.g., ?key=value) */
  search: string;
  /** Hash fragment (e.g., #section) */
  hash: string;
  /** Origin (protocol + host) */
  origin: string;
}

/**
 * Default location values for SSR fallback
 */
const DEFAULT_LOCATION: LocationInfo = {
  href: 'http://localhost:3000',
  protocol: 'http:',
  host: 'localhost:3000',
  hostname: 'localhost',
  port: '3000',
  pathname: '/',
  search: '',
  hash: '',
  origin: 'http://localhost:3000',
};

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get current location information with SSR safety
 *
 * @returns LocationInfo with current location or default values during SSR
 */
export function getLocation(): LocationInfo {
  if (!isBrowser()) {
    return DEFAULT_LOCATION;
  }

  const { location } = window;
  return {
    href: location.href,
    protocol: location.protocol,
    host: location.host,
    hostname: location.hostname,
    port: location.port,
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    origin: location.origin,
  };
}

/**
 * Get current location information as AsyncResult
 *
 * @returns AsyncResult<LocationInfo> with location data
 */
export function getLocationAsync(): AsyncResult<LocationInfo> {
  try {
    const location = getLocation();
    return createSuccessResult(location);
  } catch (error) {
    return createErrorResult(error instanceof Error ? error : new Error('Failed to get location'));
  }
}

/**
 * Check if current protocol is HTTPS
 *
 * @returns boolean indicating if using HTTPS
 */
export function isHttps(): boolean {
  const location = getLocation();
  return location.protocol === 'https:';
}

/**
 * Check if running on localhost
 *
 * @returns boolean indicating if on localhost
 */
export function isLocalhost(): boolean {
  const location = getLocation();
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

/**
 * Check if current environment is secure (HTTPS or localhost)
 *
 * @returns boolean indicating if environment is secure
 */
export function isSecureEnvironment(): boolean {
  return isHttps() || isLocalhost();
}

/**
 * Get current pathname
 *
 * @returns string pathname
 */
export function getPathname(): string {
  return getLocation().pathname;
}

/**
 * Get current search parameters
 *
 * @returns URLSearchParams object
 */
export function getSearchParams(): URLSearchParams {
  const location = getLocation();
  return new URLSearchParams(location.search);
}

/**
 * Get specific search parameter value
 *
 * @param key - Parameter key
 * @returns Parameter value or null
 */
export function getSearchParam(key: string): string | null {
  const params = getSearchParams();
  return params.get(key);
}

/**
 * Navigate to a new URL
 *
 * @param url - URL to navigate to
 * @param options - Navigation options
 */
export function navigateTo(url: string, options?: { replace?: boolean }): void {
  if (!isBrowser()) {
    return;
  }

  const { replace = false } = options ?? {};

  if (replace) {
    window.location.replace(url);
  } else {
    window.location.href = url;
  }
}

/**
 * Reload the current page
 */
export function reloadPage(): void {
  if (!isBrowser()) {
    return;
  }

  window.location.reload();
}