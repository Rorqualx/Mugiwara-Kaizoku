/**
 * Virtual Chapter List Component
 *
 * High-performance chapter list for manga with 1000+ chapters
 * Uses react-window for virtual scrolling to render only visible items
 *
 * @module components/manga/VirtualChapterList
 */

import React, { useCallback, useMemo } from 'react';

import { Box, Card, Group, Text, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { IconDownload, IconEye, IconClock } from '@tabler/icons-react';
import AutoSizer from 'react-virtualized-auto-sizer';
// @ts-expect-error - react-window types are incomplete
import { FixedSizeList } from 'react-window';

import type { Chapter } from '@prisma/client';

// Type-safe wrapper for FixedSizeList with proper component typing
type ListComponent = React.ComponentType<{
  height: number;
  width: number;
  itemCount: number;
  itemSize: number;
  overscanCount?: number;
  children: React.ComponentType<{ index: number; style: React.CSSProperties }>;
}>;

 
const List: ListComponent = FixedSizeList as ListComponent;

export interface VirtualChapterListProps {
  /** Array of chapters to display */
  chapters: Chapter[];
  /** Height of each chapter row in pixels (default: 60) */
  itemHeight?: number;
  /** Callback when download is requested */
  onDownload?: (chapterId: number) => void;
  /** Callback when chapter is clicked */
  onChapterClick?: (chapterId: number) => void;
  /** Out of sync chapter IDs */
  outOfSyncChapters?: (string | number)[];
  /** Whether the list is loading */
  isLoading?: boolean;
}

/**
 * Virtual scrolling chapter list for large manga
 */
export function VirtualChapterList({
  chapters,
  itemHeight = 60,
  onDownload,
  onChapterClick,
  outOfSyncChapters = []
}: VirtualChapterListProps): React.ReactElement {
  // Render individual chapter row
  const ChapterRow = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const chapter = chapters[index];
    if (!chapter) return null;

    const isOutOfSync = outOfSyncChapters.includes(chapter.id);
    const statusColor = chapter.downloadStatus === 'COMPLETED' ? 'green'
      : chapter.downloadStatus === 'DOWNLOADING' ? 'blue'
      : chapter.downloadStatus === 'ERROR' ? 'red'
      : 'yellow';
    const statusLabel = chapter.downloadStatus === 'COMPLETED' ? 'Available'
      : chapter.downloadStatus === 'DOWNLOADING' ? 'Downloading'
      : chapter.downloadStatus === 'ERROR' ? 'Error'
      : 'Missing';

    return (
      <div style={style}>
        <Card
          p="xs"
          m="xs"
          withBorder
          style={{ cursor: onChapterClick ? 'pointer' : 'default' }}
          onClick={() => onChapterClick?.(chapter.id)}
        >
          <Group justify="space-between">
            <Group gap="sm">
              {/* Chapter number badge */}
              <Badge variant="light" color="blue" size="lg">
                {chapter.volume ? `Vol ${chapter.volume}` : ''} Ch {chapter.index}
              </Badge>

              {/* Chapter title */}
              <div>
                <Text size="sm" fw={500}>{chapter.title}</Text>
                {chapter.releaseDate && (
                  <Group gap={4}>
                    <IconClock size={14} />
                    <Text size="xs" c="dimmed">
                      {new Date(chapter.releaseDate).toLocaleDateString()}
                    </Text>
                  </Group>
                )}
              </div>
            </Group>

            <Group gap="sm">
              {/* Status badge */}
              <Badge color={statusColor} variant="filled" size="sm">
                {statusLabel}
              </Badge>

              {/* Out of sync indicator */}
              {isOutOfSync && (
                <Badge color="orange" variant="dot">
                  Out of Sync
                </Badge>
              )}

              {/* Actions */}
              {onDownload && chapter.downloadStatus !== 'COMPLETED' && (
                <Tooltip label="Download chapter">
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(chapter.id);
                    }}
                  >
                    <IconDownload size={18} />
                  </ActionIcon>
                </Tooltip>
              )}

              {chapter.downloadStatus === 'COMPLETED' && (
                <Tooltip label="Read chapter">
                  <ActionIcon variant="light" color="green">
                    <IconEye size={18} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Group>
        </Card>
      </div>
    );
  }, [chapters, onChapterClick, onDownload, outOfSyncChapters]);

  // Calculate list height (max 600px)
  const listHeight = useMemo(
    () => Math.min(chapters.length * itemHeight, 600),
    [chapters.length, itemHeight]
  );

  if (chapters.length === 0) {
    return (
      <Card withBorder p="xl">
        <Text c="dimmed" ta="center">No chapters available</Text>
      </Card>
    );
  }

  return (
    <Box style={{ height: listHeight }}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            width={width}
            itemCount={chapters.length}
            itemSize={itemHeight}
            overscanCount={5}
          >
            {ChapterRow}
          </List>
        )}
      </AutoSizer>
    </Box>
  );
}

/**
 * Performance info component showing virtual scrolling benefits
 */
export function VirtualScrollingInfo({ chapterCount }: { chapterCount: number }): React.ReactElement {
  const renderedCount = Math.min(Math.ceil(600 / 60), chapterCount); // Visible rows
  const savedMemory = Math.round((chapterCount - renderedCount) * 0.5); // Rough estimate in KB

  return (
    <Card withBorder p="sm" bg="blue.0">
      <Group justify="space-between">
        <div>
          <Text size="sm" fw={500}>🚀 Virtual Scrolling Enabled</Text>
          <Text size="xs" c="dimmed">
            Rendering {renderedCount} of {chapterCount} chapters (~{savedMemory}KB memory saved)
          </Text>
        </div>
        <Badge color="blue" variant="filled">
          High Performance
        </Badge>
      </Group>
    </Card>
  );
}
