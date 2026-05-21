/**
 * Release Schedule Card Component
 *
 * Displays release schedule information for a manga.
 * Shows schedule type, next expected release, and allows manual override.
 *
 * @module components/manga/ReleaseScheduleCard
 */
import React, { useState } from 'react';

import { Card, Group, Text, RingProgress, Alert, Badge, Stack, Divider, ActionIcon, Tooltip } from '@mantine/core';
import { IconClock, IconCalendar, IconAlertCircle, IconSettings } from '@tabler/icons-react';
import { format, formatDistanceToNow} from 'date-fns';

import { ReleaseScheduleType } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { trpc } from '@/utils/trpc-client/index';

import { ManualScheduleOverrideForm, RemoveOverrideButton } from '../calendar/ManualScheduleOverrideForm';
interface ReleaseScheduleCardProps {
    mangaId: number | string;
    mangaTitle?: string;
    compact?: boolean;
    isLoading?: boolean;
}
/**
 * Displays release schedule information for a manga
 */
export function ReleaseScheduleCard({ mangaId, mangaTitle = 'this manga', compact = false, isLoading }: ReleaseScheduleCardProps): React.ReactElement {
    const [overrideModalOpened, setOverrideModalOpened] = useState(false);
    const { data: schedule, refetch } = trpc.calendar.getSchedule.useQuery({
        mangaId: toNumberId(mangaId)
    });
    if (isLoading) {
        return <Card withBorder>
        <Text size="sm" c="dimmed">Loading release schedule...</Text>
      </Card>;
    }
    if (!schedule) {
        return <Card withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <div>
              <Text fw={500}>Release Schedule</Text>
              <Text size="sm" c="dimmed">No schedule set</Text>
            </div>
            <Tooltip label="Set Schedule Manually">
              <ActionIcon onClick={() => setOverrideModalOpened(true)}>
                <IconSettings size={16}/>
              </ActionIcon>
            </Tooltip>
          </Group>
          <Alert icon={<IconAlertCircle size={16}/>} color="gray">
            No release schedule configured. Use manual override to set one.
          </Alert>
        </Stack>

        <ManualScheduleOverrideForm mangaId={toNumberId(mangaId)} mangaTitle={mangaTitle} opened={overrideModalOpened} onClose={() => setOverrideModalOpened(false)} onSuccess={() => { void refetch(); }}/>

      </Card>;
    }
    const getScheduleDescription = (): string => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        switch (schedule.releaseType) {
            case ReleaseScheduleType.WEEKLY:
                return `New chapters every ${days[schedule.dayOfWeek ?? 0]}`;
            case ReleaseScheduleType.BIWEEKLY:
                return `New chapters every two weeks on ${days[schedule.dayOfWeek ?? 0]}`;
            case ReleaseScheduleType.MONTHLY:
                { const dayOfMonth = schedule.dayOfMonth;
                if (dayOfMonth === 28) {
                    return 'New chapters at the end of each month';
                }
                return `New chapters around the ${getOrdinal(dayOfMonth ?? 1)} of each month`; }
            case ReleaseScheduleType.IRREGULAR:
                return 'Irregular release schedule';
            default:
                return 'Unknown release schedule';
        }
    };
    const getOrdinal = (day: number): string => {
        if (day > 3 && day < 21)
            return `${day}th`;
        switch (day % 10) {
            case 1:
                return `${day}st`;
            case 2:
                return `${day}nd`;
            case 3:
                return `${day}rd`;
            default:
                return `${day}th`;
        }
    };
    const getConfidenceColor = (confidence: number): string => {
        if (confidence >= 0.8)
            return 'green';
        if (confidence >= 0.6)
            return 'yellow';
        if (confidence >= 0.4)
            return 'orange';
        return 'red';
    };
    const getMetadataValue = (key: string): unknown => {
        return schedule["metadata"] ? (schedule["metadata"] as Record<string, unknown>)[key] : undefined;
    };

    const isValidDate = (value: unknown): value is string | Date => {
        if (typeof value === 'string' || value instanceof Date) {
            const date = new Date(value);
            return !isNaN(date.getTime());
        }
        return false;
    };
    if (compact) {
        return <Card withBorder p="sm">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <IconCalendar size={16}/>
            <Text size="sm">{getScheduleDescription()}</Text>
          </Group>
          <Badge color={getConfidenceColor(schedule.confidence)} variant="light" size="sm">

            {Math.round(schedule.confidence * 100)}%
          </Badge>
        </Group>
      </Card>;
    }
    return <Card withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <div>
            <Text fw={500}>Release Schedule</Text>
            <Text size="sm" c="dimmed">
              {getScheduleDescription()}
            </Text>
          </div>

          <Group gap="xs">
            {schedule.confidence > 0 && (
              <RingProgress sections={[{
                  value: schedule.confidence * 100,
                  color: getConfidenceColor(schedule.confidence)
              }]} label={<Text ta="center" size="xs" fw={500}>
                    {Math.round(schedule.confidence * 100)}%
                  </Text>} size={60} thickness={6}/>
            )}

            <Tooltip label="Manual Override">
              <ActionIcon onClick={() => setOverrideModalOpened(true)} variant="subtle">
                <IconSettings size={16}/>
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
        
        {(() => {
          const nextRelease = getMetadataValue('nextExpectedRelease');
          if (!isValidDate(nextRelease)) return null;

          return <>
            <Divider />
            <Alert icon={<IconClock size={16}/>} color="blue">
              <Text size="sm" fw={500}>Next Release Expected</Text>
              <Text size="xs">
                {format(new Date(nextRelease), 'EEEE, MMMM d, yyyy')}
                {' '}({formatDistanceToNow(new Date(nextRelease), {
                addSuffix: true
            })})
              </Text>
            </Alert>
          </>;
        })()}
        
        {(() => {
          const patternDescription = getMetadataValue('patternDescription');
          if (typeof patternDescription !== 'string') return null;

          const sampleSize = getMetadataValue('sampleSize');
          return <>
            <Divider />
            <div>
              <Text size="sm" fw={500} mb={4}>Pattern Details</Text>
              <Text size="xs" c="dimmed">
                {patternDescription}
              </Text>
              {typeof sampleSize === 'number' && <Text size="xs" c="dimmed" mt={4}>
                  Based on {sampleSize} releases
                </Text>}
            </div>
          </>;
        })()}
        
        <Group gap="xs" wrap="wrap">
          {schedule.isConfirmed && <Badge color="green" variant="light" size="sm">
              Confirmed
            </Badge>}
          {schedule["source"] && <Badge color={schedule["source"] === 'manual_override' ? 'blue' : 'gray'} variant="light" size="sm">

              {schedule["source"] === 'manual_override' ? 'Manual Override' : `Source: ${schedule["source"]}`}
            </Badge>}
          {schedule["source"] === 'manual_override' && <RemoveOverrideButton mangaId={toNumberId(mangaId)} onSuccess={() => { void refetch(); }}/>}
          {schedule.lastUpdated && <Badge color="gray" variant="light" size="sm">
            Updated {formatDistanceToNow(new Date(schedule.lastUpdated), {
            addSuffix: true
        })}
          </Badge>}
        </Group>
      </Stack>
      
      <ManualScheduleOverrideForm mangaId={toNumberId(mangaId)} mangaTitle={mangaTitle} opened={overrideModalOpened} onClose={() => setOverrideModalOpened(false)} onSuccess={() => { void refetch(); }}/>

    </Card>;
}
ReleaseScheduleCard.displayName = 'ReleaseScheduleCard';
