import { useState, useEffect } from 'react';

import { useUIStore } from '../store/uiSlice';
/**
 * Loading states type definition
 */
export type LoadingStatesType = Record<string, boolean>;

/**
 * Return type for the useLoadingState hook
 */
export interface UseLoadingStateResult {
  isLoading: boolean;
  isInitialDataLoading: boolean;
  isBatchUpdateLoading: boolean;
  loadingStates: LoadingStatesType;
}

/**
 * Hook for managing application-wide loading states
 * 
 * This hook provides access to global loading states with proper handling for
 * server-side rendering (SSR) and hydration. It tracks different types of
 * loading states like initial data loading and batch updates.
 * 
 * During SSR or before hydration, it defaults to a loading state to prevent
 * flash of content. After hydration, it uses the actual loading states from
 * the UI store.
 * 
 * @returns {UseLoadingStateResult} Loading state information
 * 
 * @example
 * ```tsx
 * const { isLoading, isInitialDataLoading } = useLoadingState();
 * 
 * return (
 *   <div>
 *     {isLoading && <LoadingSpinner />}
 *     {isInitialDataLoading && <InitialLoadingScreen />}
 *   </div>
 * );
 * ```
 */
export function useLoadingState(): UseLoadingStateResult {
  // Default values for SSR
  const [mounted, setMounted] = useState(false);

  // Get loading states from store
  const loadingStates = useUIStore((state) => state.loadingStates);

  // Set mounted state after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR or before hydration, assume we're loading
  if (!mounted) {
    return {
      isLoading: true,
      isInitialDataLoading: true,
      isBatchUpdateLoading: false,
      loadingStates: { 'initial-data': true }
    };
  }

  // After hydration, use the actual loading states from the store
  const isLoading = Object.values(loadingStates).some(Boolean);
  const isInitialDataLoading = Boolean(loadingStates['initial-data']);
  const isBatchUpdateLoading = Boolean(loadingStates['batch-update']);

  return {
    isLoading,
    isInitialDataLoading,
    isBatchUpdateLoading,
    loadingStates
  };
}