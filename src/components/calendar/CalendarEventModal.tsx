/**
 * Calendar Event Modal Component
 * 
 * Modal dialog for displaying event details and allowing manual reschedule.
 * Shows detailed information about release events with confidence indicators.
 * 
 * @module components/calendar/CalendarEventModal
 */

import React, { useState } from 'react';

import { Modal, Stack, Group, Text, Button, Badge, Paper, Divider, ActionIcon, Menu, Alert, Progress } from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import { EventStatus } from '@prisma/client';
import { IconCalendar, IconClock, IconExternalLink, IconEdit, IconTrash, IconDots, IconAlertCircle, IconChartBar } from '@tabler/icons-react';
import { format } from 'date-fns';

import { useNavigation } from '@/hooks/useNavigation';
import { trpc } from '@/utils/trpc-client/index';


import type { CalendarEvent } from '@prisma/client';


/**
 * Calendar Event Modal Props
 */
interface CalendarEventModalProps {
  event: CalendarEvent | null;
  opened: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

/**
 * Get status color
 */
function getStatusColor(status: EventStatus): string {
  switch (status) {
    case EventStatus.CONFIRMED:
      return 'blue';
    case EventStatus.SCHEDULED:
      return 'violet';
    case EventStatus.DELAYED:
      return 'red';
    case EventStatus.RELEASED:
      return 'green';
    case EventStatus.CANCELLED:
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get confidence color
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'green';
  if (confidence >= 0.6) return 'yellow';
  return 'red';
}

/**
 * Calendar Event Modal Component
 */
// eslint-disable-next-line complexity -- Complex calendar event modal with multiple states and interactions
export function CalendarEventModal({
  event,
  opened,
  onClose,
  onUpdate
}: CalendarEventModalProps): React.ReactElement | null {
  const { navigateTo } = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const [newDate, setNewDate] = useState<Date | null>(null);
  const [newTime, setNewTime] = useState<string>('');

  // Mutations
  const updateMutation = trpc.calendar.updateEvent.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Event Updated',
        message: 'Release date has been updated',
        color: 'green'
      });
      setIsEditing(false);
      onUpdate?.();
      onClose();
    },
    onError: error => {
      showNotification({
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Failed to update event',
        color: 'red'
      });
    }
  });
  const deleteMutation = trpc.calendar.deleteEvent.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Event Deleted',
        message: 'Calendar event has been removed',
        color: 'green'
      });
      onUpdate?.();
      onClose();
    },
    onError: error => {
      showNotification({
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'Failed to delete event',
        color: 'red'
      });
    }
  });
  if (!event) return null;
  const eventDate = new Date(event.scheduledDate);
  const metadata = typeof event["metadata"] === 'object' && event["metadata"] !== null && !Array.isArray(event["metadata"]) ? event["metadata"] : {};
  const isManualOverride = metadata["isManualOverride"] === true;
  const patternType = typeof metadata["patternType"] === 'string' ? metadata["patternType"] : 'Unknown';

  // Handle reschedule
  const handleReschedule = (): void => {
    if (!newDate || !newTime) return;
    const timeParts = newTime.split(':').map(Number);
    const hours = timeParts[0];
    const minutes = timeParts[1];
    if (hours === undefined || minutes === undefined) return;
    const scheduledDate = new Date(newDate);
    scheduledDate.setHours(hours, minutes, 0, 0);
    void updateMutation.mutateAsync({
      eventId: event["id"],
      updates: {
        scheduledDate: scheduledDate,
        metadata: {
          ...(typeof event["metadata"] === 'object' && event["metadata"] !== null && !Array.isArray(event["metadata"]) ? event["metadata"] : {}),
          isManualOverride: true
        }
      }
    });
  };

  // Navigate to manga
  const navigateToMangaPage = (): void => {
    void navigateTo(`/manga/${event.mangaId}`);
    onClose();
  };
  return <Modal opened={opened} onClose={() => { void onClose(); }} title={<Group gap="xs">
          <IconCalendar size={20} />
          <Text fw={500}>Event Details</Text>
        </Group>} size="md">

      <Stack gap="md">
        {/* Event Title & Status */}
        <div>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="lg" fw={500}>{event["title"]}</Text>
              <Group gap="xs" mt="xs">
                <Badge color={getStatusColor(event["status"])} size="sm">
                  {event["status"]}
                </Badge>
                {isManualOverride && <Badge color="orange" size="sm" variant="dot">
                    Manual Override
                  </Badge>}
              </Group>
            </div>
            
            <Menu position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="subtle">
                  <IconDots size={16} />
                </ActionIcon>
              </Menu.Target>
              
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconExternalLink size={14} />} onClick={() => { void navigateToMangaPage(); }}>

                  View Manga
                </Menu.Item>
                {event["source"] && <Menu.Item leftSection={<IconExternalLink size={14} />} component="a" href={event["source"]} target="_blank">

                    View Source
                  </Menu.Item>}
                <Menu.Divider />
                <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => {
                setIsEditing(true);
                setNewDate(eventDate);
                setNewTime(format(eventDate, 'HH:mm'));
              }}>

                  Reschedule
                </Menu.Item>
                <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={() => { void deleteMutation.mutateAsync({
                eventId: event.id
              }); }}>

                  Delete Event
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </div>
        
        <Divider />
        
        {/* Date & Time */}
        <Paper p="sm" withBorder>
          <Group gap="md">
            <Group gap="xs">
              <IconCalendar size={18} color="var(--mantine-color-dimmed)" />
              <Text size="sm">{format(eventDate, 'MMMM d, yyyy')}</Text>
            </Group>
            <Group gap="xs">
              <IconClock size={18} color="var(--mantine-color-dimmed)" />
              <Text size="sm">{format(eventDate, 'h:mm a')}</Text>
            </Group>
          </Group>
        </Paper>
        
        {/* Confidence Score */}
        {(event.confidence ?? 0) < 1 && <React.Fragment>
            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>Prediction Confidence</Text>
                <Text size="sm" c={getConfidenceColor(event.confidence ?? 0)}>
                  {Math.round((event.confidence ?? 0) * 100)}%
                </Text>
              </Group>
              <Progress value={(event.confidence ?? 0) * 100} color={getConfidenceColor(event.confidence ?? 0)} size="md" />

              <Text size="xs" c="dimmed" mt="xs">
                Based on {patternType} release pattern
              </Text>
            </div>
            
            <Alert icon={<IconAlertCircle size={16} />} color="blue">
              <Text size="sm">
                This is a predicted release date based on historical patterns. 
                Actual release date may vary.
              </Text>
            </Alert>
          </React.Fragment>}
        
        {/* Description */}
        {event["description"] && <div>
            <Text size="sm" fw={500} mb="xs">Description</Text>
            <Text size="sm" c="dimmed">{event["description"]}</Text>
          </div>}
        
        {/* Pattern Info */}
        {event["metadata"] && <Paper p="sm" withBorder>
            <Group gap="xs" mb="xs">
              <IconChartBar size={18} />
              <Text size="sm" fw={500}>Pattern Information</Text>
            </Group>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Pattern Type:</Text>
                <Text size="sm">{patternType}</Text>
              </Group>
              {metadata["averageInterval"] && <Group justify="space-between">
                  <Text size="sm" c="dimmed">Average Interval:</Text>
                  <Text size="sm">{String(metadata["averageInterval"])} days</Text>
                </Group>}
              {metadata["lastAccuracyCheck"] && <Group justify="space-between">
                  <Text size="sm" c="dimmed">Last Verified:</Text>
                  <Text size="sm">
                    {format(new Date(metadata["lastAccuracyCheck"] as string), 'MMM d, yyyy')}
                  </Text>
                </Group>}
            </Stack>
          </Paper>}
        
        {/* Edit Mode */}
        {isEditing && <Paper p="md" withBorder>
            <Text size="sm" fw={500} mb="sm">Reschedule Event</Text>
            <Stack gap="sm">
              <DatePickerInput label="New Date" value={newDate} onChange={value => setNewDate(value ? new Date(value) : null)} clearable={false} />

              <TimeInput label="New Time" value={newTime} onChange={event => setNewTime(event.currentTarget.value)} />

              <Group justify="flex-end" mt="sm">
                <Button variant="default" size="sm" onClick={() => setIsEditing(false)}>

                  Cancel
                </Button>
                <Button size="sm" onClick={() => { void handleReschedule(); }} loading={updateMutation.isPending} disabled={!newDate || !newTime}>

                  Update
                </Button>
              </Group>
            </Stack>
          </Paper>}
        
        {/* Actions */}
        {!isEditing && <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => { void onClose(); }}>
              Close
            </Button>
            <Button leftSection={<IconExternalLink size={16} />} onClick={() => { void navigateToMangaPage(); }}>

              View Manga
            </Button>
          </Group>}
      </Stack>
    </Modal>;
}
CalendarEventModal.displayName = 'CalendarEventModal';