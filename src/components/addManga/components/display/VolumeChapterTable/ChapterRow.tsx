/**
 * Individual chapter row component for VolumeChapterTable
 */

import React from 'react';

import { Group, Text, Checkbox } from '@mantine/core';
import { IconFileText, IconCalendar } from '@tabler/icons-react';

import { ProviderBadge } from '@/components/addManga/components/core/ProviderBadge';
import type { ChapterData } from '@/components/addManga/types';

import { ChapterPreviewTooltip } from '../ChapterPreviewTooltip';


interface ChapterRowProps {
  chapter: ChapterData;
  selected: boolean;
  selectable: boolean;
  showProviderBadges: boolean;
  chapterProvider: string;
  onSelect: (chapter: ChapterData, checked: boolean) => void;
  indented?: boolean;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export const ChapterRow = React.memo(function ChapterRow({
  chapter,
  selected,
  selectable,
  showProviderBadges,
  chapterProvider,
  onSelect,
  indented = false,
}: ChapterRowProps): React.ReactElement {
  return (
    <tr style={indented ? { backgroundColor: 'var(--mantine-color-gray-0)' } : undefined}>
      {selectable && (
        <td style={{ width: 40 }}>
          <Checkbox
            checked={selected}
            onChange={(e) => onSelect(chapter, e.currentTarget.checked)}
            size="sm"
          />
        </td>
      )}
      <td style={indented ? { paddingLeft: 40 } : undefined}>
        <ChapterPreviewTooltip chapter={chapter}>
          <Group gap="xs" style={{ cursor: 'pointer' }}>
            <IconFileText size={16} style={{ opacity: 0.6 }} />
            <Text size="sm">
              Chapter {chapter.chapterNumber}
              {chapter.title && `: ${chapter.title}`}
            </Text>
          </Group>
        </ChapterPreviewTooltip>
      </td>
      <td>
        <ChapterPreviewTooltip chapter={chapter}>
          <Text size="sm" lineClamp={1} style={{ cursor: 'pointer' }}>
            {chapter.title ?? 'Untitled'}
          </Text>
        </ChapterPreviewTooltip>
      </td>
      <td>
        {showProviderBadges && (
          <ProviderBadge provider={chapterProvider} size="xs" variant="light" />
        )}
      </td>
      <td>
        <Group gap={4}>
          <IconCalendar size={14} style={{ opacity: 0.6 }} />
          <Text size="xs" c="dimmed">
            {formatDate(chapter.releaseDate)}
          </Text>
        </Group>
      </td>
    </tr>
  );
});
