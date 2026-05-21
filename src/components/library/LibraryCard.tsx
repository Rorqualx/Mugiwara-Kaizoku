"use client";
/**
 * Component for displaying a library as an interactive card
 * 
 * This component renders a library as a card with folder icon, basic information,
 * and action buttons. It provides visual feedback for selection state and
 * handles click events with proper propagation control.
 * 
 * @remarks
 * Visual States:
 * - Default: White background with shadow
 * - Selected: Blue border and light blue background
 * - Hover: Increased shadow depth
 * 
 * Layout:
 * - Fixed height (200px) for consistent grid appearance
 * - Folder icon in header
 * - Library name in center
 * - Manga cover art preview when available
 * - Action buttons and manga count badge at bottom
 * - Library name repeated below card for clarity
 * 
 * Event Handling:
 * - Card click navigates to library
 * - Action buttons stop event propagation
 * - Edit and delete actions handled separately
 * 
 * TypeScript Migration:
 * - Updated to use domain types from @/types/domain
 * - Changed from Library to LibraryWithRelations
 * - Updated property access for manga covers (coverUrl instead of coverLarge)
 * 
 * @example
 * ```tsx
 * // Basic usage in a library grid
 * <LibraryCard
 *   library={{
 *     id: 1,
 *     name: "Manga Collection",
 *     mangas: [],
 *     mangaCount: 0,
 *     path: "/manga",
 *     createdAt: new Date(),
 *     updatedAt: new Date()
 *   }}
 *   onEdit={() => handleEdit(1)}
 *   onDelete={() => handleDelete(1)}
 *   onClick={() => handleSelect(1)}
 * />
 * ```
 */
import React from "react";

import { Paper, Badge, Text, Group, ActionIcon, Box, Image } from '@mantine/core';
import { IconEdit, IconTrash, IconFolder, IconPhoto } from '@tabler/icons-react';

import { useLibraryStore } from '@/store/librarySlice';
import type { LibraryWithRelations } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';

/**
 * Extended type to handle runtime cases where Manga relation may not be loaded
 * This accounts for data passed without eager loading the Manga relation
 */
type LibraryCardData = Omit<LibraryWithRelations, 'Manga'> & {
  Manga?: LibraryWithRelations['Manga'];
};

/**
 * Props for the LibraryCard component
 */
interface LibraryCardProps {
  /**
   * The library data to display
   * Includes name, ID, path, manga collection (optional), and mangaCount
   */
  library: LibraryCardData;
  /** 
   * Handler for library edit action
   * Called when edit button is clicked, with event propagation stopped
   */
  onEdit: () => void;
  /** 
   * Handler for library delete action
   * Called when delete button is clicked, with event propagation stopped
   */
  onDelete: () => void;
  /** 
   * Handler for card click
   * Called when the card itself is clicked (not the action buttons)
   */
  onClick: () => void;
}

/**
 * Displays a card representation of a library with folder icon and basic information
 * 
 * This component renders a library as a card with edit and delete actions.
 * It highlights the currently selected library with a blue border and background.
 * The card maintains a consistent height and provides visual feedback for
 * interaction states. If the library contains manga, a preview of the first manga's
 * cover art is displayed.
 * 
 * Visual Hierarchy:
 * 1. Header with folder icon
 * 2. Center content with manga cover preview and library name
 * 3. Footer with manga count badge and action buttons
 * 4. Library name below card for additional context
 * 
 * @param library - The library data to display
 * @param onEdit - Handler for library edit action
 * @param onDelete - Handler for library delete action
 * @param onClick - Handler for card click
 * @returns A Box component containing the library card and name label
 */
export function LibraryCard({ library, onEdit, onDelete, onClick }: LibraryCardProps): React.ReactElement {
  /** Get selected library ID from store for highlighting */
  const { selectedLibraryId } = useLibraryStore();
  /** Whether this card represents the currently selected library */
  const isSelected = selectedLibraryId === toNumberId(library["id"]);

  // Get the first manga with a cover for preview
  const mangaList = library.Manga ?? [];
  const hasManga = mangaList.length > 0;
  const firstMangaWithCover = hasManga ?
    mangaList.find(manga => {
      // Check for cover property in metadata if it's included
      return manga.Metadata && (manga.Metadata.cover || manga.Metadata.coverMedium || manga.Metadata.coverLarge);
    }) : undefined;

  // Extract cover URL if available - checking multiple cover properties
  const coverUrl = (firstMangaWithCover?.Metadata?.coverLarge ??
                   firstMangaWithCover?.Metadata?.coverMedium ??
                   firstMangaWithCover?.Metadata?.cover) ?? '';
  
  return (
    <Box>
      <Paper
        shadow="lg"
        p="md"
        radius="md"
        pos="relative"
        h={200}
        w="100%"
        style={{
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          border: isSelected ? '2px solid var(--mantine-color-blue-6)' : undefined,
          backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : 'var(--mantine-color-default)',
          overflow: 'hidden'
        }}
        onClick={onClick}
      >
        {/* Header with folder icon */}
        <Group justify="flex-start" align="flex-start" w="100%">
          <IconFolder size={32} color="var(--mantine-color-blue-6)" />
        </Group>
          
        {/* Center content with manga cover art or folder icon */}
        <Box style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          width: '100%',
          position: 'relative'
        }}>
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={`${library["name"]} preview`}
              height={100}
              fit="contain"
              style={{ opacity: 0.7 }}
            />
          ) : (
            <Group gap="sm" align="center">
              <IconFolder size={48} color="var(--mantine-color-gray-5)" />
              {!hasManga && <IconPhoto size={48} color="var(--mantine-color-gray-3)" />}
            </Group>
          )}
        </Box>

        {/* Footer with manga count and action buttons */}
        <Group w="100%" justify="space-between" mt="md">
          <Badge size="sm" color="blue">
            {mangaList.length} manga
          </Badge>
          
          <Group gap="xs">
            <ActionIcon 
              variant="filled" 
              color="gray" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click
                onEdit();
              }}
            >
              <IconEdit size={16} />
            </ActionIcon>
            <ActionIcon 
              variant="filled" 
              color="red" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click
                onDelete();
              }}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Paper>
      
      {/* Library name below the card */}
      <Text ta="center" fw={500} mt="xs">
        {library["name"]}
      </Text>
    </Box>
  );
}
