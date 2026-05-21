/**
 * Chapter Row Component
 *
 * Single chapter row in manual assignment table.
 * Allows user to assert if file is a chapter or volume.
 *
 * @module components/volumeChapters/chapter-reassign-modal/ChapterRow
 */

import { memo, type JSX } from 'react';

import {
  Paper,
  Group,
  Stack,
  Text,
  Checkbox,
  Select,
  ThemeIcon,
  SegmentedControl
} from '@mantine/core';
import { IconFileText, IconBook } from '@tabler/icons-react';

import type { VolumeOption, ChapterOption, FileType } from './types';
import type { Chapter } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface ChapterRowProps {
  chapter: Chapter;
  isSelected: boolean;
  linkedChapterId: number | undefined;
  fileType: FileType;
  assertedVolumeNumber: number | undefined;
  chapterOptions: ChapterOption[];
  volumeOptions: VolumeOption[];
  onToggleSelect: (id: number) => void;
  onChapterLinkChange: (chapterId: number, value: string | null) => void;
  onFileTypeChange: (chapterId: number, fileType: FileType) => void;
  onAssertedVolumeNumberChange: (chapterId: number, volumeNumber: number | null | undefined) => void;
}

// ============================================================================
// Component
// ============================================================================

function ChapterRowComponent(props: ChapterRowProps): JSX.Element {
  const {
    chapter,
    isSelected,
    linkedChapterId,
    fileType,
    assertedVolumeNumber,
    chapterOptions,
    volumeOptions,
    onToggleSelect,
    onChapterLinkChange,
    onFileTypeChange,
    onAssertedVolumeNumberChange
  } = props;

  const chapterNum = chapter.chapterNumber ?? chapter.index;

  // Determine if there's an assignment based on file type
  const hasAssignment = fileType === 'volume'
    ? assertedVolumeNumber !== undefined
    : linkedChapterId !== undefined;

  const borderColor = hasAssignment
    ? fileType === 'volume' ? 'var(--mantine-color-blue-7)' : 'var(--mantine-color-green-7)'
    : undefined;

  // Handle selection for both modes
  const handleSelect = (val: string | null): void => {
    if (fileType === 'chapter') {
      onChapterLinkChange(chapter.id, val);
    } else {
      // Volume mode - parse and set asserted volume number
      const volNum = val ? parseInt(val, 10) : undefined;
      onAssertedVolumeNumberChange(chapter.id, volNum);
    }
  };

  // Get current value for the select
  const selectValue = fileType === 'chapter'
    ? (linkedChapterId !== undefined ? String(linkedChapterId) : null)
    : (assertedVolumeNumber !== undefined ? String(assertedVolumeNumber) : null);

  // Use chapter options in chapter mode, volume options in volume mode
  const selectOptions = fileType === 'chapter'
    ? chapterOptions
    : volumeOptions.filter(opt => opt.value !== 'unassigned');

  return (
    <Paper
      p="sm"
      withBorder
      bg={isSelected ? 'dark.6' : 'dark.8'}
      style={{ borderColor }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        {/* Checkbox and file info */}
        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelect(chapter.id)}
            size="xs"
          />
          <ThemeIcon
            size="sm"
            color={fileType === 'volume' ? 'blue' : 'gray'}
            variant="light"
          >
            {fileType === 'volume' ? <IconBook size={14} /> : <IconFileText size={14} />}
          </ThemeIcon>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text size="sm" lineClamp={1}>{chapter.title}</Text>
            <Text size="xs" c="dimmed">
              {fileType === 'volume'
                ? `Vol.${assertedVolumeNumber ?? '?'} • ${chapter.fileName}`
                : `Ch.${chapterNum} • ${chapter.fileName}`}
            </Text>
          </Stack>
        </Group>

        {/* File type selector with clear labels */}
        <SegmentedControl
          size="xs"
          value={fileType}
          onChange={(val) => onFileTypeChange(chapter.id, val as FileType)}
          data={[
            { value: 'chapter', label: 'Chapter' },
            { value: 'volume', label: 'Volume' }
          ]}
          w={120}
        />

        {/* Selection dropdown - chapters in chapter mode, volumes in volume mode */}
        <Select
          size="xs"
          placeholder={fileType === 'chapter' ? 'Assign to chapter' : 'Assign to volume'}
          data={selectOptions}
          value={selectValue}
          onChange={handleSelect}
          w={150}
          clearable={fileType === 'chapter'}
          searchable
        />
      </Group>
    </Paper>
  );
}

export const ChapterRow = memo(ChapterRowComponent);
ChapterRow.displayName = 'ChapterRow';
