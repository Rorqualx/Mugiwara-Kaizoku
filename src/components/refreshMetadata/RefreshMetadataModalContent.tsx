/**
 * Refresh Metadata Modal Content Component
 *
 * This component renders the content of the modal dialog that prompts users
 * to confirm refreshing metadata for manga items. It displays an explanation
 * message and provides buttons for confirming or canceling the refresh action.
 *
 * @module components/refreshMetadata/RefreshMetadataModalContent
 */
import React from "react";

import { Box, Button, Text } from "@mantine/core";

/**
 * Props for the RefreshMetadataModalContent component
 *
 * @interface RefreshMetadataModalContentProps
 * @property {Function} onRefresh - Callback function to execute when the user confirms the refresh
 * @property {Function} onClose - Callback function to close the modal
 */
interface RefreshMetadataModalContentProps {
    onRefresh: () => void;
    onClose: () => void;
}
/**
 * Component that renders the content of the refresh metadata modal
 *
 * This component displays an explanation about metadata refreshing and provides
 * buttons for the user to confirm or cancel the refresh action.
 *
 * @param {RefreshMetadataModalContentProps} props - Component props
 * @returns {JSX.Element} The rendered modal content
 *
 * @example
 * ```tsx
 * <RefreshMetadataModalContent
 *   onRefresh={() => refreshMangaMetadata(mangaId)}
 *   onClose={() => closeModal()}
 * />
 * ```
 */
export function RefreshMetadataModalContent({ onRefresh, onClose, }: RefreshMetadataModalContentProps): React.ReactElement {
    return (<>
      <Text mb={4} size="sm">
        This will update all downloaded chapters with the latest metadata from AniList
      </Text>
      <Box style={{
            display: "flex",
            gap: "var(--mantine-spacing-xs)",
            justifyContent: "flex-end",
            marginTop: "var(--mantine-spacing-md)",
        }}>
        <Button variant="default" color="dark" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="filled" color="teal" onClick={() => {
            try {
                onRefresh();
                onClose();
            }
            catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
// Let the errorMessage bubble up but ensure onClose is still called
                onClose();
                throw new Error(errorMessage);
            }
        }}>
          Refresh
        </Button>
      </Box>
    </>);
}
