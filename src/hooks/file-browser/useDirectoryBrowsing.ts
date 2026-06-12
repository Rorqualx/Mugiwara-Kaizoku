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

  // Extract browse data with type guards.
  // pathMapping.browse now returns the bare payload over the wire
  // ({ currentPath, parent, entries }) — failures surface via the query's
  // error channel instead of an in-band AsyncResult envelope.
  const browseData = useMemo((): BrowseData | null => {
    if (!browseResult) return null;

    const data = isObject(browseResult) && 'entries' in browseResult
      ? browseResult as Record<string, unknown>
      : null;
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