import React from 'react';

import { Box, Group, NumberInput, Paper, Text } from '@mantine/core';
import { IconStar } from '@tabler/icons-react';

type RatingKey = 'ratingMin' | 'ratingMax';

interface RatingSectionProps {
  ratingMin: number | null | undefined;
  ratingMax: number | null | undefined;
  onUpdateFilter: (key: RatingKey, value: number | null) => void;
}

export function RatingSection({
  ratingMin,
  ratingMax,
  onUpdateFilter
}: RatingSectionProps): React.ReactElement {
  return (
    <Box>
      <Group gap="xs" mb="xs">
        <IconStar size={16} />
        <Text size="sm" fw={500}>Rating</Text>
      </Group>
      <Paper p="sm" withBorder>
        <Group grow>
          <NumberInput
            label="Minimum Rating"
            placeholder="0"
            value={ratingMin ?? ''}
            onChange={(value) => onUpdateFilter('ratingMin', typeof value === 'number' ? value : null)}
            min={0}
            max={100}
            step={5}
            size="sm"
          />
          <NumberInput
            label="Maximum Rating"
            placeholder="No limit"
            value={ratingMax ?? ''}
            onChange={(value) => onUpdateFilter('ratingMax', typeof value === 'number' ? value : null)}
            min={0}
            max={100}
            step={5}
            size="sm"
          />
        </Group>
      </Paper>
    </Box>
  );
}
