/**
 * Preview Tab Component
 *
 * Displays a preview of selected metadata fields
 */

import React from 'react';

import {
  ScrollArea,
  Stack,
  Group,
  Text,
  Badge
} from '@mantine/core';

import { METADATA_FIELDS, formatValue, getProviderColor } from './utils';

import type { FieldSelection } from './types';

interface PreviewTabProps {
  fieldSelections: Record<string, FieldSelection>;
}

function PreviewItem({
  fieldKey,
  selection
}: {
  fieldKey: string;
  selection: FieldSelection;
}): React.ReactElement | null {
  const fieldConfig = METADATA_FIELDS.find(f => f.key === fieldKey);
  if (!fieldConfig) return null;

  const Icon = fieldConfig.icon;

  return (
    <Group gap="xs">
      <Icon size={16} />
      <Text size="sm" fw={500} style={{ width: 120 }}>
        {fieldConfig.label}:
      </Text>
      <Badge color={getProviderColor(selection.provider)} size="xs">
        {selection.provider}
      </Badge>
      <Text size="sm" c="dimmed" style={{ flex: 1 }}>
        {formatValue(selection.value)}
      </Text>
    </Group>
  );
}

export function PreviewTab({
  fieldSelections
}: PreviewTabProps): React.ReactElement {
  const entries = Object.entries(fieldSelections);

  return (
    <ScrollArea h={400}>
      <Stack gap="md">
        <Text size="sm" fw={600}>Selected Metadata Preview:</Text>

        {entries.length > 0 ? (
          entries.map(([field, selection]) => (
            <PreviewItem
              key={field}
              fieldKey={field}
              selection={selection}
            />
          ))
        ) : (
          <Text size="sm" c="dimmed" ta="center">
            No fields selected yet
          </Text>
        )}
      </Stack>
    </ScrollArea>
  );
}
