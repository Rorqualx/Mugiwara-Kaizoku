/**
 * useDirectoryBrowsing Hook
 *
 * Handles tRPC directory browsing logic with safe type access and data extraction
 */

import { useMemo } from 'react';

import { isObject } from '@/utils/type-guards';

import type { DirectoryBrowsingResult, BrowseData } from './types';

export type QueryFn = (params: { path: string | undefined }, options: { enabled: boolean }) => {
  data: unknown;
  isLoading: boolean;
  error: unknown
};

/**
 * Hook for browsing directories using tRPC with safe type access
 */
export function useDirectoryBrowsing(
  currentPath: string | undefined,
  opened: boolean,
  trpc: unknown
): DirectoryBrowsingResult {
  // Extract tRPC browse capability with safe type guards
  const { hasBrowseCapability, useQueryFn } = useMemo(() => {
    const trpcObj: unknown = trpc;
    const hasPathMapping = isObject(trpcObj) && 'pathMapping' in trpcObj;
    const pathMapping = hasPathMapping ? (trpcObj as Record<string, unknown>)['pathMapping'] : undefined;
    const hasBrowse = isObject(pathMapping) && 'browse' in pathMapping;
    const browse = hasBrowse ? (pathMapping as Record<string, unknown>)['browse'] : undefined;
    const hasUseQuery = isObject(browse) && 'useQuery' in browse && typeof (browse as Record<string, unknown>)['useQuery'] === 'function';

    // Always call the hook - use a no-op if not available
    const useQueryFn = hasUseQuery
      ? (browse as Record<string, unknown>)['useQuery'] as QueryFn
      : (() => ({ data: undefined, isLoading: false, error: undefined })) as unknown as QueryFn;

    return {
      hasBrowseCapability: hasUseQuery,
      useQueryFn
    };
  }, [trpc]);

  // Execute the query
  const { data: browseResult, isLoading, error } = useQueryFn(
    { path: currentPath },
    { enabled: opened && hasBrowseCapability }
  );

  // Extract browse data with type guards
  const browseData = useMemo((): BrowseData | null => {
    if (!browseResult) return null;

    // Type guard to check if browseResult has AsyncResult structure
    const hasAsyncResultShape = isObject(browseResult) && 'status' in browseResult;
    if (!hasAsyncResultShape) return null;

    // Now cast to AsyncResult-like type
    type AsyncResultLike = { status: 'success' | 'error' | 'loading' | 'idle'; data?: unknown };
    const resultCast = browseResult as AsyncResultLike;

    // Check if it's a success result using proper AsyncResult pattern
    if (resultCast.status !== 'success' || !('data' in resultCast)) return null;

    const data = isObject(resultCast.data) ? resultCast.data as Record<string, unknown> : null;
    if (!data) return null;

    return {
      entries: (Array.isArray(data['entries']) ? data['entries'] : []) as Array<{
        name: string;
        path: string;
        isDirectory: boolean;
        isAccessible: boolean;
      }>,
      parent: typeof data['parent'] === 'string' ? data['parent'] : undefined,
      currentPath: typeof data['currentPath'] === 'string' ? data['currentPath'] : undefined
    };
  }, [browseResult]);

  return {
    browseData,
    isLoading,
    error,
    hasBrowseCapability
  };
}