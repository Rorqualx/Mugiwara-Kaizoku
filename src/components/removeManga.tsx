/**
 * Modal components for manga removal with file deletion options
 *
 * This module provides a modal dialog for confirming manga removal
 * with optional file deletion. Features include:
 * - Confirmation dialog with manga title
 * - Optional file deletion checkbox
 * - Optimistic modal closing for responsive UX
 * - Navigation handling via handler
 */
import React from "react";
import { useState } from "react";

import { Box, Button, Alert, Text, Checkbox, Code } from "@mantine/core";
import { useModals } from "@mantine/modals";

import { logger } from '../utils/logger';
/**
 * Props for the modal content component
 */
interface RemoveModalContentProps {
    /** Title of manga to remove */
    title: string;
    /** Callback function when user confirms removal */
    onRemove: (shouldRemoveFiles: boolean) => void;
    /** Callback function when modal is closed */
    onClose: () => void;
}
/**
 * Modal content component for manga removal confirmations
 *
 * Displays a confirmation dialog with:
 * - Manga title display
 * - File deletion option
 * - Loading overlay
 * - Action buttons
 * - Navigation handling
 *
 * @param props - Component properties
 * @param props["title"] - Title of manga to remove
 * @param props.onRemove - Handler for removal confirmation
 * @param props.onClose - Handler for modal close
 */
function RemoveModalContent({ title, onRemove, onClose }: RemoveModalContentProps): React.JSX.Element {
    const [shouldRemoveFiles, setShouldRemoveFiles] = useState(false);
    return (<>
      <Box>
        
        <Text mb={4} size="sm">
          Are you sure you want to remove{" "}
          <Code className="text-base font-bold" color="red">
            {title}
          </Code>
          ?
        </Text>
        <Alert icon={<Checkbox checked={shouldRemoveFiles} color="red" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShouldRemoveFiles(e.currentTarget.checked)}/>} title="Remove files?" color="red">

          This action is destructive and all downloaded files will be removed
        </Alert>

        <Box style={{
            display: "flex",
            gap: "var(--mantine-spacing-xs)",
            justifyContent: "flex-end",
            marginTop: "var(--mantine-spacing-md)"
        }}>

          <Button variant="default" color="dark" onClick={() => { void onClose(); }}>
            Cancel
          </Button>
            <Button variant="filled" color="red" onClick={() => {
                logger.info('Removing manga with shouldRemoveFiles:', shouldRemoveFiles);
                // Close modal immediately for responsive UX - don't wait for mutation
                onClose();
                // Trigger removal - handler manages navigation and notifications
                void onRemove(shouldRemoveFiles);
            }}>

            Remove
          </Button>
        </Box>
      </Box>
    </>);
}
/**
 * Hook for creating a manga removal confirmation modal
 *
 * Creates a modal dialog for confirming manga removal with
 * optional file deletion and navigation handling.
 *
 * @param title - Title of manga to remove
 * @param onRemove - Callback function when user confirms removal
 * @param parentModals - Optional parent modal system to use
 * @returns Function to open the modal
 *
 * @example
 * ```tsx
 * const openModal = useRemoveModal(
 *   "One Piece",
 *   async (shouldRemoveFiles) => {
 *     await handleMangaRemoval(id, shouldRemoveFiles);
 *   }
 * );
 *
 * // Later in your component:
 * <Button onClick={() => { void openModal(); }} color="red">
 *   Remove Manga
 * </Button>
 * ```
 */
export const useRemoveModal = (title: string, onRemove: (shouldRemoveFiles: boolean) => void, parentModals?: unknown): (() => void) => {
    // Use parentModals if provided, otherwise use the default modals
    const defaultModals = useModals();
    const modals = (parentModals || defaultModals) as typeof defaultModals;
    /**
     * Opens the removal confirmation modal with provided content
     * Modal is centered and prevents accidental closing
     */
    const openRemoveModal = (): void => {
        // Log which modal system we're using
        logger.info('Opening remove modal using', parentModals ? 'parent modals' : 'default modals');
        const id = modals.openModal({
            title: `Remove ${title}?`,
            centered: true,
            closeOnClickOutside: false, // Prevent accidental closing
            children: <RemoveModalContent title={title} onRemove={(shouldRemoveFiles) => { void onRemove(shouldRemoveFiles); }} onClose={() => modals.closeModal(id)}/>
        });
    };
    return openRemoveModal;
};
