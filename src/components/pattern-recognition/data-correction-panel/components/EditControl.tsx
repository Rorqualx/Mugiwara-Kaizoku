/**
 * Edit control component for rendering appropriate input based on field type
 */
import React from 'react';

import { TextInput, Textarea, Select, NumberInput, MultiSelect } from '@mantine/core';

import { STATUS_OPTIONS } from '../utils';

import type { EditControlProps } from '../types';

export const EditControl: React.FC<EditControlProps> = ({
  field,
  value,
  onFieldChange,
}): JSX.Element => {
  const stringValue = typeof value === 'string' ? value : '';
  const numberValue = typeof value === 'number' ? value : undefined;
  const arrayValue = Array.isArray(value) ? value : [];

  switch (field) {
    case 'title':
    case 'publisher':
    case 'demographic': {
      return (
        <TextInput
          value={stringValue}
          onChange={(e) => onFieldChange(field, e.currentTarget.value)}
          placeholder={`Enter ${field}`}
        />
      );
    }
    case 'description': {
      return (
        <Textarea
          value={stringValue}
          onChange={(e) => onFieldChange(field, e.currentTarget.value)}
          placeholder="Enter description"
          minRows={3}
        />
      );
    }
    case 'chapters':
    case 'volumes':
    case 'releaseYear': {
      return (
        <NumberInput
          {...(numberValue !== undefined ? { value: numberValue } : {})}
          onChange={(val) => onFieldChange(field, val)}
          placeholder={`Enter ${field}`}
          min={0}
        />
      );
    }
    case 'status': {
      return (
        <Select
          value={typeof value === 'string' ? value : null}
          onChange={(val) => onFieldChange(field, val)}
          data={[...STATUS_OPTIONS]}
          placeholder="Select status"
        />
      );
    }
    case 'author':
    case 'artist':
    case 'alternativeTitles':
    case 'genres': {
      return (
        <MultiSelect
          value={arrayValue}
          onChange={(val) => onFieldChange(field, val)}
          data={[...new Set(arrayValue.map(String))]}
          searchable
          placeholder={`Enter ${field}`}
        />
      );
    }
    default: {
      return (
        <TextInput
          value={stringValue}
          onChange={(e) => onFieldChange(field, e.currentTarget.value)}
          placeholder={`Enter ${field}`}
        />
      );
    }
  }
};
