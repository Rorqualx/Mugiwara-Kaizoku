import React from 'react';

import { Box, Group, NumberInput, Paper, Text } from '@mantine/core';
import { IconList } from '@tabler/icons-react';

type ChapterCountKey = 'chaptersMin' | 'chaptersMax';

interface ChapterCountSectionProps {
  chaptersMin: number | null | undefined;
  chaptersMax: number | null | undefined;
  onUpdateFilter: (key: ChapterCountKey, value: number | null) => void;
}

export function ChapterCountSection({
  chaptersMin,
  chaptersMax,
  onUpdateFilter
}: ChapterCountSectionProps): React.ReactElement {
  return (
    <Box>
      <Group gap="xs" mb="xs">
        <IconList size={16} />
        <Text size="sm" fw={500}>Chapter Count</Text>
      </Group>
      <Paper p="sm" withBorder>
        <Group grow>
          <NumberInput
            label="Minimum Chapters"
            placeholder="0"
            value={chaptersMin ?? ''}
            onChange={(value) => onUpdateFilter('chaptersMin', typeof value === 'number' ? value : null)}
            min={0}
            size="sm"
          />
          <NumberInput
            label="Maximum Chapters"
            placeholder="No limit"
            value={chaptersMax ?? ''}
            onChange={(value) => onUpdateFilter('chaptersMax', typeof value === 'number' ? value : null)}
            min={0}
            size="sm"
          />
        </Group>
      </Paper>
    </Box>
  );
}
