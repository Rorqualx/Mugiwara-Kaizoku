"use client";
/**
 * Out of Sync Chapter Modal Content Component
 * 
 * This component renders the content of the modal dialog that notifies users
 * about out-of-sync chapters. It displays a customizable message and provides
 * buttons for confirming or canceling the synchronization action.
 * 
 * @module components/outOfSyncChapter/OutOfSyncChapterModalContent
 */

import React from "react";

import { Box, Button, Text } from "@mantine/core";

/**
 * Props for the OutOfSyncChapterModalContent component
 * 
 * @interface OutOfSyncChapterModalContentProps
 * @property {Function} onOk - Callback function to execute when the user confirms the action
 * @property {Function} onClose - Callback function to close the modal
 * @property {string} body - The message text explaining the out-of-sync issue
 */
interface OutOfSyncChapterModalContentProps {
  onOk: () => void;
  onClose: () => void;
  body: string;
}

/**
 * Component that renders the content of the out-of-sync chapter modal
 * 
 * This component displays a message about out-of-sync chapters and provides
 * buttons for the user to confirm or cancel the synchronization action.
 * 
 * @param {OutOfSyncChapterModalContentProps} props - Component props
 * @returns {JSX.Element} The rendered modal content
 * 
 * @example
 * ```tsx
 * <OutOfSyncChapterModalContent
 *   onOk={() => handleSync()}
 *   onClose={() => closeModal()}
 *   body="Chapters are out of sync with the source. Would you like to synchronize now?"
 * />
 * ```
 */
export function OutOfSyncChapterModalContent({
  onOk,
  onClose,
  body,
}: OutOfSyncChapterModalContentProps): React.ReactElement {
  return (
    <Box p="md">
      <Text mb={4} size="sm">
        {body}
      </Text>
      <Box
        display="flex"
        style={{
          gap: 'var(--mantine-spacing-xs)',
          justifyContent: 'flex-end',
          marginTop: 'var(--mantine-spacing-md)',
        }}
      >
        <Button 
          variant="default" 
          color="dark" 
          onClick={onClose}
          styles={{
            root: {
              transition: 'transform 150ms ease',
              '&:active': {
                transform: 'translateY(1px)',
              },
            },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="filled"
          color="teal"
          onClick={() => {
            onOk();
            onClose();
          }}
          styles={{
            root: {
              transition: 'transform 150ms ease',
              '&:active': {
                transform: 'translateY(1px)',
              },
            },
          }}
        >
          Ok
        </Button>
      </Box>
    </Box>
  );
}
