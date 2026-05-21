/**
 * useFileBrowserNavigation Hook
 *
 * Handles file browser navigation logic including directory navigation,
 * manual path submission, and current path selection
 */

import { useState, useCallback } from 'react';

import type { FileBrowserNavigation } from './types';

/**
 * Hook for managing file browser navigation state and actions
 */
export function useFileBrowserNavigation(
  initialPath?: string
): FileBrowserNavigation {
  const [currentPath, setCurrentPath] = useState<string | undefined>(initialPath);
  const [manualPath, setManualPath] = useState('');

  // Handle directory navigation
  const handleNavigate = useCallback((path: string): void => {
    setCurrentPath(path);
    setManualPath('');
  }, []);

  // Handle go to parent
  const handleGoUp = useCallback((): void => {
    // Parent navigation is handled by the browse data, not directly here
    // This function is kept for API consistency
  }, []);

  // Handle select current path
  const handleSelectCurrent = useCallback((onSelect: (path: string) => void, onClose: () => void): void => {
    if (currentPath) {
      onSelect(currentPath);
      onClose();
    }
  }, [currentPath]);

  // Handle manual path input
  const handleManualPathSubmit = useCallback((): void => {
    if (manualPath.trim()) {
      handleNavigate(manualPath.trim());
    }
  }, [manualPath, handleNavigate]);

  return {
    currentPath,
    manualPath,
    setManualPath,
    handleNavigate,
    handleGoUp,
    handleSelectCurrent,
    handleManualPathSubmit
  };
}