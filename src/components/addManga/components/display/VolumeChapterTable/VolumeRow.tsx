/**
 * Individual volume row component for VolumeChapterTable
 */

import React from 'react';

import {
  Group,
  Text,
  Stack,
  Checkbox,
  ActionIcon,
  Tooltip,
  Badge,
} from '@mantine/core';
import {
  IconBook,
  IconChevronDown,
  IconChevronRight,
  IconCalendar,
} from '@tabler/icons-react';

import { ProviderBadge } from '@/components/addManga/components/core/ProviderBadge';
import type { VolumeData, ChapterData } from '@/components/addManga/types';



interface VolumeRowProps {
  volume: VolumeData;
  isExpanded: boolean;
  selected: boolean;
  selectable: boolean;
  expandable: boolean;
  showProviderBadges: boolean;
  volumeProvider: string;
  chapterProvider: string;
  volumeChapters: ChapterData[];
  onToggle: (volumeId: string) => void;
  onSelect: (volume: VolumeData, checked: boolean) => void;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export const VolumeRow = React.memo(function VolumeRow({
  volume,
  isExpanded,
  selected,
  selectable,
  expandable,
  showProviderBadges,
  volumeProvider,
  chapterProvider,
  volumeChapters,
  onToggle,
  onSelect,
}: VolumeRowProps): React.ReactElement {
  const hasChapters = volumeChapters.length > 0;

  return (
    <tr>
      {selectable && (
        <td style={{ width: 40 }}>
          <Checkbox
            checked={selected}
            onChange={(e) => onSelect(volume, e.currentTarget.checked)}
            size="sm"
          />
        </td>
      )}
      <td>
        <Group gap="xs">
          {expandable && hasChapters && (
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() => onToggle(volume.id)}
            >
              {isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            </ActionIcon>
          )}
          <IconBook size={16} style={{ opacity: 0.7 }} />
          <Text fw={500}>Volume {volume.volumeNumber}</Text>
        </Group>
      </td>
      <td>
        <Stack gap={2}>
          <Text size="sm">{volume.title ?? `Volume ${volume.volumeNumber}`}</Text>
          {volume.isbn && (
            <Text size="xs" c="dimmed">ISBN: {volume.isbn}</Text>
          )}
        </Stack>
      </td>
      <td>
        {showProviderBadges && (
          <Group gap="xs">
            <ProviderBadge provider={volumeProvider} size="xs" />
            {hasChapters && (
              <Tooltip label={`Contains ${volumeChapters.length} chapters from ${chapterProvider}`}>
                <Badge size="xs" variant="outline" color="gray">
                  {volumeChapters.length} ch
                </Badge>
              </Tooltip>
            )}
          </Group>
        )}
      </td>
      <td>
        <Group gap={4}>
          <IconCalendar size={14} style={{ opacity: 0.6 }} />
          <Text size="xs" c="dimmed">
            {formatDate(volume.releaseDate)}
          </Text>
        </Group>
      </td>
    </tr>
  );
});
