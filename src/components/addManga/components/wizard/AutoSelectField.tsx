import React from 'react';

import { Select, TextInput, Textarea, TagsInput, Group, ActionIcon, Text } from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';

import { isString, isStringArray } from '@/utils/validation/consolidated-validators';

type FieldType = 'select' | 'text' | 'textarea' | 'tags';

interface AutoSelectFieldProps {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  options?: { value: string; label: string }[];
  placeholder?: string;
  description?: string;
  type?: FieldType;
  editMode?: boolean;
  onToggleEditMode?: () => void;
  searchable?: boolean;
  clearable?: boolean;
}

/**
 * Field component that can switch between dropdown selection and manual input
 */
// eslint-disable-next-line complexity -- Complex UI component with multiple field types and edit modes
export const AutoSelectField: React.FC<AutoSelectFieldProps> = ({
  label,
  value,
  onChange,
  options = [],
  placeholder,
  description,
  type = 'select',
  editMode = false,
  onToggleEditMode,
  searchable = true,
  clearable = true
}) => {
  // If in edit mode or no options available, show input field
  if (editMode || options.length === 0) {
    switch (type) {
      case 'textarea':
        return (
          <div style={{ position: 'relative' }}>
            {onToggleEditMode && options.length > 0 && (
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>{label}</Text>
                <ActionIcon
                  size="sm"
                  variant="filled"
                  onClick={onToggleEditMode}
                  title="Switch to dropdown"
                >
                  <IconEdit size={14} />
                </ActionIcon>
              </Group>
            )}
            <Textarea
              label={!onToggleEditMode ? label : undefined}
              value={isString(value) ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              description={description}
              minRows={3}
              autosize
            />
          </div>
        );

      case 'tags':
        return (
          <TagsInput
            label={label}
            value={isStringArray(value) ? value : []}
            onChange={onChange}
            placeholder={placeholder}
            description={description}
            clearable={clearable}
          />
        );

      case 'text':
      default:
        return (
          <div style={{ position: 'relative' }}>
            {onToggleEditMode && options.length > 0 && (
              <ActionIcon
                size="sm"
                variant={editMode ? 'filled' : 'subtle'}
                onClick={onToggleEditMode}
                title="Switch to dropdown"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: label ? 28 : 8,
                  zIndex: 1
                }}
              >
                <IconEdit size={14} />
              </ActionIcon>
            )}
            <TextInput
              label={label}
              value={isString(value) ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              description={description}
              style={{ paddingRight: onToggleEditMode ? 40 : undefined }}
            />
          </div>
        );
    }
  }

  // Show select dropdown when options are available
  return (
    <div style={{ position: 'relative' }}>
      {onToggleEditMode && (
        <ActionIcon
          size="sm"
          variant="subtle"
          onClick={onToggleEditMode}
          title="Switch to manual input"
          style={{
            position: 'absolute',
            right: 8,
            top: label ? 28 : 8,
            zIndex: 1
          }}
        >
          <IconEdit size={14} />
        </ActionIcon>
      )}
      <Select
        label={label}
        value={isString(value) ? value : null}
        onChange={onChange}
        data={options}
        placeholder={placeholder}
        description={description}
        searchable={searchable}
        clearable={clearable}
        allowDeselect
        style={{ paddingRight: onToggleEditMode ? 40 : undefined }}
      />
    </div>
  );
};

export default AutoSelectField;