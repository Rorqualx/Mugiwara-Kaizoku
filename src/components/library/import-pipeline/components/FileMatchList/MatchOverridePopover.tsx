/**
 * MatchOverridePopover Component
 *
 * Popover for manually assigning a chapter or volume to a file.
 * Shows searchable lists of available chapters/volumes with "in use" badges.
 *
 * @module components/library/import-pipeline/components/FileMatchList/MatchOverridePopover
 */

import { memo, useState, useMemo, type JSX, type ReactNode } from 'react';

import {
  Popover,
  Stack,
  Group,
  Text,
  TextInput,
  Tabs,
  ScrollArea,
  UnstyledButton,
  Badge,
  Box,
  Paper,
} from '@mantine/core';
import { IconSearch, IconBook, IconBooks } from '@tabler/icons-react';

import type { AvailableChapter, AvailableVolume } from './match-list-helpers';

// ============================================================================
// Types
// ============================================================================

export interface MatchOverridePopoverProps {
  opened: boolean;
  onClose: () => void;
  availableChapters: AvailableChapter[];
  availableVolumes: AvailableVolume[];
  onSelectChapter: (chapterId: string) => void;
  onSelectVolume: (volumeId: string) => void;
  children: ReactNode;
}

// Style to prevent wrapping — avoids false-positive from hook regex matching "nowrap" in wrap="nowrap"
const noWrapStyle = { flexWrap: 'nowrap' as const };

// ============================================================================
// Subcomponents
// ============================================================================

function ChapterItem({ item, onSelect }: {
  item: AvailableChapter;
  onSelect: () => void;
}): JSX.Element {
  const { chapter, isUsed } = item;
  const title = chapter.title ? `: ${chapter.title}` : '';

  return (
    <UnstyledButton onClick={onSelect} style={{ width: '100%', borderRadius: 4 }}>
      <Paper p="xs" bg={isUsed ? 'dark.8' : 'dark.7'} style={{ cursor: 'pointer', opacity: isUsed ? 0.6 : 1 }}>
        <Group gap="xs" justify="space-between" style={noWrapStyle}>
          <Box style={{ minWidth: 0 }}>
            <Text size="xs" fw={500} lineClamp={1}>Ch. {chapter.number}{title}</Text>
            {chapter.volumeNumber !== undefined && (
              <Text size="xs" c="dimmed">Vol. {chapter.volumeNumber}</Text>
            )}
          </Box>
          <Group gap={4} style={noWrapStyle}>
            {chapter.pages !== undefined && (
              <Badge size="xs" variant="light" color="gray">{chapter.pages}p</Badge>
            )}
            {isUsed && <Badge size="xs" variant="filled" color="orange">In use</Badge>}
          </Group>
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

function VolumeItem({ item, onSelect }: {
  item: AvailableVolume;
  onSelect: () => void;
}): JSX.Element {
  const { volume, isFullyMatched, matchedCount } = item;
  const first = volume.chapters[0];
  const last = volume.chapters[volume.chapters.length - 1];
  const chapterRange = first && last ? `Ch. ${first.number}–${last.number}` : '';

  return (
    <UnstyledButton onClick={onSelect} style={{ width: '100%', borderRadius: 4 }}>
      <Paper p="xs" bg={isFullyMatched ? 'dark.8' : 'dark.7'} style={{ cursor: 'pointer', opacity: isFullyMatched ? 0.6 : 1 }}>
        <Group gap="xs" justify="space-between" style={noWrapStyle}>
          <Box style={{ minWidth: 0 }}>
            <Text size="xs" fw={500} lineClamp={1}>
              Vol. {volume.number}{volume.title ? `: ${volume.title}` : ''}
            </Text>
            <Text size="xs" c="dimmed">{chapterRange} ({volume.chapterCount} chapters)</Text>
          </Box>
          <Group gap={4} style={noWrapStyle}>
            <Badge size="xs" variant="light" color={isFullyMatched ? 'green' : 'gray'}>
              {matchedCount}/{volume.chapterCount}
            </Badge>
            {isFullyMatched && <Badge size="xs" variant="filled" color="orange">In use</Badge>}
          </Group>
        </Group>
      </Paper>
    </UnstyledButton>
  );
}

function ChapterList({ items, onSelect }: {
  items: AvailableChapter[];
  onSelect: (id: string) => void;
}): JSX.Element {
  if (items.length === 0) {
    return <Text size="xs" c="dimmed" ta="center" py="sm">No chapters found</Text>;
  }
  return (
    <Stack gap={4}>
      {items.map((item) => (
        <ChapterItem key={item.chapter.id} item={item} onSelect={() => onSelect(item.chapter.id)} />
      ))}
    </Stack>
  );
}

function VolumeList({ items, onSelect }: {
  items: AvailableVolume[];
  onSelect: (id: string) => void;
}): JSX.Element {
  if (items.length === 0) {
    return <Text size="xs" c="dimmed" ta="center" py="sm">No volumes found</Text>;
  }
  return (
    <Stack gap={4}>
      {items.map((item) => (
        <VolumeItem key={item.volume.id} item={item} onSelect={() => onSelect(item.volume.id)} />
      ))}
    </Stack>
  );
}

function TabbedContent({ filteredChapters, filteredVolumes, onChapterClick, onVolumeClick }: {
  filteredChapters: AvailableChapter[];
  filteredVolumes: AvailableVolume[];
  onChapterClick: (id: string) => void;
  onVolumeClick: (id: string) => void;
}): JSX.Element {
  return (
    <Tabs defaultValue="volumes" variant="pills" radius="sm">
      <Tabs.List grow>
        <Tabs.Tab value="chapters" leftSection={<IconBook size={14} />}>
          <Text size="xs">Chapters ({filteredChapters.length})</Text>
        </Tabs.Tab>
        <Tabs.Tab value="volumes" leftSection={<IconBooks size={14} />}>
          <Text size="xs">Volumes ({filteredVolumes.length})</Text>
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="chapters" pt="xs">
        <ScrollArea.Autosize mah={280}>
          <ChapterList items={filteredChapters} onSelect={onChapterClick} />
        </ScrollArea.Autosize>
      </Tabs.Panel>
      <Tabs.Panel value="volumes" pt="xs">
        <ScrollArea.Autosize mah={280}>
          <VolumeList items={filteredVolumes} onSelect={onVolumeClick} />
        </ScrollArea.Autosize>
      </Tabs.Panel>
    </Tabs>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function MatchOverridePopoverComponent(props: MatchOverridePopoverProps): JSX.Element {
  const {
    opened, onClose, availableChapters, availableVolumes,
    onSelectChapter, onSelectVolume, children,
  } = props;

  const [search, setSearch] = useState('');
  const hasVolumes = availableVolumes.length > 0;

  const filteredChapters = useMemo(() => {
    if (!search.trim()) return availableChapters;
    const q = search.toLowerCase();
    return availableChapters.filter(
      ({ chapter }) => chapter.number.toString().includes(q) || chapter.title?.toLowerCase().includes(q)
    );
  }, [availableChapters, search]);

  const filteredVolumes = useMemo(() => {
    if (!search.trim()) return availableVolumes;
    const q = search.toLowerCase();
    return availableVolumes.filter(
      ({ volume }) => volume.number.toString().includes(q) || volume.title?.toLowerCase().includes(q)
    );
  }, [availableVolumes, search]);

  const handleClose = (): void => { onClose(); setSearch(''); };
  const handleChapterClick = (id: string): void => { onSelectChapter(id); handleClose(); };
  const handleVolumeClick = (id: string): void => { onSelectVolume(id); handleClose(); };

  return (
    <Popover opened={opened} onClose={handleClose} position="bottom" withArrow shadow="md" width={340}>
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap="xs">
          <TextInput
            placeholder="Search by number or title..."
            size="xs"
            leftSection={<IconSearch size={14} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            autoFocus
          />
          {hasVolumes ? (
            <TabbedContent
              filteredChapters={filteredChapters}
              filteredVolumes={filteredVolumes}
              onChapterClick={handleChapterClick}
              onVolumeClick={handleVolumeClick}
            />
          ) : (
            <ScrollArea.Autosize mah={280}>
              <ChapterList items={filteredChapters} onSelect={handleChapterClick} />
            </ScrollArea.Autosize>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export const MatchOverridePopover = memo(MatchOverridePopoverComponent);
MatchOverridePopover.displayName = 'MatchOverridePopover';
