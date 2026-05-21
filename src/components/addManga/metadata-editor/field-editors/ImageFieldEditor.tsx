/**
 * Image field editor component
 */
import React from 'react';

import { Stack, Group, TextInput, Button, Image } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';

interface ImageFieldEditorProps {
  field: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function ImageFieldEditor({
  field,
  value,
  onChange,
}: ImageFieldEditorProps): JSX.Element {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Stack gap="xs">
      {typeof value === 'string' && value && (
        <Image
          src={value}
          alt={field}
          height={100}
          fit="contain"
          fallbackSrc="/cover-not-found.jpg"
        />
      )}
      <TextInput
        placeholder="Image URL"
        value={typeof value === 'string' ? value : String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      />
      <Group gap="xs">
        <Button
          size="xs"
          onClick={() => document.getElementById(`${field}-upload`)?.click()}
        >
          <IconUpload size={14} /> Upload
        </Button>
        <input
          id={`${field}-upload`}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
      </Group>
    </Stack>
  );
}
