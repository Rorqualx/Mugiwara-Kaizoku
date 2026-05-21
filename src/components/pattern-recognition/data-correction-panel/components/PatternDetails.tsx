/**
 * Pattern details collapsible section
 */
import React from 'react';

import { Paper, Group, Text, Collapse, Stack, Badge } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

import type { PatternDetailsProps } from '../types';

export const PatternDetails: React.FC<PatternDetailsProps> = ({
  patternsUsed,
  url,
  showPatternDetails,
  onTogglePatternDetails,
}): JSX.Element | null => {
  if (patternsUsed.length === 0) {
    return null;
  }

  return (
    <Paper p="md" mt="md" withBorder>
      <Group
        justify="apart"
        onClick={onTogglePatternDetails}
        style={{ cursor: 'pointer' }}
      >
        <Text fw={500}>Pattern Details</Text>
        <IconChevronDown
          style={{
            transform: showPatternDetails ? 'rotate(180deg)' : 'none',
            transition: 'transform 200ms',
          }}
        />
      </Group>
      <Collapse in={showPatternDetails}>
        <Stack gap="xs" mt="md">
          {patternsUsed.map((patternId, index) => (
            <Badge key={index} variant="dot">
              Pattern: {patternId}
            </Badge>
          ))}
          <Text size="xs" color="dimmed">
            URL: {url}
          </Text>
        </Stack>
      </Collapse>
    </Paper>
  );
};
