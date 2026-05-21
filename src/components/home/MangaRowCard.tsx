"use client";

/**
 * MangaRowCard component for Netflix-style horizontal scrolling rows
 *
 * This component provides a compact manga card optimized for horizontal layouts.
 * Features include:
 * - Smaller size than regular MangaCard (180px × 270px)
 * - Cover image with gradient overlay
 * - Title below card (truncated to 2 lines)
 * - Chapter count and status badge
 * - Hover effect with scale transform
 * - Responsive sizing (150px × 225px on mobile)
 *
 * @remarks
 * Visual Features:
 * - Background color: #424242 (matches existing cards)
 * - Border radius: 8px
 * - Hover: scale(1.05) with smooth transition
 * - Gradient overlay for better text readability
 *
 * Accessibility:
 * - Semantic HTML structure
 * - Keyboard navigation support
 * - ARIA labels for screen readers
 *
 * TypeScript:
 * - Uses domain types from @/types/search.types
 * - Strict null checking
 * - Proper type guards
 */

import * as React from "react";

import { Paper, Badge, Box, Text, Group } from '@mantine/core';
import { IconBook, IconBookmark } from '@tabler/icons-react';

import { getCoverUrl } from '@/utils/cover-url';
import { getMangaStatusColor } from '@/utils/home/status-color';

/**
 * Props for the MangaRowCard component
 */
export interface MangaRowCardProps {
  /** The manga data to display */
  manga: {
    id: number;
    title: string;
    anilistId?: number | null;
    metadata?: {
      cover?: string;
      coverMedium?: string;
      coverLarge?: string;
      coverExtraLarge?: string;
      status?: string;
      author?: string | null;
    } | null;
    _count?: {
      chapters: number;
    };
    inLibrary?: boolean;
  };
  /** Handler for card click */
  onClick?: () => void;
}

/**
 * Returns the best available cover URL from manga, routed through the image proxy
 *
 * @param manga - The manga object with metadata
 * @returns Proxied URL to the best available cover image
 */
function getBestCoverUrl(manga: MangaRowCardProps['manga']): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive programming for external usage
  if (!manga) return '/cover-not-found.jpg';

  return getCoverUrl(manga.metadata, manga.id);
}

/**
 * Compact manga card optimized for horizontal scrolling rows
 *
 * This component displays manga information in a compact format suitable
 * for Netflix-style horizontal scrolling. It includes cover image, title,
 * chapter count, and status badge.
 *
 * @param props - Component properties
 * @param props.manga - The manga data to display
 * @param props.onClick - Handler for card click
 * @returns A compact card component for horizontal rows
 *
 * @example
 * ```tsx
 * <MangaRowCard
 *   manga={mangaData}
 *   onClick={() => navigateToManga(mangaData.id)}
 * />
 * ```
 */
export function MangaRowCard({ manga, onClick }: MangaRowCardProps): React.ReactElement {
  const coverUrl = getBestCoverUrl(manga);
  const chapterCount = manga._count?.chapters ?? 0;
  const status = manga.metadata?.status;
  const statusColor = getMangaStatusColor(status);
  const inLibrary = manga.inLibrary === true;

  return (
    <Box
      style={{
        width: '100%',
        minWidth: '150px',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <Paper
        onClick={onClick}
        shadow="sm"
        radius="md"
        pos="relative"
        h={{ base: 225, md: 270 }}
        style={(theme) => ({
          width: '100%',
          backgroundColor: '#424242',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.3)), url(${coverUrl})`,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          overflow: 'hidden',

          // Hover effect
          '&:hover': onClick ? {
            transform: 'scale(1.05)',
            boxShadow: theme.shadows.lg,
            zIndex: 10,
          } : undefined,
        })}
      >
        {/* Badges at top */}
        <Box
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            right: '8px',
          }}
        >
          <Group gap="xs">
            {/* Chapter count */}
            {chapterCount > 0 && (
              <Badge
                size="xs"
                variant="filled"
                color="dark"
                leftSection={<IconBook size={12} />}
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {chapterCount}
              </Badge>
            )}

            {/* Status badge */}
            {status && (
              <Badge
                size="xs"
                variant="filled"
                color={statusColor}
                style={{
                  backgroundColor: `var(--mantine-color-${statusColor}-9)`,
                  backdropFilter: 'blur(4px)',
                }}
              >
                {status}
              </Badge>
            )}

            {/* In Library badge */}
            {inLibrary && (
              <Badge
                size="xs"
                variant="filled"
                color="grape"
                leftSection={<IconBookmark size={12} />}
                style={{
                  backgroundColor: 'var(--mantine-color-grape-7)',
                  backdropFilter: 'blur(4px)',
                }}
                aria-label="In library"
              >
                In Library
              </Badge>
            )}
          </Group>
        </Box>
      </Paper>

      {/* Title below card */}
      <Text
        ta="center"
        fw={500}
        size="sm"
        mt="xs"
        lineClamp={2}
        style={{
          maxWidth: '100%',
          wordBreak: 'break-word',
          hyphens: 'auto',
        }}
        c="white"
      >
        {manga.title}
      </Text>

      {/* Author name below title */}
      {manga.metadata?.author && (
        <Text
          ta="center"
          size="xs"
          c="dimmed"
          mt={4}
          lineClamp={1}
          style={{
            maxWidth: '100%',
            wordBreak: 'break-word',
          }}
        >
          {manga.metadata.author}
        </Text>
      )}
    </Box>
  );
}
