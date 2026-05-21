/**
 * Release Schedule Display Component
 *
 * Displays the current release schedule in read-only mode.
 *
 * @module components/calendar/ReleaseScheduleOverride/ReleaseScheduleDisplay
 */

import { Card, Text, Group, Badge, ActionIcon, Tooltip, Stack, Alert, Box } from '@mantine/core';
import { ReleaseType } from '@prisma/client';
import { IconCalendar, IconEdit, IconCheck, IconInfoCircle, IconCalendarOff } from '@tabler/icons-react';


import type { ReleaseScheduleDisplayProps } from './types';

/**
 * Display component for showing current release schedule
 */
export function ReleaseScheduleDisplay({
  currentSchedule,
  onEdit,
  onConfirm,
  isPending,
  getScheduleDescription,
}: ReleaseScheduleDisplayProps): React.ReactElement {
  const metadata =
    typeof currentSchedule?.metadata === 'object' &&
    currentSchedule.metadata !== null &&
    !Array.isArray(currentSchedule.metadata)
      ? (currentSchedule.metadata as Record<string, unknown>)
      : {};

  const nextExpectedRelease = metadata['nextExpectedRelease'];

  return (
    <Card>
      <Stack>
        <Group justify="space-between">
          <Group>
            <Text fw={500}>Release Schedule</Text>
            {currentSchedule?.source && (
              <Badge size="xs" variant="light">
                {currentSchedule.source}
              </Badge>
            )}
            {currentSchedule?.isConfirmed && (
              <Badge size="xs" color="green" variant="light">
                Confirmed
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            {currentSchedule && !currentSchedule.isConfirmed && (
              <Tooltip label="Confirm this schedule is correct">
                <ActionIcon variant="subtle" onClick={onConfirm} color="green" loading={isPending}>
                  <IconCheck size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Edit schedule">
              <ActionIcon variant="subtle" onClick={onEdit}>
                <IconEdit size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {currentSchedule ? (
          <Box>
            <Text size="sm" c="dimmed">
              {getScheduleDescription()}
              {currentSchedule.timezone && currentSchedule.timezone !== 'UTC' && (
                <Text span size="xs" c="dimmed">
                  {' '}
                  ({currentSchedule.timezone})
                </Text>
              )}
            </Text>

            {currentSchedule.releaseType === ReleaseType.IRREGULAR && (
              <Alert icon={<IconCalendarOff />} color="orange" variant="light" mt="xs">
                <Text size="sm">Currently on hiatus</Text>
              </Alert>
            )}

            {typeof nextExpectedRelease === 'string' && currentSchedule.releaseType !== ReleaseType.IRREGULAR && (
              <Group mt="xs" gap="xs">
                <IconCalendar size={14} />
                <Text size="sm">
                  Next release expected: {new Date(nextExpectedRelease).toLocaleDateString()}
                </Text>
              </Group>
            )}

            {currentSchedule.confidence < 1 && (
              <Text size="xs" c="dimmed" mt="xs">
                Confidence: {Math.round(currentSchedule.confidence * 100)}%
              </Text>
            )}
          </Box>
        ) : (
          <Alert icon={<IconInfoCircle />} color="gray" variant="light">
            <Text size="sm">No release schedule set. Click edit to add one manually.</Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
