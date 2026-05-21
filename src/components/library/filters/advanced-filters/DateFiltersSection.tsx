import React from 'react';

import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';

type DateFilterKey = 'dateAddedFrom' | 'dateAddedTo' | 'lastReadFrom' | 'lastReadTo';

interface DateFiltersSectionProps {
  dateAddedFrom: Date | null | undefined;
  dateAddedTo: Date | null | undefined;
  lastReadFrom: Date | null | undefined;
  lastReadTo: Date | null | undefined;
  onUpdateFilter: (key: DateFilterKey, value: Date | null) => void;
}

export function DateFiltersSection({
  dateAddedFrom,
  dateAddedTo,
  lastReadFrom,
  lastReadTo,
  onUpdateFilter
}: DateFiltersSectionProps): React.ReactElement {
  return (
    <Box>
      <Group gap="xs" mb="xs">
        <IconCalendar size={16} />
        <Text size="sm" fw={500}>Date Filters</Text>
      </Group>
      <Paper p="sm" withBorder>
        <Stack gap="sm">
          <Group grow>
            <DateInput
              label="Added From"
              placeholder="Select date"
              value={dateAddedFrom ?? null}
              onChange={(date) => onUpdateFilter('dateAddedFrom', date as Date | null)}
              clearable
              size="sm"
            />
            <DateInput
              label="Added To"
              placeholder="Select date"
              value={dateAddedTo ?? null}
              onChange={(date) => onUpdateFilter('dateAddedTo', date as Date | null)}
              clearable
              size="sm"
            />
          </Group>
          <Group grow>
            <DateInput
              label="Last Read From"
              placeholder="Select date"
              value={lastReadFrom ?? null}
              onChange={(date) => onUpdateFilter('lastReadFrom', date as Date | null)}
              clearable
              size="sm"
            />
            <DateInput
              label="Last Read To"
              placeholder="Select date"
              value={lastReadTo ?? null}
              onChange={(date) => onUpdateFilter('lastReadTo', date)}
              clearable
              size="sm"
            />
          </Group>
        </Stack>
      </Paper>
    </Box>
  );
}
