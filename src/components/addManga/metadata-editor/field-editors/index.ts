/**
 * Field editors registry
 */
import React from 'react';

import { Textarea, NumberInput, TextInput, Switch, MultiSelect, JsonInput } from '@mantine/core';

import {
  isTextField,
  isImageField,
  isArrayField,
  isNumberField,
  isDateField,
  isJsonField,
} from './field-types';
import { ImageFieldEditor } from './ImageFieldEditor';
import { TextFieldEditor } from './TextFieldEditor';

function createTextFieldEditor(
  editValue: unknown,
  setEditValue: (value: unknown) => void,
  onUpdate: (value: unknown, source: string) => void,
  setIsEditing: (editing: boolean) => void
): JSX.Element {
  return React.createElement(TextFieldEditor, {
    value: editValue,
    onChange: setEditValue,
    onSave: onUpdate,
    onEditingComplete: () => setIsEditing(false),
  });
}

function createArrayFieldEditor(editValue: unknown, setEditValue: (value: unknown) => void): JSX.Element {
  const dataValues = Array.isArray(editValue) ? [...new Set(editValue.map(String))] : [];
  const valueArray = Array.isArray(editValue) ? [...new Set(editValue.map(String))] : [];
  return React.createElement(MultiSelect, {
    data: dataValues,
    value: valueArray,
    onChange: setEditValue,
    searchable: true,
    clearable: true,
    placeholder: 'Enter values...',
  });
}

function createNumberFieldEditor(editValue: unknown, setEditValue: (value: unknown) => void): JSX.Element {
  const numValue =
    typeof editValue === 'number' ? editValue : typeof editValue === 'string' ? Number(editValue) : 0;
  return React.createElement(NumberInput, {
    value: numValue,
    onChange: setEditValue,
    min: 0,
  });
}

function createJsonFieldEditor(editValue: unknown, setEditValue: (value: unknown) => void): JSX.Element {
  return React.createElement(JsonInput, {
    value: JSON.stringify(editValue, null, 2),
    onChange: (val: string) => {
      try {
        setEditValue(JSON.parse(val));
      } catch {
        // Invalid JSON, ignore
      }
    },
    minRows: 3,
  });
}

/**
 * Get appropriate field editor based on field name
 */
export function getFieldEditor(
  field: string,
  editValue: unknown,
  setEditValue: (value: unknown) => void,
  onUpdate: (value: unknown, source: string) => void,
  setIsEditing: (editing: boolean) => void
): JSX.Element {
  if (isTextField(field)) {
    return createTextFieldEditor(editValue, setEditValue, onUpdate, setIsEditing);
  }

  if (field === 'description') {
    return React.createElement(Textarea, {
      value: typeof editValue === 'string' ? editValue : String(editValue ?? ''),
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditValue(e.target.value),
      minRows: 3,
      maxRows: 10,
    });
  }

  if (isImageField(field)) {
    return React.createElement(ImageFieldEditor, {
      field,
      value: editValue,
      onChange: setEditValue,
    });
  }

  if (isArrayField(field)) {
    return createArrayFieldEditor(editValue, setEditValue);
  }

  if (isNumberField(field)) {
    return createNumberFieldEditor(editValue, setEditValue);
  }

  if (isDateField(field)) {
    return React.createElement(TextInput, {
      type: 'date',
      value: typeof editValue === 'string' ? editValue : String(editValue ?? ''),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value),
    });
  }

  if (field === 'isAdult') {
    return React.createElement(Switch, {
      checked: typeof editValue === 'boolean' ? editValue : false,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.currentTarget.checked),
    });
  }

  if (isJsonField(field)) {
    return createJsonFieldEditor(editValue, setEditValue);
  }

  return React.createElement(TextInput, {
    value: typeof editValue === 'string' ? editValue : String(editValue ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value),
  });
}

export { TextFieldEditor } from './TextFieldEditor';
export { ImageFieldEditor } from './ImageFieldEditor';
