/**
 * Out of Sync Chapter Modal Hook
 * 
 * This module provides a hook for creating modals that notify users about
 * out-of-sync chapters in the manga library. It uses the client modal system
 * to display a modal with customizable title, body text, and confirmation action.
 * 
 * @module components/outOfSyncChapter
 */
import React from "react";
import { useCallback } from 'react';

import { useClientModal } from '@/hooks/useClientModal';

import { OutOfSyncChapterModalContent } from './OutOfSyncChapterModalContent';

/**
 * Props for the useOutOfSyncChapterModal hook
 */
export interface UseOutOfSyncChapterModalProps {
  /** Title to display in the modal header */
  title: string;
  /** Message body explaining the out-of-sync issue */
  body: string;
  /** Callback function to execute when the user confirms the action */
  onOk: () => void;
}

/**
 * Hook for creating and opening an out-of-sync chapter notification modal
 * 
 * This hook returns a function that, when called, opens a modal dialog
 * informing the user about out-of-sync chapters and providing options to
 * resolve the issue.
 * 
 * @param title - The title to display in the modal header
 * @param body - The message body explaining the out-of-sync issue
 * @param onOk - Callback function to execute when the user confirms the action
 * @returns Function to open the modal
 * 
 * @example
 * ```tsx
 * const openSyncWarning = useOutOfSyncChapterModal(
 *   'Chapter Sync Warning',
 *   'Some chapters are out of sync with the source.',
 *   () => handleResync()
 * );
 * 
 * // Later in your component:
 * <Button onClick={openSyncWarning}>Check Sync Status</Button>
 * ```
 */
export const useOutOfSyncChapterModal = (
  title: string, 
  body: string, 
  onOk: () => void
): (() => void) => {
  const { modals, mounted } = useClientModal();
  
  return useCallback(() => {
    if (!mounted) return;
    
    const id = modals.openModal({
      title,
      centered: true,
      children: (
        <OutOfSyncChapterModalContent
          onOk={onOk}
          onClose={() => modals.closeModal(id)}
          body={body}
        />
      ),
    });
  }, [title, body, onOk, modals, mounted]);
};
