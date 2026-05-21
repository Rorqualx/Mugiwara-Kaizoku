import React from 'react';

import {
  Card,
  Stack,
  TextInput,
  NumberInput,
  Select,
  Group,
  Text,
  Switch,
  ActionIcon
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import type {
  RuleCondition,
  ConditionType,
  ConditionOperator
} from '@/types/import-rules';

import { getOperatorsForType } from './utils';

interface ConditionEditorProps {
  condition: RuleCondition;
  index: number;
  onUpdate: (index: number, updates: Partial<RuleCondition>) => void;
  onRemove: (index: number) => void;
}

export function ConditionEditor({
  condition,
  index,
  onUpdate,
  onRemove
}: ConditionEditorProps): JSX.Element {
  const operators = getOperatorsForType(condition.type);

  const handleTypeChange = (value: string | null): void => {
    if (!value) return;
    const firstOperator = getOperatorsForType(value as ConditionType)[0];
    onUpdate(index, {
      type: value as ConditionType,
      ...(firstOperator !== undefined && { operator: firstOperator })
    });
  };

  const handleOperatorChange = (value: string | null): void => {
    if (!value) return;
    onUpdate(index, { operator: value as ConditionOperator });
  };

  const handleRangeMinChange = (value: string | number): void => {
    const current = Array.isArray(condition.value) ? condition.value : [0, 0];
    const secondValue = current[1];
    onUpdate(index, {
      value: [Number(value), Number(secondValue)]
    });
  };

  const handleRangeMaxChange = (value: string | number): void => {
    const current = Array.isArray(condition.value) ? condition.value : [0, 0];
    const firstValue = current[0];
    onUpdate(index, {
      value: [Number(firstValue), Number(value)]
    });
  };

  const handleFileSizeChange = (value: string | number): void => {
    onUpdate(index, { value: Number(value) });
  };

  const handleTextValueChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onUpdate(index, { value: e.currentTarget.value });
  };

  const handleCaseSensitiveChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onUpdate(index, { caseSensitive: e.currentTarget.checked });
  };

  const handleNegateChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onUpdate(index, { negate: e.currentTarget.checked });
  };

  const renderValueInput = (): JSX.Element => {
    if (condition.type === 'chapter_range' || condition.type === 'volume_range') {
      return (
        <Group grow>
          <NumberInput
            label="Min"
            value={Array.isArray(condition.value) ? condition.value[0] : 0}
            onChange={handleRangeMinChange}
            min={0}
            required
          />
          <NumberInput
            label="Max"
            value={Array.isArray(condition.value) ? condition.value[1] : 0}
            onChange={handleRangeMaxChange}
            min={0}
            required
          />
        </Group>
      );
    }

    if (condition.type === 'file_size') {
      return (
        <NumberInput
          label="Value (bytes)"
          value={condition.value as number}
          onChange={handleFileSizeChange}
          min={0}
          required
        />
      );
    }

    return (
      <TextInput
        label="Value"
        value={condition.value as string}
        onChange={handleTextValueChange}
        placeholder={
          condition.type === 'filename_pattern'
            ? '.*Chapter\\s*(\\d+).*'
            : condition.type === 'path_contains'
              ? '/manga/shounen/'
              : 'Enter value...'
        }
        required
      />
    );
  };

  return (
    <Card withBorder p="sm">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" fw={500}>
            Condition {index + 1}
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
          value={condition.type}
          onChange={handleTypeChange}
          data={[
            { value: 'filename_pattern', label: 'Filename Pattern' },
            { value: 'path_contains', label: 'Path Contains' },
            { value: 'file_size', label: 'File Size' },
            { value: 'metadata_match', label: 'Metadata Match' },
            { value: 'chapter_range', label: 'Chapter Range' },
            { value: 'volume_range', label: 'Volume Range' },
            { value: 'language', label: 'Language' },
            { value: 'group', label: 'Group' }
          ]}
          required
        />

        <Select
          label="Operator"
          value={condition.operator}
          onChange={handleOperatorChange}
          data={operators.map((op) => ({
            value: op,
            label: op.replace(/_/g, ' ')
          }))}
          required
        />

        {renderValueInput()}

        <Group gap="xs">
          <Switch
            label="Case sensitive"
            checked={condition.caseSensitive ?? false}
            onChange={handleCaseSensitiveChange}
            size="sm"
          />
          <Switch
            label="Negate (NOT)"
            checked={condition.negate ?? false}
            onChange={handleNegateChange}
            size="sm"
          />
        </Group>
      </Stack>
    </Card>
  );
}
