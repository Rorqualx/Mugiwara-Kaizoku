/**
 * Modal components for refreshing manga metadata from AniList
 * 
 * This module provides a modal dialog for confirming metadata refresh
 * operations. Features include:
 * - Customizable title
 * - Confirmation and cancel actions
 * - Centered modal display
 * - Consistent styling
 * - AniList integration
 */

import React from "react";

import { Box, Button, Text } from "@mantine/core";
import { useModals } from "@mantine/modals";

/**
 * Props for the modal content component
 */
interface RefreshMetadataModalContentProps {
  /** Callback function when user confirms refresh */
  onRefresh: () => void;
  /** Callback function when modal is closed */
  onClose: () => void;
}

/**
 * Modal content component for metadata refresh confirmations
 *
 * Displays a confirmation message explaining the metadata update
 * process with action buttons for confirming or canceling.
 *
 * @param props - Component properties
 * @param props.onRefresh - Handler for refresh confirmation
 * @param props.onClose - Handler for modal close
 */
function RefreshMetadataModalContent({
  onRefresh,
  onClose,
}: RefreshMetadataModalContentProps): React.ReactElement {
  return (
    <>
      <Text mb={4} size="sm">
        This will update all downloaded chapters with the latest metadata from
        AniList
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
            onRefresh();
            onClose();
          }}
        >
          Refresh
        </Button>
      </Box>
    </>
  );
}

/**
 * Hook for creating a metadata refresh confirmation modal
 *
 * Creates a modal dialog for confirming metadata refresh operations
 * with customizable title and refresh handler.
 *
 * @param title - Title of manga to refresh metadata for
 * @param onRefresh - Callback function when user confirms refresh
 * @returns Function to open the modal
 *
 * @example
 * ```tsx
 * const openModal = useRefreshModal(
 *   "One Piece",
 *   () => handleMetadataRefresh()
 * );
 *
 * // Later in your component:
 * <Button onClick={openModal}>
 *   Refresh Metadata
 * </Button>
 * ```
 */
export const useRefreshModal = (title: string, onRefresh: () => void): (() => void) => {
  const modals = useModals();

  /**
   * Opens the refresh confirmation modal with provided content
   * Modal is centered and includes refresh/cancel actions
   */
  const openRefreshModal = (): void => {
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
  };

  return openRefreshModal;
};
