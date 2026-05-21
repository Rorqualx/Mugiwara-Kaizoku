/**
 * Local storage hook with TypeScript support
 * Persists state to localStorage and syncs across tabs
 */

import { useState, useEffect, useCallback } from 'react';

import { logger } from '@/utils/logger';

/**
 * Type guard to validate parsed value matches expected type
 * This is a simple check - for complex types, implement custom validation
 */
function isParsedValueValid<T>(value: unknown, initialValue: T): value is T {
  // If initial value is null/undefined, accept any value
  if (initialValue === null) {
    return true;
  }

  // Basic type matching
  const initialType = typeof initialValue;
  const valueType = typeof value;

  // For objects and arrays, we do basic structural validation
  if (initialType === 'object') {
    if (Array.isArray(initialValue)) {
      return Array.isArray(value);
    }
    return valueType === 'object' && value !== null;
  }

  // For primitives, exact type match
  return valueType === initialType;
}
/**
 * Use local storage to persist state
 * @param key - The localStorage key
 * @param initialValue - The initial value if nothing in storage
 * @returns [value, setValue, removeValue]
 */
export function useLocalStorage<T>(
key: string,
initialValue: T): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Get from local storage then parse stored json or return initialValue
  const readValue = useCallback((): T => {
    // Prevent build error "window is undefined" but keep compatibility
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (!item) {
        return initialValue;
      }

      const parsed: unknown = JSON.parse(item);

      // Validate parsed value matches expected type
      if (isParsedValueValid(parsed, initialValue)) {
        return parsed;
      }

      logger.warn(`Parsed localStorage value for "${key}" doesn't match expected type, using initial value`);
      return initialValue;
    } catch (error: unknown) {
      logger.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [initialValue, key]);
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(readValue);
  // Return a wrapped version of useState's setter function that persists the new value to localStorage.
  const setValue = useCallback(
    (value: T | ((prev: T) => T)): void => {
      // Prevent build error "window is undefined" but keeps working
      if (typeof window === 'undefined') {
        logger.warn(
          `Tried to set localStorage key "${key}" but window is undefined`
        );
        return;
      }

      try {
        // Allow value to be a function so we have the same API as useState
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        // Save to local storage
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        // Save state
        setStoredValue(valueToStore);
        // We dispatch a custom event so every useLocalStorage hook is notified
        window.dispatchEvent(new Event('local-storage'));
      } catch (error: unknown) {
        logger.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );
  // Remove value from local storage
  const removeValue = useCallback((): void => {
    // Prevent build error "window is undefined" but keeps working
    if (typeof window === 'undefined') {
      logger.warn(
        `Tried to remove localStorage key "${key}" but window is undefined`
      );
      return;
    }

    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
      // Dispatch event for other hooks
      window.dispatchEvent(new Event('local-storage'));
    } catch (error: unknown) {
      logger.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [initialValue, key]);
  useEffect(() => {
    setStoredValue(readValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const handleStorageChange = (): void => {
      setStoredValue(readValue());
    };
    // This only works for other tabs/windows
    window.addEventListener('storage', handleStorageChange);
    // This is a custom event for same tab
    window.addEventListener('local-storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [storedValue, setValue, removeValue];
}