/**
 * useBrowseDirectory Hook
 *
 * Manages directory browsing functionality for the library manager.
 * Handles modal state, path navigation, and directory selection.
 *
 * Extracted from: FullFunctionalityLibraryManager.tsx (lines 178-300)
 *
 * @module components/library/library-manager/hooks/useBrowseDirectory
 */

import { useState, useCallback } from 'react';

import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import type { BrowseAsyncResult } from '../types';

/**
 * Return type for useBrowseDirectory hook
 */
export interface UseBrowseDirectoryReturn {
  // State
  browseModalOpen: boolean;
  currentBrowsePath: string;

  // tRPC query result
  browseResult: BrowseAsyncResult | undefined;
  isBrowseLoading: boolean;

  // Callbacks
  handleBrowseClick: () => void;
  handleNavigateToPath: (path: string) => void;
  handleSelectDirectory: (path: string) => void;
  handleCloseBrowse: () => void;
  setCurrentBrowsePath: (path: string) => void;
}

/**
 * Props for useBrowseDirectory hook
 */
export interface UseBrowseDirectoryProps {
  /** Callback when directory is selected */
  onPathSelect: (path: string) => void;
  /** Current path input value for initial browse location */
  currentPathInput: string;
  /** Initial path to start browsing from */
  initialPath?: string;
}

/**
 * Hook for managing directory browsing functionality
 *
 * Manages modal state, fetches directory contents, and handles user navigation
 * and selection within the file system. Uses lazy fetching (only when modal open).
 *
 * @param props - Hook configuration
 * @param props.onPathSelect - Callback when user selects a directory
 * @param props.currentPathInput - Current scan path input value
 * @param props.initialPath - Initial path to browse from (default: '')
 * @returns Object containing state, query result, and callback handlers
 */
export function useBrowseDirectory({
  onPathSelect,
  currentPathInput,
  initialPath = '',
}: UseBrowseDirectoryProps): UseBrowseDirectoryReturn {
  // Local state
  const [browseModalOpen, setBrowseModalOpen] = useState(false);
  const [currentBrowsePath, setCurrentBrowsePath] = useState('');

  // tRPC query - only fetches when modal is open
  const { data: browseResult, isLoading: isBrowseLoading } =
    trpc.pathMapping.browse.useQuery(
      { path: currentBrowsePath },
      {
        enabled: browseModalOpen,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: 30000, // Cache results for 30 seconds
        gcTime: 60000, // Keep in memory for 1 minute (formerly cacheTime in React Query v4)
      },
    );

  // Handle browse button click - opens modal
  const handleBrowseClick = useCallback(() => {
    const existingPath = currentPathInput.trim();
    setCurrentBrowsePath(existingPath || initialPath);

    // Use setTimeout to ensure state updates are flushed before opening modal
    setTimeout(() => {
      setBrowseModalOpen(true);
    }, 0);
  }, [currentPathInput, initialPath]);

  // Handle directory navigation within browse modal
  const handleNavigateToPath = useCallback((path: string) => {
    logger.info('Navigating to path:', { path });
    setCurrentBrowsePath(path);
  }, []);

  // Handle directory selection from browse modal
  const handleSelectDirectory = useCallback(
    (path: string) => {
      logger.info('Selected directory:', { path });
      onPathSelect(path);
      setBrowseModalOpen(false);
    },
    [onPathSelect],
  );

  // Handle closing browse modal
  const handleCloseBrowse = useCallback(() => {
    logger.info('Closing browse modal');
    setBrowseModalOpen(false);
    setCurrentBrowsePath('');
  }, []);

  return {
    // State
    browseModalOpen,
    currentBrowsePath,

    // tRPC query result
    browseResult,
    isBrowseLoading,

    // Callbacks
    handleBrowseClick,
    handleNavigateToPath,
    handleSelectDirectory,
    handleCloseBrowse,
    setCurrentBrowsePath,
  };
}
