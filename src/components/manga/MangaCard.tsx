"use client";

/**
 * MangaCard component for displaying manga information in a card format
 * 
 * This component provides a visual card representation of a manga with
 * interactive features. Features include:
 * - Cover image display with gradient overlay
 * - Source badge with dynamic coloring
 * - Edit button with modal integration
 * - Click handling for navigation
 * - Title truncation
 * 
 * @remarks
 * Visual Features:
 * - Dynamic background with cover image
 * - Gradient overlay for text readability
 * - Source badge with contrast-based text color
 * - Hover effects and cursor feedback
 * - Truncated title display
 * 
 * Modal Integration:
 * - Remove manga confirmation
 * - Metadata refresh confirmation
 * - Update manga form
 * - File removal options
 * 
 * Accessibility:
 * - Interactive elements with clear focus states
 * - Semantic HTML structure
 * - Proper event propagation
 * - Color contrast compliance
 * 
 * TypeScript Migration:
 * - Updated to use domain types from @/types/domain
 * - Changed from legacy Metadata to standardized MangaMetadata
 * - Updated property access patterns (coverUrl instead of coverLarge/coverMedium/coverSmall)
 */

import * as React from "react";

import { Paper, Badge, Box, Text, ActionIcon, Group } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconEdit } from '@tabler/icons-react';
import { contrastColor } from 'contrast-color';
import stc from 'string-to-color';

import type { MangaWithRelations} from '@/types/search.types';
import { getCoverUrl } from '@/utils/cover-url';
import { extractAllFields, calculateCompleteness } from '@/utils/metadata-field-mapping';


import { useRefreshModal } from '../refreshMetadata';
import { useRemoveModal } from '../removeManga';
import { useUpdateModal } from '../updateManga';

import { MangaCover } from './MangaCover';

/**
 * Props for the MangaCard component
 */
interface MangaCardProps {
  /** The manga data to display */
  manga: MangaWithRelations;
  /** Handler for manga removal with option to remove files */
  onRemove: (shouldRemoveFiles: boolean) => void;
  /** Handler for manga updates */
  onUpdate: () => void;
  /** Handler for metadata refresh */
  onRefresh: () => void;
  /** Handler for card click */
  onClick: () => void;
}

/**
 * Returns the best available cover URL from manga, routed through the image proxy
 *
 * @param manga - The manga object (can include metadata)
 * @returns Proxied URL to the best available cover image
 */
function getBestCoverUrl(manga: MangaWithRelations | null): string {
  if (!manga) return '/cover-not-found.jpg';

  return getCoverUrl(manga.Metadata, manga.id);
}

/**
 * Displays a card representation of a manga with cover image and basic information
 * 
 * The card provides a visual representation of the manga with:
 * - Cover image as background with gradient overlay
 * - Source badge with dynamic coloring based on source name
 * - Edit button for manga management
 * - Truncated title display below the card
 * 
 * @param props - Component properties
 * @param props.manga - The manga data to display
 * @param props.onRemove - Handler for manga removal
 * @param props.onUpdate - Handler for manga updates
 * @param props.onRefresh - Handler for metadata refresh
 * @param props.onClick - Handler for card click
 * @returns A card component displaying manga information
 * 
 * @example
 * ```tsx
 * <MangaCard
 *   manga={mangaData}
 *   onRemove={(removeFiles) => handleRemove(mangaData["id"], removeFiles)}
 *   onUpdate={() => handleUpdate(mangaData["id"])}
 *   onRefresh={() => handleRefresh(mangaData["id"])}
 *   onClick={() => navigateToManga(mangaData["id"])}
 * />
 * ```
 */
export function MangaCard({ manga, onRemove, onUpdate, onRefresh, onClick }: MangaCardProps): React.ReactElement {
  const coverUrl = getBestCoverUrl(manga);
  
  // Calculate metadata completeness
  const metadata = extractAllFields(manga);
  const { percentage, quality } = calculateCompleteness(metadata);
  
  // Create the modal hooks with the correct handlers
  // These are prefixed with _ to indicate they're intentionally unused
  // but we need to initialize them to register the modal handlers
  const _removeModal = useRemoveModal(manga["title"], onRemove);
  const _refreshModal = useRefreshModal(manga["title"], onRefresh);
  
  // Initialize the update modal with manga data and handlers
  // Note: useUpdateModal may accept a broader type than MangaWithRelations
  const updateModal = useUpdateModal({
    manga: manga as MangaWithRelations,
    onUpdate,
    onRemove: (shouldRemoveFiles: boolean) => {
      // Call the onRemove function with the shouldRemoveFiles parameter
      onRemove(shouldRemoveFiles);
    },
  });

  return (
    <Box>
      <Paper
        onClick={onClick}
        shadow="lg"
        p="md"
        radius="md"
        pos="relative"
        h={300}
        w={200}
        style={{
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          backgroundColor: '#f0f0f0',
          overflow: 'hidden',
        }}
      >
        <MangaCover
          fill
          withOverlay
          src={coverUrl}
          alt={manga["title"]}
          seed={manga["id"]}
        />
        <Group justify="space-between" w="100%" mb="xs" pos="relative" style={{ zIndex: 1 }}>
          <Group gap="xs">
            <Badge 
              size="xs" 
              bg={stc(manga["source"])}
              c={contrastColor({ bgColor: stc(manga["source"]) })}
            >
              {manga["source"]}
            </Badge>
            {/* Metadata quality indicator */}
            <Badge
              size="xs"
              color={quality === 'high' ? 'green' : quality === 'medium' ? 'yellow' : 'red'}
              variant="light"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(2px)'
              }}
            >
              {percentage}%
            </Badge>
          </Group>
          <ActionIcon
            variant="light"
            color="gray"
            radius="xl"
            size="sm"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(2px)'
            }}
            onClick={(e) => {
              e.stopPropagation();
              updateModal();
            }}
          >
            <IconEdit size={14} />
          </ActionIcon>
        </Group>
      </Paper>
      
      {/* Series name below the card */}
      <Text ta="center" fw={500} mt="xs" lineClamp={2} style={{ maxWidth: 200 }}>
        {manga["title"]}
      </Text>
    </Box>
  );
}
