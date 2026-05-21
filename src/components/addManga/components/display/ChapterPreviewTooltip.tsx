/**
 * ChapterPreviewTooltip Component
 * 
 * Displays a preview tooltip on hover for chapters, showing summary and cover image
 */

import React, { useState } from 'react';

import {
  Tooltip,
  Box,
  Text,
  Image,
  Stack,
  Group,
  Badge,
  Paper,
  Loader,
  Center
} from '@mantine/core';
import { IconCalendar, IconBook, IconFileText } from '@tabler/icons-react';

import type { ChapterData } from '@/components/addManga/types';

interface ChapterPreviewTooltipProps {
  /** Chapter data to preview */
  chapter: ChapterData;
  /** Children to wrap with tooltip */
  children: React.ReactNode;
  /** Whether to show the tooltip */
  enabled?: boolean;
  /** Maximum width of tooltip */
  maxWidth?: number;
  /** Position of tooltip */
  position?: 'top' | 'bottom' | 'left' | 'right';
}

// eslint-disable-next-line complexity -- Complex UI component with multiple conditional renders
export const ChapterPreviewTooltip: React.FC<ChapterPreviewTooltipProps> = ({
  chapter,
  children,
  enabled = true,
  maxWidth = 400,
  position = 'top'
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  // If no preview data available, just return children
  if (!enabled || (!chapter.summary && !chapter.coverImage && !chapter.coverUrl)) {
    return <>{children}</>;
  }
  
  // Use coverImage if available, otherwise fall back to coverUrl
  const imageUrl = chapter.coverImage ?? chapter.coverUrl;

  const tooltipContent = (
    <Paper p="sm" style={{ maxWidth }}>
      <Stack gap="xs">
        {/* Chapter header */}
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <IconFileText size={16} />
            <Text fw={600} size="sm">
              Chapter {chapter.chapterNumber}
            </Text>
          </Group>
          {chapter.arc && (
            <Badge size="xs" variant="light" color="blue">
              {chapter.arc}
            </Badge>
          )}
        </Group>

        {/* Chapter title */}
        {chapter["title"] && (
          <Text size="sm" fw={500}>
            {chapter["title"]}
          </Text>
        )}

        {/* Cover image */}
        {imageUrl && !imageError && (
          <Box style={{ position: 'relative', width: '100%', minHeight: 150 }}>
            {imageLoading && (
              <Center style={{ position: 'absolute', inset: 0 }}>
                <Loader size="sm" />
              </Center>
            )}
            <Image
              src={imageUrl}
              alt={`Chapter ${chapter.chapterNumber} cover`}
              radius="sm"
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
              style={{ 
                display: imageLoading ? 'none' : 'block',
                maxHeight: 200,
                objectFit: 'contain'
              }}
            />
          </Box>
        )}

        {/* Summary */}
        {chapter.summary && (
          <Box>
            <Text size="xs" fw={500} mb={4}>
              Summary
            </Text>
            <Text size="xs" c="dimmed" lineClamp={4}>
              {chapter.summary}
            </Text>
          </Box>
        )}

        {/* Metadata */}
        <Group gap="md">
          {chapter.volumeNumber && (
            <Group gap={4}>
              <IconBook size={14} style={{ opacity: 0.6 }} />
              <Text size="xs" c="dimmed">
                Volume {chapter.volumeNumber}
              </Text>
            </Group>
          )}
          {chapter.releaseDate && (
            <Group gap={4}>
              <IconCalendar size={14} style={{ opacity: 0.6 }} />
              <Text size="xs" c="dimmed">
                {new Date(chapter.releaseDate).toLocaleDateString()}
              </Text>
            </Group>
          )}
          {(chapter.pages ?? chapter.pageCount) && (
            <Text size="xs" c="dimmed">
              {chapter.pages ?? chapter.pageCount} pages
            </Text>
          )}
        </Group>
      </Stack>
    </Paper>
  );

  return (
    <Tooltip
      label={tooltipContent}
      position={position}
      withArrow
      multiline
      transitionProps={{ transition: 'fade', duration: 200 }}
      events={{ hover: true, focus: true, touch: true }}
    >
      {children}
    </Tooltip>
  );
};

export default ChapterPreviewTooltip;