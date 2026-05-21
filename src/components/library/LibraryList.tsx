/**
 * Component for displaying a grid of library cards with add functionality
 *
 * This component renders a responsive grid of library cards, each representing
 * a manga library in the system. It includes an "Add Library" card and handles
 * library selection, editing, and deletion through modals.
 *
 * @remarks
 * Features:
 * - Responsive grid layout (1-4 columns based on screen size)
 * - Library card interactions (click, edit, delete)
 * - Add library functionality with modal
 * - Confirmation dialogs for destructive actions
 *
 * Grid Layout:
 * - Mobile (base): 1 column
 * - Small tablets (xs): 2 columns
 * - Tablets (sm): 3 columns
 * - Desktop (md+): 4 columns
 *
 * Modal Integration:
 * - Edit library modal for updating library details
 * - Add library modal for creating new libraries
 * - Confirmation modal for library deletion
 *
 * TypeScript Migration:
 * - Updated to use domain types from types/domain
 * - Changed from Library to LibraryWithRelations
 * - Improved type safety with standardized interfaces
 *
 * @example
 * ```tsx
 * // Basic usage in a library page
 * function LibraryPage() {
 *   const { data: libraries } = trpc.library?.list.useQuery();
 *   const handleRefresh = useCallback(() => {
 *     // Refresh library list
 *   }, []);
 *
 *   return (
 *     <Container>
 *       <LibraryList
 *         libraries={libraries ?? []}
 *         onRefresh={() => { void handleRefresh(); }}
 *       />
 *     </Container>
 *   );
 * }
 * ```
 */
import React, { useState } from "react";
import { useCallback, useMemo } from 'react';

import { Grid, Paper, Center, ActionIcon, Text } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { useModals } from '@mantine/modals';
import { IconPlus } from '@tabler/icons-react';

import { useNavigation } from '@/hooks/useNavigation';
import { useNotification } from '@/hooks/useNotification';
import { useLibraryStore } from '@/store/librarySlice';
import type { LibraryWithRelations } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { toStringId } from '@/utils/id-converters';
import { trpc } from '@/utils/trpc-client';

import { EditLibraryModal } from './EditLibraryModal';
import { LibraryActionModal } from './LibraryActionModal';
import { LibraryCard } from './LibraryCard';

/**
 * Styles for the Add Library card with hover effects
 */
const addLibraryCardStyles = {
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'center',
  alignItems: 'center',
  border: '2px dashed var(--mantine-color-gray-4)',
  backgroundColor: 'var(--mantine-color-gray-0)',
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: 'var(--mantine-shadow-md)',
  },
} as const;

/**
 * Props for the LibraryList component
 */
interface LibraryListProps {
    /** Array of library objects to display */
    libraries: LibraryWithRelations[];
    /** Callback to refresh the library list after changes */
    onRefresh: () => void;
}
export function LibraryList({ libraries = [], onRefresh }: LibraryListProps): React.ReactElement {
    const { navigateTo } = useNavigation();
    const modals = useModals();
    const { showSuccess, showError } = useNotification();
    const { selectLibrary } = useLibraryStore();
    const deleteMutation = trpc.library.delete.useMutation();

    // State for the new Library Action Modal
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    // Memoize handlers to prevent unnecessary re-renders
    const handleLibraryClick = useCallback((library: LibraryWithRelations) => {
        // Convert the ID to number for store operations
        selectLibrary(toNumberId(library["id"]));
        // Convert the ID to string for consistent URL formatting
        const libraryIdForUrl = toStringId(library["id"]);
        void navigateTo(`/library/${libraryIdForUrl}`);
    }, [selectLibrary, navigateTo]);
    const handleDeleteLibrary = useCallback((library: LibraryWithRelations): void => {
        modals.openConfirmModal({
            title: 'Delete Library',
            children: <Text size="sm">
          Are you sure you want to delete the library &quot;{library["name"]}&quot;? This will not delete the files on disk.
        </Text>,
            labels: {
                confirm: 'Delete',
                cancel: 'Cancel'
            },
            confirmProps: {
                color: 'red'
            },
            onConfirm: () => {
                void (async () => {
                    try {
                        await deleteMutation.mutateAsync({
                            id: toNumberId(library["id"])
                        });
                        showSuccess({
                            title: 'Library Deleted',
                            message: `Library "${library["name"]}" has been deleted.`
                        });
                        onRefresh();
                    }
                    catch (error: unknown) {
                        showError({
                            title: 'Deletion Failed',
                            message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Failed to delete library'
                        });
                    }
                })();
            }
        });
    }, [deleteMutation, modals, onRefresh, showError, showSuccess]);
    const handleEditLibrary = useCallback((library: LibraryWithRelations) => {
        const modalId = modals.openModal({
            title: 'Edit Library',
            children: <EditLibraryModal library={{
                    id: toNumberId(library["id"]),
                    name: library["name"],
                    path: library.path
                }} opened={true} onClose={() => {
                    modals.closeModal(modalId);
                    onRefresh();
                }}/>
        });
    }, [modals, onRefresh]);
    const handleOpenActionModal = useCallback(() => {
        setIsActionModalOpen(true);
    }, []);

    const handleCloseActionModal = useCallback(() => {
        setIsActionModalOpen(false);
    }, []);

    const handleActionModalSuccess = useCallback(() => {
        setIsActionModalOpen(false);
        onRefresh();
    }, [onRefresh]);
    return (
      <>
        <Grid gutter="xl">
          {/* Library Cards */}
          {useMemo(() => libraries.map(library => (
            <Grid.Col key={library["id"]} span={{
                base: 12,
                xs: 6,
                sm: 4,
                md: 3
            }}>
              <LibraryCard
                library={library}
                onClick={() => { void handleLibraryClick(library); }}
                onEdit={() => handleEditLibrary(library)}
                onDelete={() => { void handleDeleteLibrary(library); }}
              />
            </Grid.Col>
          )), [libraries, handleLibraryClick, handleEditLibrary, handleDeleteLibrary])}

          {/* Add Library Card */}
          <Grid.Col span={{
              base: 12,
              xs: 6,
              sm: 4,
              md: 3
          }}>
            <Paper
              shadow="lg"
              p="md"
              radius="md"
              h={200}
              w="100%"
              styles={{ root: addLibraryCardStyles }}
              onClick={handleOpenActionModal}
            >
              <Center>
                <ActionIcon variant="transparent" size="xl" color="blue">
                  <IconPlus size={50} stroke={1.5}/>
                </ActionIcon>
              </Center>
              <Text ta="center" fw={500} mt="md">
                Add Library
              </Text>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* Library Action Modal */}
        <LibraryActionModal
          opened={isActionModalOpen}
          onClose={handleCloseActionModal}
          onSuccess={handleActionModalSuccess}
        />
      </>
    );
}
