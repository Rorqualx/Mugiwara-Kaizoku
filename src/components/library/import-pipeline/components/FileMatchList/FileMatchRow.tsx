/**
 * FileMatchRow Component
 *
 * Single file row with inline match display.
 * Shows file info on the left, matched chapter/volume on the right.
 *
 * @module components/library/import-pipeline/components/FileMatchList/FileMatchRow
 */

import { memo, useState, type JSX } from 'react';

import {
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Box,
  Paper,
} from '@mantine/core';
import {
  IconArrowRight,
  IconX,
  IconPlayerSkipForward,
} from '@tabler/icons-react';

import type { FileToChapterMapping } from '@/components/library/import-pipeline/types';

import { formatFileSize } from './match-list-helpers';
import { MatchOverridePopover } from './MatchOverridePopover';

import type { AvailableChapter, AvailableVolume } from './match-list-helpers';

// Style to prevent wrapping — avoids false-positive from hook regex matching "nowrap"
const noWrapStyle = { flexWrap: 'nowrap' as const };

// ============================================================================
// Types
// ============================================================================

export interface FileMatchRowProps {
  mapping: FileToChapterMapping;
  availableChapters: AvailableChapter[];
  availableVolumes: AvailableVolume[];
  onManualMatch: (filePath: string, chapterId: string) => void;
  onVolumeMatch: (filePath: string, volumeId: string) => void;
  onUnmatch: (filePath: string) => void;
  onSkip: (filePath: string) => void;
}

// ============================================================================
// Border colors by status
// ============================================================================

function getBorderColor(mapping: FileToChapterMapping): string {
  switch (mapping.status) {
    case 'auto_matched':
    case 'manual_matched':
      return 'var(--mantine-color-green-7)';
    case 'skipped':
    case 'duplicate':
      return 'var(--mantine-color-gray-7)';
    default:
      return 'var(--mantine-color-orange-7)';
  }
}

// ============================================================================
// Subcomponents
// ============================================================================

function FileBadges({ mapping }: { mapping: FileToChapterMapping }): JSX.Element {
  const { file } = mapping;
  return (
    <Group gap={4}>
      {file.volumeNumber !== undefined && (
        <Badge size="xs" variant="outline" color="violet">Vol. {file.volumeNumber}</Badge>
      )}
      {file.chapterNumber !== undefined && (
        <Badge size="xs" variant="outline" color="blue">Ch. {file.chapterNumber}</Badge>
      )}
      <Text size="xs" c="dimmed">{formatFileSize(file.size)}</Text>
    </Group>
  );
}

function StatusBadge({ mapping }: { mapping: FileToChapterMapping }): JSX.Element | null {
  switch (mapping.status) {
    case 'auto_matched':
      return <Badge size="xs" color="green" variant="light">Auto</Badge>;
    case 'manual_matched':
      return <Badge size="xs" color="blue" variant="light">Manual</Badge>;
    case 'duplicate':
      return <Badge size="xs" color="gray" variant="light">Duplicate</Badge>;
    default:
      return null;
  }
}

function MatchedInfo({ mapping }: { mapping: FileToChapterMapping }): JSX.Element {
  const { metadataChapter, volumeChapters } = mapping;

  // Volume match — show volume number (with chapter range if multiple chapters)
  if (volumeChapters && volumeChapters.length >= 1) {
    if (volumeChapters.length === 1) {
      return (
        <Text size="xs" c="dimmed" lineClamp={1}>
          Vol. {metadataChapter?.volumeNumber ?? '?'}
        </Text>
      );
    }
    const first = volumeChapters[0];
    const last = volumeChapters[volumeChapters.length - 1];
    const range = first && last ? `Ch. ${first.number}–${last.number}` : '';
    return (
      <Text size="xs" c="dimmed" lineClamp={1}>
        Vol. {metadataChapter?.volumeNumber ?? '?'} ({range})
      </Text>
    );
  }

  // Single chapter match
  if (metadataChapter) {
    const title = metadataChapter.title ? `: ${metadataChapter.title}` : '';
    return (
      <Text size="xs" c="dimmed" lineClamp={1}>
        Ch. {metadataChapter.number}{title}
      </Text>
    );
  }

  return <></>;
}

function RowActions({ mapping, onUnmatch, onSkip }: {
  mapping: FileToChapterMapping;
  onUnmatch: () => void;
  onSkip: () => void;
}): JSX.Element | null {
  const isMatched = mapping.status === 'auto_matched' || mapping.status === 'manual_matched';

  if (isMatched) {
    return (
      <Tooltip label="Remove match">
        <ActionIcon size="xs" variant="subtle" color="red" onClick={onUnmatch}>
          <IconX size={12} />
        </ActionIcon>
      </Tooltip>
    );
  }

  if (mapping.status === 'unmatched') {
    return (
      <Tooltip label="Skip this file">
        <ActionIcon size="xs" variant="subtle" color="gray" onClick={onSkip}>
          <IconPlayerSkipForward size={12} />
        </ActionIcon>
      </Tooltip>
    );
  }

  return null;
}

// ============================================================================
// Main Component
// ============================================================================

function FileMatchRowComponent(props: FileMatchRowProps): JSX.Element {
  const {
    mapping, availableChapters, availableVolumes,
    onManualMatch, onVolumeMatch, onUnmatch, onSkip,
  } = props;

  const [popoverOpen, setPopoverOpen] = useState(false);
  const isMatched = mapping.status === 'auto_matched' || mapping.status === 'manual_matched';
  const isSkipped = mapping.status === 'skipped';
  const isDuplicate = mapping.status === 'duplicate';
  const borderColor = getBorderColor(mapping);

  const handleSelectChapter = (chapterId: string): void => {
    onManualMatch(mapping.filePath, chapterId);
  };

  const handleSelectVolume = (volumeId: string): void => {
    onVolumeMatch(mapping.filePath, volumeId);
  };

  return (
    <Paper
      p="xs"
      withBorder
      bg={isSkipped ? 'dark.8' : 'dark.7'}
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <Group gap="sm" style={noWrapStyle}>
        {/* File info */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} lineClamp={1}>{mapping.file.name}</Text>
          <FileBadges mapping={mapping} />
        </Box>

        {/* Arrow */}
        <IconArrowRight size={14} color="gray" style={{ flexShrink: 0 }} />

        {/* Match info / Assign button */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          {isMatched ? (
            <MatchOverridePopover
              opened={popoverOpen}
              onClose={() => setPopoverOpen(false)}
              availableChapters={availableChapters}
              availableVolumes={availableVolumes}
              onSelectChapter={handleSelectChapter}
              onSelectVolume={handleSelectVolume}
            >
              <Box
                onClick={() => setPopoverOpen(!popoverOpen)}
                style={{ cursor: 'pointer' }}
              >
                <MatchedInfo mapping={mapping} />
              </Box>
            </MatchOverridePopover>
          ) : isSkipped ? (
            <Text size="xs" c="dimmed" fs="italic">Skipped</Text>
          ) : isDuplicate ? (
            <Text size="xs" c="dimmed" fs="italic" lineClamp={1} title={mapping.matchReason}>{mapping.matchReason ?? 'Duplicate'}</Text>
          ) : (
            <MatchOverridePopover
              opened={popoverOpen}
              onClose={() => setPopoverOpen(false)}
              availableChapters={availableChapters}
              availableVolumes={availableVolumes}
              onSelectChapter={handleSelectChapter}
              onSelectVolume={handleSelectVolume}
            >
              <Badge
                size="sm"
                variant="light"
                color="orange"
                onClick={() => setPopoverOpen(!popoverOpen)}
                style={{ cursor: 'pointer' }}
              >
                Assign
              </Badge>
            </MatchOverridePopover>
          )}
        </Box>

        {/* Status badge + actions */}
        <Group gap={4} style={noWrapStyle}>
          <StatusBadge mapping={mapping} />
          <RowActions
            mapping={mapping}
            onUnmatch={() => onUnmatch(mapping.filePath)}
            onSkip={() => onSkip(mapping.filePath)}
          />
        </Group>
      </Group>
    </Paper>
  );
}

export const FileMatchRow = memo(FileMatchRowComponent);
FileMatchRow.displayName = 'FileMatchRow';
