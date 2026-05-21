/**
 * useSearchErrors Hook
 *
 * Manages search error state and error handling.
 * Aggregates errors from multiple sources (provider search, standardized search).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import type { AsyncResult } from '@/utils/async-result';
import { isError, createIdleResult } from '@/utils/async-result';

import type { UseSearchErrorsReturn } from './types';

/**
 * Props for useSearchErrors hook
 */
interface UseSearchErrorsProps {
  searchErrors: Record<string, string>;
  clearSearchErrors: () => void;
  searchState: AsyncResult<unknown, Error>;
  setSearchState: (state: AsyncResult<unknown, Error>) => void;
}

/**
 * Hook to manage search error state
 *
 * @param props - Hook configuration
 * @returns Error state and handlers
 *
 * @example
 * ```tsx
 * const { errors, handleErrorClose } = useSearchErrors({
 *   searchErrors,
 *   clearSearchErrors,
 *   searchState,
 *   setSearchState
 * });
 * ```
 */
export function useSearchErrors({
  searchErrors,
  clearSearchErrors,
  searchState,
  setSearchState
}: UseSearchErrorsProps): UseSearchErrorsReturn {
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Track search errors with debouncing
  const searchErrorsRef = useRef<Record<string, string>>(searchErrors);

  useEffect(() => {
    searchErrorsRef.current = searchErrors;
  }, [searchErrors]);

  useEffect(() => {
    if (Object.keys(searchErrors).length > 0 && JSON.stringify(searchErrors) !== JSON.stringify(searchErrorsRef.current)) {
      const timer = setTimeout(() => setErrors(searchErrors), 300);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [searchErrors]);

  /**
   * Handle error close action
   * Clears both provider search errors and standardized search errors
   */
  const handleErrorClose = useCallback((): void => {
    clearSearchErrors();
    if (isError(searchState)) {
      setSearchState(createIdleResult());
    }
  }, [clearSearchErrors, searchState, setSearchState]);

  return {
    errors,
    handleErrorClose,
    setErrors
  };
}
