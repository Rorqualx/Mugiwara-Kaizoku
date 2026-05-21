"use client";

/**
 * Button component for fixing out-of-sync manga chapters
 * 
 * This component provides a button interface for initiating the chapter
 * synchronization process. Features include:
 * - Confirmation modal
 * - Background processing
 * - Success/error notifications
 * - ID validation
 * 
 * @remarks
 * Process Flow:
 * - Shows confirmation modal before action
 * - Validates manga ID from router
 * - Triggers background sync process
 * - Displays status notifications
 * 
 * Error Handling:
 * - Validates manga ID presence
 * - Handles mutation errors
 * - Shows error notifications
 * 
 * Visual Features:
 * - Full-width button
 * - Hammer icon
 * - Default variant styling
 * - Modal confirmation
 */

import React from "react";

import { Button, Text } from "@mantine/core";
import { showNotification } from "@mantine/notifications";
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconHammer } from '@tabler/icons-react';
import { IconX } from '@tabler/icons-react';

import { useOutOfSyncChapterModal } from "./outOfSyncChapterModal";

export function FixOutOfSyncChaptersButton(): React.JSX.Element {

  /**
   * Mutation for fixing out-of-sync chapters
   * Handles success/error notifications and background processing
   */
  // TODO: Re-enable when fixOutOfSyncChapters API endpoint is implemented
  // const fixOutOfSyncChaptersMutation =
  //   trpc.manga?.fixOutOfSyncChapters.useMutation({
  //     onError: (error) => {
  //       showNotification({
  //         icon: <IconX size={18} />,
  //         color: "red",
  //         title: "Error: Fix Out of Sync Chapters",
  //         message: <Text>{(error instanceof Error ? error.message : String(error))}</Text>,
  //       });
  //     },
  //     onSuccess: () => {
  //       showNotification({
  //         icon: <IconCheck size={18} />,
  //         color: "teal",
  //         title: "Fix Out of Sync Chapters",
  //         message: (
  //           <Text>Started fixing out of sync chapters in the background.</Text>
  //         ),
  //       });
  //     },
  //   });

  /**
   * Handler for fixing out-of-sync chapters
   * Validates manga ID and triggers the mutation
   */
  const handleFixOutOfSyncChapters = (): void => {
    // TODO: Re-enable when fixOutOfSyncChapters API endpoint is implemented
    showNotification({
      icon: <IconX size={18} />,
      color: "orange",
      title: "Feature Not Available",
      message: <Text>Fix out of sync chapters feature is temporarily disabled.</Text>,
    });
    return;
    
    // const mangaId = id ? parseInt(id, 10) : null;
    // if (!mangaId) {
    //   showNotification({
    //     icon: <IconX size={18} />,
    //     color: "red",
    //     title: "Error: Missing Manga ID",
    //     message: <Text>Invalid or missing manga ID for fixing chapters.</Text>,
    //   });
    //   return;
    // }
    // await fixOutOfSyncChaptersMutation.mutateAsync({ id: mangaId });
  };

  /**
   * Modal hook for confirmation dialog
   * Shows warning message and requires confirmation before proceeding
   */
  const outOfSyncChapterModal = useOutOfSyncChapterModal(
    "Fix out of sync chapters?",
    "This will remove all chapters marked as out of sync and download the new ones.",
    handleFixOutOfSyncChapters
  );

  return (
    <Button
      onClick={outOfSyncChapterModal}
      variant="default"
      leftSection={<IconHammer size={18} strokeWidth={2} />}
      fullWidth
    >
      Fix out of sync chapters
    </Button>
  );
}
