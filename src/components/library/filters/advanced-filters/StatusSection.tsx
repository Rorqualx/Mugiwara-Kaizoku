import React from 'react';

import { Box, Chip, Group, Paper, Stack, Text } from '@mantine/core';
import { IconActivity } from '@tabler/icons-react';

const PUBLICATION_STATUSES = [
  { value: 'ONGOING', label: 'Ongoing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'HIATUS', label: 'Hiatus' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'NOT_YET_PUBLISHED', label: 'Not Yet Published' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'UNKNOWN', label: 'Unknown' },
] as const;

const READING_STATUSES = [
  { value: 'has-chapters' as const, label: 'Has Chapters' },
  { value: 'has-downloaded' as const, label: 'Has Downloads' },
  { value: 'no-chapters' as const, label: 'No Chapters' },
  { value: 'fully-read' as const, label: 'Fully Read' },
  { value: 'partially-read' as const, label: 'In Progress' },
  { value: 'not-started' as const, label: 'Not Started' },
] as const;

type ReadingStatusValue = 'has-chapters' | 'no-chapters' | 'has-downloaded' | 'fully-read' | 'partially-read' | 'not-started';

const chipStyles = {
  label: {
    color: 'var(--app-text-primary)',
    backgroundColor: 'var(--app-card-background)',
    borderColor: 'var(--app-primary-color)',
  },
} as const;

interface StatusSectionProps {
  publicationStatus: string[];
  readingStatus: ReadingStatusValue[];
  monitored: boolean | null | undefined;
  onUpdatePublicationStatus: (value: string[]) => void;
  onUpdateReadingStatus: (value: ReadingStatusValue[]) => void;
  onUpdateMonitored: (value: boolean | null) => void;
}

export function StatusSection({
  publicationStatus,
  readingStatus,
  monitored,
  onUpdatePublicationStatus,
  onUpdateReadingStatus,
  onUpdateMonitored,
}: StatusSectionProps): React.ReactElement {
  return (
    <Box>
      <Group gap="xs" mb="xs">
        <IconActivity size={16} />
        <Text size="sm" fw={500}>Status & Progress</Text>
      </Group>
      <Paper p="sm" withBorder>
        <Stack gap="sm">
          <Text size="xs" fw={500}>Publication Status</Text>
          <Chip.Group multiple value={publicationStatus} onChange={onUpdatePublicationStatus}>
            <Group gap={6}>
              {PUBLICATION_STATUSES.map((s) => (
                <Chip key={s.value} value={s.value} size="xs" variant="outline" styles={chipStyles}>
                  {s.label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>

          <Text size="xs" fw={500} mt="xs">Reading Status</Text>
          <Chip.Group multiple value={readingStatus} onChange={(v) => onUpdateReadingStatus(v as ReadingStatusValue[])}>
            <Group gap={6}>
              {READING_STATUSES.map((s) => (
                <Chip key={s.value} value={s.value} size="xs" variant="outline" styles={chipStyles}>
                  {s.label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>

          <Text size="xs" fw={500} mt="xs">Monitoring</Text>
          <Chip.Group
            multiple={false}
            value={monitored === null || monitored === undefined ? 'any' : monitored ? 'yes' : 'no'}
            onChange={(v) => onUpdateMonitored(v === 'yes' ? true : v === 'no' ? false : null)}
          >
            <Group gap={6}>
              <Chip value="any" size="xs" variant="outline" styles={chipStyles}>Any</Chip>
              <Chip value="yes" size="xs" variant="outline" styles={chipStyles}>Monitored</Chip>
              <Chip value="no" size="xs" variant="outline" styles={chipStyles}>Not Monitored</Chip>
            </Group>
          </Chip.Group>
        </Stack>
      </Paper>
    </Box>
  );
}
