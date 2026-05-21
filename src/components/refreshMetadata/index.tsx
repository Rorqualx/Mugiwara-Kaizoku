/**
 * Refresh Metadata Modal Hook
 * 
 * This module provides a hook for creating modals that prompt users to refresh
 * metadata for manga items. It uses the client modal system to display a confirmation
 * dialog with customizable title and refresh action.
 * 
 * @module components/refreshMetadata
 */
import React from "react";
import { useCallback } from 'react';

import { useClientModal } from '@/hooks/useClientModal';

import { RefreshMetadataModalContent } from './RefreshMetadataModalContent';

/**
 * Hook for creating and opening a refresh metadata confirmation modal
 * 
 * This hook returns a function that, when called, opens a modal dialog
 * asking the user to confirm refreshing metadata for a specific manga.
 * 
 * @param {string} title - The title of the manga to refresh metadata for
 * @param {Function} onRefresh - Callback function to execute when the user confirms the refresh
 * @returns {Function} Function to open the modal
 * 
 * @example
 * ```tsx
 * const openRefreshModal = useRefreshModal(
 *   'One Piece',
 *   () => refreshMangaMetadata(mangaId)
 * );
 * 
 * // Later in your component:
 * <Button onClick={openRefreshModal}>Refresh Metadata</Button>
 * ```
 */
export const useRefreshModal = (title: string, onRefresh: () => void): Function => {
  const { modals, mounted } = useClientModal();
  
  return useCallback(() => {
    if (!mounted) return;
    
    const id = modals.openModal({
      title: `Refresh Metadata for ${title}?`,
      centered: true,
      children: (
        <RefreshMetadataModalContent
          onRefresh={onRefresh}
          onClose={() => modals.closeModal(id)}
        />
      ),
    });
  }, [title, onRefresh, modals, mounted]);
};
