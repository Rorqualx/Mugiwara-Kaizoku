/**
 * Alert Components
 *
 * Various alert/info components for the annotation editor.
 */

import React, { useState } from 'react';

import {
  ActionIcon,
  Text,
  TextInput,
  Button,
  Group,
  Alert,
  Badge,
  Tooltip,
} from '@mantine/core';
import {
  IconX,
  IconCheck,
  IconEdit,
} from '@tabler/icons-react';

// ============================================================================
// PageInfoAlert
// ============================================================================

export interface PageInfoAlertProps {
  pageData: { mangaTitle: string | null; sourceType: string; status: string; url: string };
  onUpdateTitle?: (title: string) => void;
  isUpdating?: boolean;
}

export function PageInfoAlert({ pageData, onUpdateTitle, isUpdating }: PageInfoAlertProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(pageData.mangaTitle ?? '');

  const handleSave = (): void => {
    if (editValue.trim() && onUpdateTitle) {
      onUpdateTitle(editValue.trim());
      setIsEditing(false);
    }
  };

  const handleCancel = (): void => {
    setEditValue(pageData.mangaTitle ?? '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Alert color="blue" mb="md">
      <Group>
        {isEditing ? (
          <Group gap="xs">
            <TextInput
              value={editValue}
              onChange={(e) => setEditValue(e.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter manga title"
              size="xs"
              autoFocus
              style={{ width: 200 }}
            />
            <ActionIcon size="sm" color="green" variant="filled" onClick={handleSave} loading={isUpdating ?? false}>
              <IconCheck size={14} />
            </ActionIcon>
            <ActionIcon size="sm" color="gray" variant="light" onClick={handleCancel} disabled={isUpdating ?? false}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        ) : (
          <Group gap="xs">
            <Text size="sm" fw={500}>{pageData.mangaTitle ?? 'Untitled'}</Text>
            {onUpdateTitle && (
              <Tooltip label="Edit title" withArrow>
                <ActionIcon size="xs" variant="subtle" color="blue" onClick={() => setIsEditing(true)}>
                  <IconEdit size={12} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}
        <Badge size="sm">{pageData.sourceType}</Badge>
        <Badge size="sm" color="gray">{pageData.status}</Badge>
      </Group>
      <Text size="xs" c="dimmed" mt={4}>{pageData.url}</Text>
    </Alert>
  );
}

// ============================================================================
// SelectionAlert
// ============================================================================

export interface SelectionAlertProps {
  count: number;
  onClear: () => void;
}

export function SelectionAlert({ count, onClear }: SelectionAlertProps): React.ReactElement {
  return (
    <Alert color="blue">
      <Group justify="space-between">
        <Text size="sm">{count} tokens selected</Text>
        <Button size="xs" variant="subtle" color="gray" onClick={onClear}>
          Clear Selection (Esc)
        </Button>
      </Group>
    </Alert>
  );
}

// ============================================================================
// BrushModeAlert
// ============================================================================

export interface BrushModeAlertProps {
  brush: string;
  onClear: () => void;
}

export function BrushModeAlert({ brush, onClear }: BrushModeAlertProps): React.ReactElement {
  const label = brush === 'CLEAR' ? 'Clear Label' : brush.replace(/_/g, ' ');
  return (
    <Alert color="green" title="Brush Mode Active">
      <Group justify="space-between">
        <Text size="sm">
          Click any element to apply: <strong>{label}</strong>
        </Text>
        <Button size="xs" variant="subtle" color="gray" onClick={onClear}>
          Exit Brush Mode (Esc)
        </Button>
      </Group>
    </Alert>
  );
}
