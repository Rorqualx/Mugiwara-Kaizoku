/**
 * Store Utilities Module
 *
 * Provides utility functions for working with Zustand stores and selectors
 * to prevent common issues like infinite update loops.
 *
 * @module utils/storeUtils
 */
import { useRef, useEffect } from 'react';

import { logger } from '../utils/logger';
/**
 * Type for a store selector hook that returns a state object
 */
type SelectorHook<T> = () => T;
/**
 * Safely use a store selector hook with protection against infinite update loops
 *
 * This utility function helps prevent infinite update loops by:
 * 1. Storing the selector result in a ref to track changes
 * 2. Warning if the selector result changes on every render
 * 3. Enforcing the pattern of storing selector results before destructuring
 * 4. Providing additional memoization to ensure stable references
 *
 * @param selectorHook - The selector hook to use (e.g., useStoreSelectors)
 * @param componentName - The name of the component using the selector (for warning messages)
 * @returns The result of the selector hook with stable references
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   // Use the safe selector utility
 *   const storeSelectors = useSafeSelector(useStoreSelectors, 'MyComponent');
 *
 *   // Destructure after storing the reference
 *   const { someValue, someOtherValue } = storeSelectors;
 *
 *   // Rest of component...
 * }
 * ```
 */
export function useSafeSelector<T extends Record<string, unknown>>(selectorHook: SelectorHook<T>, componentName: string): T {
    // Use refs to track render count, previous results, and memoized result
    const renderCountRef = useRef(0);
    const prevResultRef = useRef<T | null>(null);
    const warningShownRef = useRef(false);
    const memoizedResultRef = useRef<T | null>(null);
    // Get the current selector result
    const rawResult = selectorHook();
    // Increment render count on each render
    renderCountRef.current += 1;
    // Check if the result reference changed
    const resultChanged = prevResultRef.current !== rawResult;
    // Update the previous result ref
    prevResultRef.current = rawResult;
    // Use effect to detect potential infinite loops
    useEffect(() => {
        // Reset render count after mount
        renderCountRef.current = 0;
        // Reset warning flag
        warningShownRef.current = false;
        // Initialize memoized result
        memoizedResultRef.current ??= rawResult;
        return () => {
            // Cleanup
        };
    }, [rawResult]);
    // Show warning if result changes on every render for more than 5 renders
    if (process.env.NODE_ENV !== 'production' &&
        resultChanged &&
        renderCountRef.current > 5 &&
        !warningShownRef.current) {
        logger.error(`[useSafeSelector] Potential infinite update loop detected in ${componentName}. ` +
            'The selector result is changing on every render. ' +
            'Make sure your selector is properly memoized and not creating new objects unnecessarily. ' +
            'See docs/fix-infinite-update-loop.md for more information.');
        warningShownRef.current = true;
        // Log the component stack trace for easier debugging
        logger.error('Error Component Stack');
        // Force a stable reference to break the infinite loop
        return memoizedResultRef.current ?? rawResult;
    }
    // If the result hasn't changed in a while, update the memoized result
    if (!resultChanged || renderCountRef.current < 3) {
        memoizedResultRef.current = rawResult;
    }
    // Return the memoized result to ensure stable references
    return memoizedResultRef.current ?? rawResult;
}
/**
 * Check if two arrays have the same elements (ignoring order)
 *
 * Uses Set for efficient comparison with O(n) time complexity
 *
 * @param arr1 - First array to compare
 * @param arr2 - Second array to compare
 * @returns True if arrays contain the same elements, false otherwise
 *
 * @example
 * ```typescript
 * const a = [1, 2, 3];
 * const b = [3, 1, 2];
 * const c = [1, 2, 4];
 *
 * hasSameElements(a, b); // true
 * hasSameElements(a, c); // false
 * ```
 */
export function hasSameElements<T>(arr1: T[], arr2: T[]): boolean {
    // Quick length check
    if (arr1.length !== arr2.length) {
        return false;
    }
    // Use Set for O(1) lookups
    const set = new Set(arr1);
    // Check if all elements in arr2 are in the set
    for (const item of arr2) {
        if (!set.has(item)) {
            return false;
        }
    }
    return true;
}
/**
 * Shallow compare two objects for equality
 *
 * Checks if two objects have the same properties with the same values
 * Only compares own enumerable properties
 *
 * @param obj1 - First object to compare
 * @param obj2 - Second object to compare
 * @returns True if objects have the same properties and values, false otherwise
 *
 * @example
 * ```typescript
 * const a = { x: 1, y: 2 };
 * const b = { x: 1, y: 2 };
 * const c = { x: 1, y: 3 };
 *
 * shallowEqual(a, b); // true
 * shallowEqual(a, c); // false
 * ```
 */
export function shallowEqual<T extends Record<string, unknown>>(obj1: T, obj2: T): boolean {
    // Check if references are the same
    if (obj1 === obj2) {
        return true;
    }
    // Get own enumerable property names
    const keys1 = Object.keys(obj1) as (keyof T)[];
    const keys2 = Object.keys(obj2) as (keyof T)[];
    // Quick length check
    if (keys1.length !== keys2.length) {
        return false;
    }
    // Check if all properties have the same values
    for (const key of keys1) {
        if (obj1[key] !== obj2[key]) {
            return false;
        }
    }
    return true;
}
