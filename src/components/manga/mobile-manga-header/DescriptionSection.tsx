/**
 * DescriptionSection Component
 *
 * Displays the collapsible manga description section.
 *
 * Extracted from: MobileMangaHeader.tsx
 */

import React from 'react';

import { Group, Text, Paper, ActionIcon } from '@mantine/core';
import { IconChevronDown, IconInfoCircle } from '@tabler/icons-react';

import type { DescriptionSectionProps } from './types';

/**
 * Collapsible description section
 */
export function DescriptionSection({
  summary,
  showDescription,
  setShowDescription
}: DescriptionSectionProps): React.ReactElement | null {
  if (!summary) {
    return null;
  }

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconInfoCircle size={18} />
          <Text fw={500}>Description</Text>
        </Group>
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={() => setShowDescription(!showDescription)}
        >
          <IconChevronDown
            size={16}
            style={{
              transform: showDescription ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        </ActionIcon>
      </Group>
      <Text
        size="sm"
        c="dimmed"
        {...(!showDescription && { lineClamp: 3 })}
        style={{ whiteSpace: 'pre-wrap' }}
      >
        {summary}
      </Text>
    </Paper>
  );
}
