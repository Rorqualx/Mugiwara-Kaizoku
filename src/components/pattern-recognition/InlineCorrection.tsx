/**
 * Inline correction component for quick fixes
 */
import React, { useState } from 'react';

import { Group, Text, Tooltip, ActionIcon, TextInput } from '@mantine/core';
import { IconEdit, IconCheck, IconX } from '@tabler/icons-react';

interface InlineCorrectionProps {
  field: string;
  value: unknown;
  onCorrect: (value: unknown) => void;
}

export const InlineCorrection: React.FC<InlineCorrectionProps> = ({
  value,
  onCorrect,
}): JSX.Element => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = (): void => {
    onCorrect(editValue);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <Group gap="xs">
        <Text>
          {(() => {
            if (typeof value === 'string' || typeof value === 'number') {
              return String(value);
            }
            return 'Not set';
          })()}
        </Text>
        <Tooltip label="Click to correct">
          <ActionIcon size="xs" onClick={() => setIsEditing(true)}>
            <IconEdit size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    );
  }

  const stringEditValue =
    typeof editValue === 'string' || typeof editValue === 'number'
      ? String(editValue)
      : '';

  return (
    <Group gap="xs">
      <TextInput
        size="xs"
        value={stringEditValue}
        onChange={(e) => setEditValue(e.currentTarget.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSave()}
        autoFocus
      />
      <ActionIcon
        size="xs"
        color="green"
        onClick={() => {
          void handleSave();
        }}
      >
        <IconCheck size={14} />
      </ActionIcon>
      <ActionIcon size="xs" color="red" onClick={() => setIsEditing(false)}>
        <IconX size={14} />
      </ActionIcon>
    </Group>
  );
};
