/**
 * Field editor component for displaying and editing a single field
 */
import React from 'react';

import { Paper, Group, Text, Badge, ActionIcon, Alert, Stack } from '@mantine/core';
import { IconEdit, IconAlertCircle } from '@tabler/icons-react';

import { formatDisplayValue } from '../utils';

import { EditControl } from './EditControl';

import type { FieldEditorProps } from '../types';

export const FieldEditor: React.FC<FieldEditorProps> = ({
  field,
  value,
  originalValue,
  hasCorrection,
  error,
  isEditing,
  onToggleEdit,
  onFieldChange,
}): JSX.Element => {
  const displayValue = formatDisplayValue(value);

  return (
    <Paper p="md" withBorder>
      <Group justify="apart" mb="xs">
        <Group>
          <Text fw={500}>{field.charAt(0).toUpperCase() + field.slice(1)}</Text>
          {hasCorrection ? (
            <Badge color="blue" size="sm">
              Corrected
            </Badge>
          ) : null}
        </Group>
        <ActionIcon
          onClick={onToggleEdit}
          color={isEditing ? 'blue' : 'gray'}
          variant={isEditing ? 'filled' : 'subtle'}
        >
          <IconEdit size={16} />
        </ActionIcon>
      </Group>

      {hasCorrection ? (
        <Alert color="yellow" mb="xs" icon={<IconAlertCircle size={16} />}>
          <Text size="xs">Original: {JSON.stringify(originalValue)}</Text>
        </Alert>
      ) : null}

      {isEditing ? (
        <Stack gap="xs">
          <EditControl field={field} value={value} onFieldChange={onFieldChange} />
          {error && (
            <Text color="red" size="xs">
              {error}
            </Text>
          )}
        </Stack>
      ) : (
        <Text size="sm" color="dimmed">
          {displayValue}
        </Text>
      )}
    </Paper>
  );
};
