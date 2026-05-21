/**
 * Modal components for handling out-of-sync chapter confirmations
 * 
 * This module provides a modal dialog for confirming chapter synchronization
 * operations. Features include:
 * - Customizable title and message
 * - Confirmation and cancel actions
 * - Centered modal display
 * - Consistent styling
 */

import React from "react";

import { Box, Button, Text } from "@mantine/core";
import { useModals } from "@mantine/modals";

/**
 * Props for the modal content component
 */
interface OutOfSyncChapterModalContentProps {
  /** Callback function when user confirms */
  onOk: () => void;
  /** Callback function when modal is closed */
  onClose: () => void;
  /** Message to display in modal body */
  body: string;
}

/**
 * Modal content component for out-of-sync chapter confirmations
 * 
 * Displays a confirmation message with action buttons for
 * accepting or canceling the operation.
 * 
 * @param props - Component properties
 * @param props.onOk - Handler for confirmation
 * @param props.onClose - Handler for modal close
 * @param props.body - Modal message text
 */
function OutOfSyncChapterModalContent({
  onOk,
  onClose,
  body,
}: OutOfSyncChapterModalContentProps): React.ReactElement {
  return (
    <>
      <Text mb={4} size="sm">
        {body}
      </Text>
      <Box 
        style={{
          display: "flex",
          gap: "var(--mantine-spacing-xs)",
          justifyContent: "flex-end",
          marginTop: "var(--mantine-spacing-md)",
        }}
      >
        <Button variant="default" color="dark" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="filled"
          color="teal"
          onClick={() => {
            onOk();
            onClose();
          }}
        >
          Ok
        </Button>
      </Box>
    </>
  );
}

/**
 * Hook for creating an out-of-sync chapter confirmation modal
 * 
 * Creates a modal dialog with customizable title and message for
 * confirming chapter synchronization operations.
 * 
 * @param title - Modal title text
 * @param body - Modal body message
 * @param onOk - Callback function when user confirms
 * @returns Function to open the modal
 * 
 * @example
 * ```tsx
 * const openModal = useOutOfSyncChapterModal(
 *   "Sync Chapters",
 *   "Do you want to synchronize out-of-sync chapters?",
 *   () => handleSync()
 * );
 * 
 * // Later in your component:
 * <Button onClick={openModal}>
 *   Sync Chapters
 * </Button>
 * ```
 */
export const useOutOfSyncChapterModal = (
  title: string,
  body: string,
  onOk: () => void
): (() => void) => {
  const modals = useModals();

  /**
   * Opens the confirmation modal with provided content
   * Modal is centered and includes confirm/cancel actions
   */
  const openRemoveModal = (): void => {
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
  };

  return openRemoveModal;
};
