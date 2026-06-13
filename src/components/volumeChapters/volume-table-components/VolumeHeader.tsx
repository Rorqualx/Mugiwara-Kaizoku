/**
 * VolumeHeader Component
 *
 * Header section for a volume with expansion toggle, title, badges, and action buttons.
 *
 * @module components/volumeChapters/volume-table-components/VolumeHeader
 */

import { memo } from 'react';

import { ActionIcon, Badge, Box, Group, Text, Title } from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import { IconAlertTriangle, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import prettyBytes from 'pretty-bytes';

import classes from '@/components/chaptersTable.module.css';
import { VolumeHeaderActions } from '@/components/volumeChapters/VolumeHeaderActions';

import type { VolumeHeaderProps } from './types';
import type { Chapter as ChapterEntity } from '@prisma/client';

const GROUP_WRAP_NONE = 'nowrap' as const;

/**
 * Inline hint shown on the right of the volume header (after the badges) when
 * every chapter in the volume is in ERROR. Orange icon + matching text color
 * mirror the per-volume Retry button so the eye connects the warning to the
 * action.
 */
function VolumeFailedHint({ chapters }: { chapters: ChapterEntity[] }): JSX.Element | null {
  const allFailed = chapters.length > 0 && chapters.every(c => c.downloadStatus === ChapterStatus.ERROR);
  if (!allFailed) return null;
  return (
    <Group gap={4} wrap={GROUP_WRAP_NONE}>
      <IconAlertTriangle size={14} color="var(--mantine-color-orange-4)" />
      <Text size="xs" fw={500} c="orange.4">
        All chapters failed — use Reset Failed Downloads
      </Text>
    </Group>
  );
}

/**
 * Volume header with expansion controls, title, and statistics badges
 */
export const VolumeHeader = memo(({
  volumeNumber,
  volumeTitle,
  chapterRange,
  chapters,
  volumePageCount,
  volumeSize,
  isExpanded,
  onToggleExpanded,
  onOpenVolumeModal,
  headerActionsProps
}: VolumeHeaderProps): JSX.Element => {
  const isUnassigned = volumeNumber === -1;
  const downloadedCount = chapters.filter(c => c.downloadStatus === ChapterStatus.COMPLETED).length;
  const isComplete = chapters.length > 0 && downloadedCount === chapters.length;

  return (
    <Box className={classes['volumeHeader']} style={{
      backgroundColor: isUnassigned ?
        'var(--mantine-color-dark-5)' :
        'var(--mantine-color-dark-6)',
      borderBottom: isExpanded ? '1px solid var(--mantine-color-dark-4)' : 'none',
      padding: '0.5rem 1rem',
      zIndex: 2,
      position: 'relative'
    }}>
      <Group style={{ cursor: 'pointer' }} onClick={onToggleExpanded}>
        <Group>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onToggleExpanded}
            aria-label={isExpanded ? "Collapse volume" : "Expand volume"}
            className={classes['actionIcon']}
          >
            {isExpanded ? <IconChevronUp size={18}/> : <IconChevronDown size={18}/>}
          </ActionIcon>
          <VolumeHeaderActions
            volumeNumber={headerActionsProps.volumeNumber}
            mangaId={headerActionsProps.mangaId}
            mangaTitle={headerActionsProps.mangaTitle}
            chapters={headerActionsProps.chapters}
            allVolumeMonitored={headerActionsProps.allVolumeMonitored}
            someVolumeMonitored={headerActionsProps.someVolumeMonitored}
            _noneVolumeMonitored={headerActionsProps.noneVolumeMonitored}
            totalVolumeChapters={headerActionsProps.totalVolumeChapters}
            volumeMonitoredCount={headerActionsProps.volumeMonitoredCount}
            isTogglingVolume={headerActionsProps.isTogglingVolume}
            isDownloadingVolume={headerActionsProps.isDownloadingVolume}
            onToggleMonitoring={headerActionsProps.onToggleMonitoring}
            onQuickDownload={headerActionsProps.onQuickDownload}
            onOpenReassignModal={headerActionsProps.onOpenReassignModal}
            {...(isUnassigned && headerActionsProps.onDeleteAllUnassigned ? { onDeleteAllUnassigned: headerActionsProps.onDeleteAllUnassigned } : {})}
            {...(headerActionsProps.isDeletingAll ? { isDeletingAll: true } : {})}
          />
          <Title
            order={4}
            {...(isUnassigned ? { c: "yellow" } : {})}
            style={{
              cursor: !isUnassigned ? 'pointer' : 'default',
              textDecoration: !isUnassigned ? 'underline' : 'none'
            }}
            onClick={(e) => {
              if (!isUnassigned) {
                e.stopPropagation();
                onOpenVolumeModal();
              }
            }}
          >
            {isUnassigned
              ? 'Unassigned Chapters & Volumes'
              : `Volume ${volumeNumber}${chapterRange ? ` (${chapterRange})` : ''}${volumeTitle ? ` - ${volumeTitle}` : ''}`}
          </Title>
        </Group>
        <Group gap="xs">
          <Badge color={isComplete ? 'green' : 'red'}>
            {downloadedCount}/{chapters.length} {isUnassigned ? 'Files' : 'Chapters'}
          </Badge>
          {volumePageCount > 0 &&
            <Badge color="blue">{volumePageCount} Pages</Badge>}
          <Badge color="grape">{prettyBytes(volumeSize)}</Badge>
          <VolumeFailedHint chapters={chapters} />
        </Group>
      </Group>
    </Box>
  );
});

VolumeHeader.displayName = 'VolumeHeader';
