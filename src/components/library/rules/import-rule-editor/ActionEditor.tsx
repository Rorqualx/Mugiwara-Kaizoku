import React from 'react';

import {
  Card,
  Stack,
  TextInput,
  NumberInput,
  Select,
  Group,
  Text,
  ActionIcon
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import type { RuleAction, ActionType } from '@/types/import-rules';

interface ActionEditorProps {
  action: RuleAction;
  index: number;
  onUpdate: (index: number, updates: Partial<RuleAction>) => void;
  onRemove: (index: number) => void;
}

export function ActionEditor({
  action,
  index,
  onUpdate,
  onRemove
}: ActionEditorProps): JSX.Element {
  const handleTypeChange = (value: string | null): void => {
    if (!value) return;
    onUpdate(index, {
      type: value as ActionType,
      value: ''
    });
  };

  const handleNumberChange = (value: string | number): void => {
    onUpdate(index, { value: Number(value) });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onUpdate(index, { value: e.currentTarget.value });
  };

  const handleSelectChange = (value: string | null): void => {
    if (value === null) return;
    onUpdate(index, { value });
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onUpdate(index, {
      value: e.currentTarget.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    });
  };

  const renderValueInput = (): JSX.Element => {
    if (action.type === 'skip') {
      return (
        <Text size="sm" c="dimmed">
          This file will be skipped during import
        </Text>
      );
    }

    if (action.type === 'set_library') {
      return (
        <NumberInput
          label="Library ID"
          value={action.value as number}
          onChange={handleNumberChange}
          min={1}
          required
        />
      );
    }

    if (action.type === 'set_priority') {
      return (
        <NumberInput
          label="Priority"
          value={action.value as number}
          onChange={handleNumberChange}
          min={0}
          max={100}
          required
        />
      );
    }

    if (action.type === 'set_reading_direction') {
      return (
        <Select
          label="Direction"
          value={action.value as string}
          onChange={handleSelectChange}
          data={[
            { value: 'ltr', label: 'Left to Right' },
            { value: 'rtl', label: 'Right to Left' }
          ]}
          required
        />
      );
    }

    if (action.type === 'add_tag') {
      return (
        <TextInput
          label="Tags (comma-separated)"
          value={Array.isArray(action.value) ? action.value.join(', ') : (action.value as string)}
          onChange={handleTagsChange}
          placeholder="shounen, action, adventure"
          required
        />
      );
    }

    if (action.type === 'set_metadata_provider') {
      return (
        <Select
          label="Provider"
          value={action.value as string}
          onChange={handleSelectChange}
          data={[
            { value: 'anilist', label: 'AniList' },
            { value: 'comicvine', label: 'ComicVine' },
            { value: 'fandom', label: 'Fandom' },
            { value: 'wikipedia', label: 'Wikipedia' }
          ]}
          required
        />
      );
    }

    return (
      <TextInput
        label="Value"
        value={action.value as string}
        onChange={handleTextChange}
        required
      />
    );
  };

  return (
    <Card withBorder p="sm">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={500}>
            Action {index + 1}
          </Text>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={(): void => onRemove(index)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>

        <Select
          label="Type"
          value={action.type}
          onChange={handleTypeChange}
          data={[
            { value: 'set_library', label: 'Set Library' },
            { value: 'add_tag', label: 'Add Tag' },
            { value: 'set_status', label: 'Set Status' },
            { value: 'skip', label: 'Skip Import' },
            { value: 'set_metadata_provider', label: 'Set Metadata Provider' },
            { value: 'set_priority', label: 'Set Priority' },
            { value: 'apply_naming_pattern', label: 'Apply Naming Pattern' },
            { value: 'move_to_folder', label: 'Move to Folder' },
            { value: 'set_reading_direction', label: 'Set Reading Direction' }
          ]}
          required
        />

        {renderValueInput()}
      </Stack>
    </Card>
  );
}
