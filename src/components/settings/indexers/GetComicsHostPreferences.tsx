/**
 * GetComics Host Preferences Component
 *
 * Provides a drag-and-drop interface for ordering file host preferences.
 * Users can reorder hosts to prioritize their preferred download sources.
 *
 * @module components/settings/indexers/GetComicsHostPreferences
 */

import React, { useCallback } from 'react';

import {
  Paper,
  Text,
  Stack,
  Group,
  ActionIcon,
  Badge,
} from '@mantine/core';
import {
  IconMenu2,
  IconArrowUp,
  IconArrowDown,
} from '@tabler/icons-react';

/**
 * Host configuration with display info
 */
interface HostInfo {
  id: string;
  name: string;
  description: string;
  reliability: 'high' | 'medium' | 'low';
}

/**
 * Host metadata for display
 */
const HOST_INFO: Record<string, HostInfo> = {
  mediafire: {
    id: 'mediafire',
    name: 'MediaFire',
    description: 'Popular cloud storage with direct download links',
    reliability: 'high',
  },
  mega: {
    id: 'mega',
    name: 'MEGA',
    description: 'Encrypted cloud storage with high speed downloads',
    reliability: 'high',
  },
  direct: {
    id: 'direct',
    name: 'Direct',
    description: 'Direct download links from various sources',
    reliability: 'medium',
  },
  dropapk: {
    id: 'dropapk',
    name: 'DropAPK',
    description: 'File hosting service',
    reliability: 'medium',
  },
  userscloud: {
    id: 'userscloud',
    name: 'UsersCloud',
    description: 'File hosting with decent availability',
    reliability: 'low',
  },
  zippyshare: {
    id: 'zippyshare',
    name: 'Zippyshare',
    description: 'Free file hosting (may be discontinued)',
    reliability: 'low',
  },
};

/**
 * Get reliability color for badge
 */
function getReliabilityColor(reliability: 'high' | 'medium' | 'low'): string {
  switch (reliability) {
    case 'high':
      return 'green';
    case 'medium':
      return 'yellow';
    case 'low':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Props for host item
 */
interface HostItemProps {
  hostId: string;
  index: number;
  totalCount: number;
  disabled: boolean;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDragStart: (index: number) => (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (index: number) => (e: React.DragEvent<HTMLDivElement>) => void;
}

/**
 * Single host item component
 */
function HostItem({
  hostId,
  index,
  totalCount,
  disabled,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}: HostItemProps): React.ReactElement | null {
  const info = HOST_INFO[hostId];
  if (!info) return null;

  return (
    <Paper
      p="sm"
      withBorder
      draggable={!disabled}
      onDragStart={onDragStart(index)}
      onDragOver={onDragOver}
      onDrop={onDrop(index)}
      style={{ cursor: disabled ? 'default' : 'grab', opacity: disabled ? 0.5 : 1 }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ActionIcon variant="subtle" color="gray" size="sm" disabled={disabled}>
            <IconMenu2 size={16} />
          </ActionIcon>
          <Badge color="blue" variant="light" size="sm">{index + 1}</Badge>
          <Stack gap={2}>
            <Group gap="xs">
              <Text fw={500} size="sm">{info.name}</Text>
              <Badge color={getReliabilityColor(info.reliability)} variant="dot" size="xs">
                {info.reliability}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">{info.description}</Text>
          </Stack>
        </Group>
        <Group gap={4}>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => { onMoveUp(index); }}
            disabled={index === 0 || disabled}
          >
            <IconArrowUp size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => { onMoveDown(index); }}
            disabled={index === totalCount - 1 || disabled}
          >
            <IconArrowDown size={16} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
}

/**
 * Props for GetComicsHostPreferences
 */
export interface GetComicsHostPreferencesProps {
  hosts: string[];
  onChange: (hosts: string[]) => void;
  disabled?: boolean;
}

/**
 * GetComics Host Preferences Component
 */
export function GetComicsHostPreferences({
  hosts,
  onChange,
  disabled = false,
}: GetComicsHostPreferencesProps): React.ReactElement {
  const moveUp = useCallback((index: number): void => {
    if (index === 0 || disabled) return;
    const newHosts = [...hosts];
    [newHosts[index - 1], newHosts[index]] = [newHosts[index] ?? '', newHosts[index - 1] ?? ''];
    onChange(newHosts);
  }, [hosts, onChange, disabled]);

  const moveDown = useCallback((index: number): void => {
    if (index === hosts.length - 1 || disabled) return;
    const newHosts = [...hosts];
    [newHosts[index], newHosts[index + 1]] = [newHosts[index + 1] ?? '', newHosts[index] ?? ''];
    onChange(newHosts);
  }, [hosts, onChange, disabled]);

  const handleDragStart = useCallback((index: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    if (disabled) { e.preventDefault(); return; }
    // eslint-disable-next-line no-param-reassign -- Required for drag-and-drop API
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, [disabled]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    // eslint-disable-next-line no-param-reassign -- Required for drag-and-drop API
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((targetIndex: number) => (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (sourceIndex === targetIndex || disabled) return;
    const newHosts = [...hosts];
    const [removed] = newHosts.splice(sourceIndex, 1);
    if (removed !== undefined) { newHosts.splice(targetIndex, 0, removed); }
    onChange(newHosts);
  }, [hosts, onChange, disabled]);

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        Drag to reorder or use arrows. Hosts at the top are tried first.
      </Text>
      {hosts.map((hostId, index) => (
        <HostItem
          key={hostId}
          hostId={hostId}
          index={index}
          totalCount={hosts.length}
          disabled={disabled}
          onMoveUp={moveUp}
          onMoveDown={moveDown}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}
    </Stack>
  );
}
