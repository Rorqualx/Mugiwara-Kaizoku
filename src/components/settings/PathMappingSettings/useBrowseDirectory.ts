/**
 * useBrowseDirectory Hook
 *
 * Manages directory browsing functionality for path mapping settings.
 * Handles modal state, path navigation, and directory selection.
 *
 * Extracted from: PathMappingSettings.tsx (lines 138-285)
 */

import { useState } from 'react';

import { showNotification } from '@mantine/notifications';

import { trpc } from '@/utils/trpc-client/index';

import type { PathMappings } from './types';

export interface UseBrowseDirectoryReturn {
  // State
  browseModalOpen: boolean;
  browsingForClient: keyof PathMappings | null;
  currentBrowsePath: string;

  // Query data
  browseResult: unknown;
  isBrowseLoading: boolean;
  browseError: unknown; // tRPC error type, handled safely in BrowseModal
  refetchBrowse: () => void;

  // Actions
  handleOpenBrowse: (client: keyof PathMappings, existingPath: string) => void;
  handleCloseBrowse: () => void;
  handleNavigateToPath: (path: string) => void;
  handleSelectPath: (onPathChange: (client: keyof PathMappings, value: string) => void) => void;
}

export function useBrowseDirectory(): UseBrowseDirectoryReturn {
  // Browse modal state
  const [browseModalOpen, setBrowseModalOpen] = useState(false);
  const [browsingForClient, setBrowsingForClient] = useState<keyof PathMappings | null>(null);
  const [currentBrowsePath, setCurrentBrowsePath] = useState<string>('');

  // Browse directories query - uses trpc.pathMapping directly, types come from AppRouter
  // Note: onError callback was removed in TanStack Query v5 - use error state instead
  const { data: browseResult, isLoading: isBrowseLoading, error: browseError, refetch: refetchBrowse } = trpc.pathMapping.browse.useQuery(
    { path: currentBrowsePath },
    {
      enabled: browseModalOpen,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 5000, // Consider data fresh for 5 seconds to prevent rapid refetches
      gcTime: 30000,  // Cache results for 30 seconds for quick navigation back
      retry: false  // Don't retry on error
    }
  );

  // No manual refetch needed: TanStack Query refetches automatically when
  // either `currentBrowsePath` (part of the query input) or `browseModalOpen`
  // (the `enabled` gate) changes. The previous useEffect that called
  // `refetchBrowse` was a redundant carry-over from the v4 migration.

  // Handle opening browse modal
  const handleOpenBrowse = (client: keyof PathMappings, existingPath: string): void => {
    // If client already has a path, start browsing from there
    // Otherwise start with common paths (empty string)
    const trimmedPath = existingPath.trim();

    // Start browsing at existing path or starting locations if no path exists
    setBrowsingForClient(client);

    // React 18 batches state updates within the same event handler,
    // so both updates land in a single render — no setTimeout(0) tick needed.
    setCurrentBrowsePath(trimmedPath);
    setBrowseModalOpen(true);
  };

  // Handle closing browse modal
  const handleCloseBrowse = (): void => {
    setBrowseModalOpen(false);
    setBrowsingForClient(null);
    setCurrentBrowsePath('');
  };

  // Handle navigating to a directory
  const handleNavigateToPath = (path: string): void => {
    setCurrentBrowsePath(path);
  };

  // Handle selecting the current path
  const handleSelectPath = (onPathChange: (client: keyof PathMappings, value: string) => void): void => {
    if (browsingForClient && currentBrowsePath) {
      onPathChange(browsingForClient, currentBrowsePath);
      handleCloseBrowse();
      showNotification({
        title: 'Path Selected',
        message: `Selected: ${currentBrowsePath}`,
        color: 'green'
      });
    }
  };

  return {
    // State
    browseModalOpen,
    browsingForClient,
    currentBrowsePath,

    // Query data
    browseResult,
    isBrowseLoading,
    browseError,
    refetchBrowse: () => void refetchBrowse(),

    // Actions
    handleOpenBrowse,
    handleCloseBrowse,
    handleNavigateToPath,
    handleSelectPath
  };
}
