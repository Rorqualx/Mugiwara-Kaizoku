/**
 * SSR-Safe Computed Style Utilities
 *
 * Provides safe access to getComputedStyle with SSR fallback.
 * Handles cases where window is undefined during server-side rendering.
 *
 * @module utils/browser/computed-style
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';

/**
 * Computed style information interface
 */
export interface ComputedStyleInfo {
  /** CSS property values */
  properties: Record<string, string>;
  /** Element reference (if available) */
  element?: Element | null | undefined;
}

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Check if getComputedStyle is available
 */
export function isComputedStyleAvailable(): boolean {
  return isBrowser() && typeof window.getComputedStyle === 'function';
}

/**
 * Get computed style for an element with SSR safety
 *
 * @param element - Element to get computed style for
 * @param pseudoElement - Optional pseudo-element
 * @returns ComputedStyleInfo with style properties or empty object during SSR
 */
export function getComputedStyle(
  element?: Element | null,
  pseudoElement?: string
): ComputedStyleInfo {
  if (!isComputedStyleAvailable() || !element) {
    return {
      properties: {},
      element,
    };
  }

  try {
    const computedStyle = window.getComputedStyle(element, pseudoElement);
    const properties: Record<string, string> = {};

    // Get all computed style properties
    for (let i = 0; i < computedStyle.length; i++) {
      const propertyName = computedStyle[i];
      if (propertyName) {
        properties[propertyName] = computedStyle.getPropertyValue(propertyName);
      }
    }

    return {
      properties,
      element,
    };
  } catch (_error) {
    // Fallback to empty properties on error
    return {
      properties: {},
      element,
    };
  }
}

/**
 * Get computed style for an element as AsyncResult
 *
 * @param element - Element to get computed style for
 * @param pseudoElement - Optional pseudo-element
 * @returns AsyncResult<ComputedStyleInfo> with computed style data
 */
export function getComputedStyleAsync(
  element?: Element | null,
  pseudoElement?: string
): AsyncResult<ComputedStyleInfo> {
  try {
    const computedStyle = getComputedStyle(element, pseudoElement);
    return createSuccessResult(computedStyle);
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to get computed style')
    );
  }
}

/**
 * Get specific computed style property value
 *
 * @param element - Element to get property from
 * @param propertyName - CSS property name
 * @param pseudoElement - Optional pseudo-element
 * @returns Property value or empty string
 */
export function getComputedStyleProperty(
  element: Element | null,
  propertyName: string,
  pseudoElement?: string
): string {
  const computedStyle = getComputedStyle(element, pseudoElement);
  return computedStyle.properties[propertyName] ?? '';
}

/**
 * Get computed style property value as AsyncResult
 *
 * @param element - Element to get property from
 * @param propertyName - CSS property name
 * @param pseudoElement - Optional pseudo-element
 * @returns AsyncResult<string> with property value
 */
export function getComputedStylePropertyAsync(
  element: Element | null,
  propertyName: string,
  pseudoElement?: string
): AsyncResult<string> {
  try {
    const value = getComputedStyleProperty(element, propertyName, pseudoElement);
    return createSuccessResult(value);
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to get computed style property')
    );
  }
}

/**
 * Check if a CSS custom property is defined
 *
 * @param element - Element to check
 * @param propertyName - CSS custom property name (e.g., --mantine-color-text)
 * @param pseudoElement - Optional pseudo-element
 * @returns boolean indicating if property is defined and non-empty
 */
export function hasCustomProperty(
  element: Element | null,
  propertyName: string,
  pseudoElement?: string
): boolean {
  const value = getComputedStyleProperty(element, propertyName, pseudoElement);
  return value !== '';
}

/**
 * Get computed style for document root element
 *
 * @returns ComputedStyleInfo for document.documentElement
 */
export function getRootComputedStyle(): ComputedStyleInfo {
  if (!isBrowser()) {
    return { properties: {} };
  }

  return getComputedStyle(document.documentElement);
}

/**
 * Get computed style for document root element as AsyncResult
 *
 * @returns AsyncResult<ComputedStyleInfo> for document.documentElement
 */
export function getRootComputedStyleAsync(): AsyncResult<ComputedStyleInfo> {
  try {
    const computedStyle = getRootComputedStyle();
    return createSuccessResult(computedStyle);
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to get root computed style')
    );
  }
}

/**
 * Get specific computed style property from document root
 *
 * @param propertyName - CSS property name
 * @returns Property value or empty string
 */
export function getRootComputedStyleProperty(propertyName: string): string {
  const computedStyle = getRootComputedStyle();
  return computedStyle.properties[propertyName] ?? '';
}

/**
 * Get specific computed style property from document root as AsyncResult
 *
 * @param propertyName - CSS property name
 * @returns AsyncResult<string> with property value
 */
export function getRootComputedStylePropertyAsync(propertyName: string): AsyncResult<string> {
  try {
    const value = getRootComputedStyleProperty(propertyName);
    return createSuccessResult(value);
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to get root computed style property')
    );
  }
}

/**
 * Check if document root has a specific CSS custom property
 *
 * @param propertyName - CSS custom property name
 * @returns boolean indicating if property is defined and non-empty
 */
export function hasRootCustomProperty(propertyName: string): boolean {
  const value = getRootComputedStyleProperty(propertyName);
  return value !== '';
}