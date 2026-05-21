/**
 * Volume Details Drawer Component
 *
 * Full-screen drawer showing detailed volume information.
 * Displays all merged data from multiple providers with attribution.
 *
 * Features:
 * - Large cover image display
 * - Full description/summary (scrollable)
 * - Publication details (ISBN, publisher, release date, page count)
 * - Chapter range information
 * - Provider attribution for each field
 *
 * Architecture:
 * - utils/volume-data-extraction.ts - Data extraction utilities
 * - hooks/useVolumeFieldData.ts - Field data selection logic
 * - components/VolumeDetailRow.tsx - Detail row component
 *
 * Original: 561 lines -> Refactored: ~200 lines (64% reduction)
 */

import React, { useState } from 'react';

import {
  Drawer,
  Stack,
  Group,
  Text,
  Image,
  Divider,
  ScrollArea,
  Paper,
  Title,
  Box
} from '@mantine/core';
import {
  IconCalendar,
  IconBook,
  IconId,
  IconBuildingStore,
  IconFileText,
  IconList
} from '@tabler/icons-react';

import { useVolumeFieldData } from '../hooks';

import { ProviderAttributionBadge } from './ProviderAttributionBadge';
import { VolumeDetailRow } from './VolumeDetailRow';

// ============================================================================
// Types
// ============================================================================

/** Individual chapter details */
export interface ChapterDetails {
  number: number | string;
  title?: string | null;
  releaseDate?: string | null;
}

export interface VolumeDetails {
  number: number | string;
  title?: string | null;
  subtitle?: string | null;
  alternativeTitle?: string | null;
  description?: string | null;
  summary?: string | null;
  isbn?: string | null;
  isbn13?: string | null;
  publisher?: string | null;
  pageCount?: number | null;
  releaseDate?: string | null;
  coverImage?: string | null;
  chapterStart?: number | null;
  chapterEnd?: number | null;
  totalChapters?: number | null;
  chapters?: ChapterDetails[] | null;
  source?: string | null;
  sourceUrl?: string | null;
}

/**
 * Field-level source preferences for volume data
 */
export interface VolumeFieldSources {
  /** Source for volume cover images */
  volumeCover: string;
  /** Source for volume summary/description */
  volumeSummary: string;
  /** Source for volume title */
  volumeTitle: string;
  /** Source for chapter cover images */
  chapterCover: string;
  /** Source for chapter summary/description */
  chapterSummary: string;
  /** Source for chapter title */
  chapterTitle: string;
}

interface VolumeDetailsDrawerProps {
  /** Whether the drawer is open */
  opened: boolean;
  /** Callback to close the drawer */
  onClose: () => void;
  /** Volume data to display (from current display source) */
  volume: VolumeDetails | null;
  /** Whether to show provider attribution badges */
  showProviderBadges?: boolean | undefined;
  /** Field-level source preferences */
  volumeFieldSources?: VolumeFieldSources | undefined;
  /** Metadata from all selected sources */
  selectedSourcesMetadata?: Record<string, unknown> | undefined;
  /** Volume number for looking up in other sources */
  volumeNumber?: number | string | undefined;
  /** User-selected sources (only these should be searched) */
  selectedSources?: string[] | undefined;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Format date for display */
function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  } catch {
    // Return raw date if parsing fails
  }
  return dateStr;
}

// ============================================================================
// Main Component
// ============================================================================

// eslint-disable-next-line complexity -- Drawer component handles multiple field sources and display states
export const VolumeDetailsDrawer: React.FC<VolumeDetailsDrawerProps> = ({
  opened,
  onClose,
  volume,
  showProviderBadges = true,
  volumeFieldSources,
  selectedSourcesMetadata,
  volumeNumber,
  selectedSources = [],
}): JSX.Element => {
  const [imageError, setImageError] = useState(false);

  // Extract field data using custom hook
  const {
    coverImage,
    coverSource,
    description,
    summarySource,
    title,
    titleSource,
  } = useVolumeFieldData({
    volume,
    volumeFieldSources,
    selectedSourcesMetadata,
    volumeNumber,
    selectedSources,
  });

  if (!volume) {
    return (
      <Drawer opened={opened} onClose={onClose} title="Volume Details" position="right" size="md">
        <Text c="dimmed">No volume selected</Text>
      </Drawer>
    );
  }

  // Other fields come from the base volume (usually publication details)
  const {
    number,
    subtitle,
    alternativeTitle,
    isbn,
    isbn13,
    publisher,
    pageCount,
    releaseDate,
    chapterStart,
    chapterEnd,
    totalChapters,
    source,
    sourceUrl,
  } = volume;

  const displayTitle = title ?? `Volume ${String(number)}`;
  const displayDescription = description;
  const displayIsbn = isbn13 ?? isbn;
  const formattedDate = formatDate(releaseDate);

  const chapterRange = chapterStart !== null && chapterEnd !== null
    ? `${chapterStart} - ${chapterEnd}`
    : chapterStart !== null
      ? `From ${chapterStart}`
      : null;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Title order={4}>{displayTitle}</Title>
          {titleSource && showProviderBadges && (
            <ProviderAttributionBadge field="title" provider={titleSource} size="xs" />
          )}
        </Group>
      }
      position="right"
      size="lg"
      closeButtonProps={{ 'aria-label': 'Close volume details' }}
    >
      <ScrollArea h="calc(100vh - 120px)" offsetScrollbars>
        <Stack gap="md">
          {/* Cover Image */}
          {coverImage && !imageError && (
            <Box style={{ display: 'flex', justifyContent: 'center' }}>
              <Stack gap="xs" align="center">
                <Paper radius="md" style={{ overflow: 'hidden', maxWidth: 300 }}>
                  <Image
                    src={coverImage}
                    alt={displayTitle}
                    height={400}
                    fit="contain"
                    fallbackSrc="/cover-not-found.jpg"
                    onError={() => setImageError(true)}
                  />
                </Paper>
                {coverSource && showProviderBadges && (
                  <ProviderAttributionBadge field="cover" provider={coverSource} size="xs" />
                )}
              </Stack>
            </Box>
          )}

          {/* Title Section */}
          <Stack gap={4}>
            <Group gap="xs">
              <Text size="xl" fw={700}>Volume {String(number)}</Text>
            </Group>
            {title && !title.includes(`Volume ${String(number)}`) && (
              <Text size="lg" fw={500}>{title}</Text>
            )}
            {subtitle && (
              <Text size="md" c="dimmed">{subtitle}</Text>
            )}
            {alternativeTitle && (
              <Text size="sm" c="dimmed" fs="italic">{alternativeTitle}</Text>
            )}
          </Stack>

          <Divider />

          {/* Publication Details */}
          <Paper p="md" withBorder>
            <Stack gap="sm">
              <Text size="sm" fw={600} tt="uppercase" c="dimmed">Publication Details</Text>

              <VolumeDetailRow
                icon={<IconId size={16} />}
                label="ISBN"
                value={displayIsbn}
                source={source}
                showBadge={showProviderBadges}
                copyable
                monospace
              />

              <VolumeDetailRow
                icon={<IconBuildingStore size={16} />}
                label="Publisher"
                value={publisher}
                source={source}
                showBadge={showProviderBadges}
              />

              <VolumeDetailRow
                icon={<IconCalendar size={16} />}
                label="Release Date"
                value={formattedDate}
                source={source}
                showBadge={showProviderBadges}
              />

              <VolumeDetailRow
                icon={<IconFileText size={16} />}
                label="Pages"
                value={pageCount}
                source={source}
                showBadge={showProviderBadges}
              />
            </Stack>
          </Paper>

          {/* Chapter Information */}
          {(chapterRange ?? totalChapters) && (
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Text size="sm" fw={600} tt="uppercase" c="dimmed">Chapter Information</Text>

                <VolumeDetailRow
                  icon={<IconList size={16} />}
                  label="Chapter Range"
                  value={chapterRange}
                  source={source}
                  showBadge={showProviderBadges}
                />

                <VolumeDetailRow
                  icon={<IconBook size={16} />}
                  label="Total Chapters"
                  value={totalChapters}
                  source={source}
                  showBadge={showProviderBadges}
                />
              </Stack>
            </Paper>
          )}

          {/* Chapters List */}
          {volume.chapters && volume.chapters.length > 0 && (
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={600} tt="uppercase" c="dimmed">Chapters in this Volume</Text>
                  <Text size="xs" c="dimmed">{volume.chapters.length} chapters</Text>
                </Group>
                <Divider />
                <Stack gap="xs">
                  {volume.chapters.map((chapter, idx) => (
                    <Group key={`ch-${String(chapter.number)}-${idx}`} gap="sm" wrap="nowrap">
                      <Text size="sm" fw={600} c="blue" style={{ minWidth: 40, textAlign: 'right' }}>
                        {String(chapter.number)}
                      </Text>
                      <Text size="sm" style={{ flex: 1 }}>
                        {chapter.title ?? `Chapter ${String(chapter.number)}`}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          {/* Description */}
          {displayDescription && (
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={600} tt="uppercase" c="dimmed">Description</Text>
                  {showProviderBadges && summarySource && (
                    <ProviderAttributionBadge field="summary" provider={summarySource} size="xs" />
                  )}
                </Group>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {displayDescription}
                </Text>
              </Stack>
            </Paper>
          )}

          {/* Source Information */}
          {sourceUrl && (
            <Paper p="md" withBorder>
              <Stack gap="sm">
                <Text size="sm" fw={600} tt="uppercase" c="dimmed">Source</Text>
                <Text
                  size="xs"
                  c="blue"
                  component="a"
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ wordBreak: 'break-all' }}
                >
                  {sourceUrl}
                </Text>
              </Stack>
            </Paper>
          )}
        </Stack>
      </ScrollArea>
    </Drawer>
  );
};

export default VolumeDetailsDrawer;

// Re-export utility functions for backward compatibility
export { getVolumeFromSource, getStringField, PROVIDER_PRIORITY, findFieldInSelectedSources } from '../utils/volume-data-extraction';
