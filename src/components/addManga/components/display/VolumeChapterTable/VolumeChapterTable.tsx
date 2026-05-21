/**
 * VolumeChapterTable Component
 *
 * Displays volume and chapter data in an expandable table format with
 * support for cross-provider data mixing and provider badges.
 */

import React, { memo } from 'react';

import {
  Table,
  ScrollArea,
  Paper,
  Stack,
  Text,
} from '@mantine/core';

import type { VolumeData, ChapterData } from '@/components/addManga/types';

import { ChapterRow } from './ChapterRow';
import { TableActions } from './TableActions';
import { useVolumeChapterTable } from './useVolumeChapterTable';
import { VolumeChapterTableHeader } from './VolumeChapterTableHeader';
import { VolumeRow } from './VolumeRow';


interface VolumeChapterTableProps {
  /** Array of volume data */
  volumes: VolumeData[];
  /** Array of chapter data */
  chapters: ChapterData[];
  /** Provider for volume data */
  volumeProvider: string;
  /** Provider for chapter data */
  chapterProvider: string;
  /** Callback when a volume is selected */
  onVolumeSelect?: (volume: VolumeData) => void;
  /** Callback when a chapter is selected */
  onChapterSelect?: (chapter: ChapterData) => void;
  /** Whether rows are selectable */
  selectable?: boolean;
  /** Whether volumes are expandable to show chapters */
  expandable?: boolean;
  /** Whether to show provider badges */
  showProviderBadges?: boolean;
  /** Maximum height for scrollable area */
  maxHeight?: number;
  /** Initially expanded volume IDs */
  initialExpanded?: string[];
}

export const VolumeChapterTable = memo(function VolumeChapterTable({
  volumes,
  chapters,
  volumeProvider,
  chapterProvider,
  onVolumeSelect,
  onChapterSelect,
  selectable = false,
  expandable = true,
  showProviderBadges = true,
  maxHeight = 400,
  initialExpanded = [],
}: VolumeChapterTableProps): React.ReactElement {
  const {
    expandedVolumes,
    selectedVolumes,
    selectedChapters,
    chaptersByVolume,
    toggleVolume,
    handleVolumeSelect,
    handleChapterSelect,
    handleSelectAll,
    handleClearSelection,
    stats,
  } = useVolumeChapterTable({
    volumes,
    chapters,
    initialExpanded,
    onVolumeSelect,
    onChapterSelect,
  });

  // Render chapter rows for a volume
  const renderChapters = (volumeNumber: number): React.ReactNode => {
    const volumeChapters = chaptersByVolume.get(volumeNumber) ?? [];

    if (volumeChapters.length === 0) {
      return (
        <tr>
          <td colSpan={selectable ? 5 : 4}>
            <Text size="sm" c="dimmed" ta="center" py="xs">
              No chapters available for this volume
            </Text>
          </td>
        </tr>
      );
    }

    return volumeChapters.map((chapter) => (
      <ChapterRow
        key={chapter.id}
        chapter={chapter}
        selected={selectedChapters.has(chapter.id)}
        selectable={selectable}
        showProviderBadges={showProviderBadges}
        chapterProvider={chapterProvider}
        onSelect={handleChapterSelect}
        indented
      />
    ));
  };

  // Render volume row with optional expanded chapters
  const renderVolumeRow = (volume: VolumeData): React.ReactNode => {
    const isExpanded = expandedVolumes.has(volume.id);
    const volumeChapters = chaptersByVolume.get(volume.volumeNumber) ?? [];

    return (
      <React.Fragment key={volume.id}>
        <VolumeRow
          volume={volume}
          isExpanded={isExpanded}
          selected={selectedVolumes.has(volume.id)}
          selectable={selectable}
          expandable={expandable}
          showProviderBadges={showProviderBadges}
          volumeProvider={volumeProvider}
          chapterProvider={chapterProvider}
          volumeChapters={volumeChapters}
          onToggle={toggleVolume}
          onSelect={handleVolumeSelect}
        />
        {expandable && isExpanded && volumeChapters.length > 0 && renderChapters(volume.volumeNumber)}
      </React.Fragment>
    );
  };

  // Render standalone chapters (when no volumes exist)
  const renderStandaloneChapters = (): React.ReactNode => {
    if (chapters.length === 0) {
      return (
        <tr>
          <td colSpan={selectable ? 5 : 4}>
            <Text ta="center" c="dimmed" py="xl">
              No volume or chapter data available
            </Text>
          </td>
        </tr>
      );
    }

    return chapters.map((chapter) => (
      <ChapterRow
        key={chapter.id}
        chapter={chapter}
        selected={selectedChapters.has(chapter.id)}
        selectable={selectable}
        showProviderBadges={showProviderBadges}
        chapterProvider={chapterProvider}
        onSelect={handleChapterSelect}
      />
    ));
  };

  const hasData = volumes.length > 0 || chapters.length > 0;
  const hasSelection = stats.selectedVolumes > 0 || stats.selectedChapters > 0;

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        <VolumeChapterTableHeader
          stats={stats}
          volumeProvider={volumeProvider}
          chapterProvider={chapterProvider}
          showProviderBadges={showProviderBadges}
          selectable={selectable}
        />

        <ScrollArea style={{ height: maxHeight }} type="auto">
          <Table highlightOnHover>
            <thead>
              <tr>
                {selectable && <th style={{ width: 40 }}></th>}
                <th>Volume/Chapter</th>
                <th>Title</th>
                <th>Source</th>
                <th>Release Date</th>
              </tr>
            </thead>
            <tbody>
              {volumes.length > 0
                ? volumes.map((volume) => renderVolumeRow(volume))
                : renderStandaloneChapters()}
            </tbody>
          </Table>
        </ScrollArea>

        {selectable && (
          <TableActions
            hasData={hasData}
            hasSelection={hasSelection}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
          />
        )}
      </Stack>
    </Paper>
  );
});
