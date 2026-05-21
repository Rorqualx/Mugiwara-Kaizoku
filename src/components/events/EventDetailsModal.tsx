/**
 * Event Details Modal Component
 * 
 * This component displays detailed information about system events in a modal dialog.
 * It shows event metadata, details, related entities, error information, and provides
 * action buttons for event-specific operations.
 * 
 * @module components/events/EventDetailsModal
 */
import React from "react";

import { Modal, Group, Text, Badge, Button, Stack, Divider, Box, Code, ActionIcon, CopyButton, Tooltip, JsonInput } from '@mantine/core';
// @next/dynamic-imports
// The following imports are dynamically loaded for ESM compatibility
import { IconClockPlay } from '@tabler/icons-react';
import { IconInfoCircle } from '@tabler/icons-react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { IconCopy } from '@tabler/icons-react';
import { IconCheck as IconCopyCheck } from '@tabler/icons-react';

import { useNavigation } from '@/hooks/useNavigation';
import type { SystemEvent, EventAction } from '@/hooks/useSystemEvents';
import { toStringId } from '@/utils/id-converters';

/**
 * Props for the EventDetailsModal component
 * 
 * @interface EventDetailsModalProps
 * @property {SystemEvent | null} event - The event to display details for
 * @property {boolean} opened - Whether the modal is currently open
 * @property {Function} onClose - Callback function to close the modal
 * @property {Function} [onAction] - Optional callback for handling event actions
 */
interface EventDetailsModalProps {
  event: SystemEvent | null;
  opened: boolean;
  onClose: () => void;
  onAction?: (action: string, entityId?: number | string) => void;
}

/**
 * Modal component for displaying detailed information about system events
 * 
 * This component renders a modal dialog with comprehensive information about a system event,
 * including its type, message, timestamp, source, related entity, and any error details.
 * It also provides action buttons for event-specific operations.
 * 
 * @param {EventDetailsModalProps} props - Component props
 * @returns {JSX.Element|null} The modal component or null if no event is provided
 */
export function EventDetailsModal({
  event,
  opened,
  onClose,
  onAction
}: EventDetailsModalProps): JSX.Element | null {
  const { navigateTo } = useNavigation();
  if (!event) {
    return null;
  }

  /**
   * Returns the appropriate icon component based on event level
   * 
   * @param {string} level - The event level
   * @returns {JSX.Element} The icon component with appropriate color
   */
  const getEventIcon = (level: string): JSX.Element => {
    switch (level) {
      case 'info':
        return <IconInfoCircle size={20} color="var(--mantine-color-blue-6)" />;
      case 'warning':
        return <IconAlertTriangle size={20} color="var(--mantine-color-yellow-6)" />;
      case 'error':
      case 'critical':
        return <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />;
      case 'debug':
        return <IconInfoCircle size={20} color="var(--mantine-color-gray-6)" />;
      default:
        return <IconInfoCircle size={20} />;
    }
  };

  /**
   * Returns the appropriate color for event badges based on event level
   * 
   * @param {string} level - The event level
   * @returns {string} The color name for Mantine components
   */
  const getEventColor = (level: string): string => {
    switch (level) {
      case 'info':
        return 'blue';
      case 'warning':
        return 'yellow';
      case 'error':
      case 'critical':
        return 'red';
      case 'debug':
        return 'gray';
      default:
        return 'gray';
    }
  };

  /**
   * Handles event action button clicks
   * 
   * This function processes event actions, either navigating to a URL or
   * calling the onAction callback with the appropriate parameters.
   * 
   * @param {EventAction} action - The action object containing action type and parameters
   */
  const handleAction = (action: EventAction): void => {
    if (action.action === 'navigate' && action.url) {
      void navigateTo(action.url);
      onClose();
    } else if (onAction) {
      onAction(action.action, action.entityId);
      onClose();
    }
  };

  /**
   * Format timestamp for display
   */
  const formattedTimestamp = new Date(event.timestamp).toLocaleString();

  /**
   * Format event type for display
   */
  const formattedType = event.type.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

  /**
   * Get display information from event details
   */
  const getEntityInfo = (): { id: number | string; type: string; name: string } | null => {
    if (!event.relatedID || !event.relatedEntityType) return null;
    const entityDetails = event.details ?? {};
    const entityName = entityDetails["mangaTitle"] || entityDetails["chapterTitle"] || entityDetails["libraryName"] || entityDetails["jobType"] || `${event.relatedEntityType} ${event.relatedID}`;
    return {
      id: event.relatedID,
      type: event.relatedEntityType,
      name: String(entityName)
    };
  };
  const entityInfo = getEntityInfo();

  /**
   * Determine if the event is an error event
   */
  const isErrorEvent = event.level === 'error' || event.level === 'critical';

  /**
   * Get error details from event details
   */
  const errorDetails = isErrorEvent && event.details ? (event.details["error"] ?? '') + (event.details["stack"] ? '\n\n' + event.details["stack"] : '') : '';
  return <Modal opened={opened} onClose={onClose} title={<Group>
          {getEventIcon(event.level)}
          <Text fw={500}>Event Details</Text>
        </Group>} size="lg">
      <Stack>
        {/* Event header */}
        <Group justify="space-between">
          <Text fw={700} size="lg">{event.message}</Text>
          <Badge size="lg" color={getEventColor(event.level)}>
            {event.level.toUpperCase()}
          </Badge>
        </Group>

        {/* Event metadata */}
        <Group gap="xs">
          <IconClockPlay size={16} style={{
          opacity: 0.7
        }} />
          <Text size="sm" c="dimmed">{formattedTimestamp}</Text>
          <Badge variant="outline">{event["source"]}</Badge>
          <Badge variant="light">{formattedType}</Badge>
        </Group>

        <Divider />

        {/* Entity information */}
        {entityInfo && <Box>
            <Text fw={500} mb="xs">Related Entity</Text>
            <Group>
              <Text>{entityInfo.type ? String(entityInfo.type) : 'Entity'}: </Text>
              <Text fw={500}>{entityInfo["name"] ? String(entityInfo["name"]) : 'Unknown'}</Text>
              <Text c="dimmed">ID: {entityInfo["id"] ? toStringId(entityInfo["id"]) : 'n/a'}</Text>
            </Group>
          </Box>}

        {/* Event details */}
        {event.details && Object.keys(event.details).length > 0 && <Box>
            <Group justify="space-between">
              <Text fw={500} mb="xs">Details</Text>
              <CopyButton value={JSON.stringify(event.details, null, 2)} timeout={2000}>
                {({
              copied,
              copy
            }) => <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="top">
                    <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy}>
                      {copied ? <IconCopyCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>}
              </CopyButton>
            </Group>
            <JsonInput formatOnBlur autosize minRows={4} maxRows={12} readOnly value={JSON.stringify(event.details, null, 2)} style={{
          fontFamily: 'monospace'
        }} />
          </Box>}

        {/* Error details for error events */}
        {isErrorEvent && errorDetails && <Box>
            <Group justify="space-between">
              <Text fw={500} mb="xs" color="red">Error Details</Text>
              <CopyButton value={errorDetails} timeout={2000}>
                {({
              copied,
              copy
            }) => <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="top">
                    <ActionIcon color={copied ? 'teal' : 'gray'} onClick={copy}>
                      {copied ? <IconCopyCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>}
              </CopyButton>
            </Group>
            <Code block style={{
          whiteSpace: 'pre-wrap'
        }}>
              {errorDetails}
            </Code>
          </Box>}

        <Divider />

        {/* Actions */}
        {event.actions && event.actions.length > 0 && <Group justify="flex-end">
            {event.actions.map((action, index) => <Button key={index} variant="light" onClick={() => handleAction(action)}>
                {action.label}
              </Button>)}
          </Group>}
      </Stack>
    </Modal>;
}