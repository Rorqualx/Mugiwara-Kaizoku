/**
 * Text field editor component
 */
import React from 'react';

import { TextInput, ActionIcon } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

interface TextFieldEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  onSave: (value: unknown, source: string) => void;
  onEditingComplete: () => void;
}

export function TextFieldEditor({
  value,
  onChange,
  onSave,
  onEditingComplete,
}: TextFieldEditorProps): JSX.Element {
  return (
    <TextInput
      value={typeof value === 'string' ? value : String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      rightSection={
        <ActionIcon
          onClick={() => {
            onSave(value, 'custom');
            onEditingComplete();
          }}
        >
          <IconCheck size={16} />
        </ActionIcon>
      }
    />
  );
}
