/**
 * Field Provider Preferences Header
 *
 * Header section with title and action buttons.
 */
import React, { JSX } from 'react';

import { Group, Text, Button, ActionIcon, Tooltip } from '@mantine/core';
import { IconInfoCircle, IconCheck } from '@tabler/icons-react';

interface FieldProviderPreferencesHeaderProps {
  isDirty: boolean;
  onReset: () => void;
  onSave: () => void;
}

export function FieldProviderPreferencesHeader({
  isDirty,
  onReset,
  onSave
}: FieldProviderPreferencesHeaderProps): JSX.Element {
  return (
    <Group justify="space-between">
      <Group gap="xs">
        <Text fw={700} size="lg">Quick Add Field Provider Preferences</Text>
        <Tooltip label="Configure which provider to use for each metadata field during Quick Add">
          <ActionIcon size="sm" variant="subtle">
            <IconInfoCircle size={16}/>
          </ActionIcon>
        </Tooltip>
      </Group>
      <Group gap="xs">
        <Button size="xs" variant="subtle" onClick={onReset} disabled={!isDirty}>
          Reset to Defaults
        </Button>
        <Button size="xs" onClick={onSave} disabled={!isDirty} leftSection={<IconCheck size={16}/>}>
          Save Changes
        </Button>
      </Group>
    </Group>
  );
}
