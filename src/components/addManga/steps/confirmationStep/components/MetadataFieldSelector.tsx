/**
 * Metadata Field Selector Component
 * Allows selecting metadata values from different providers for each field
 */

import React from 'react';

import { Select} from '@mantine/core';
interface FieldOption {
  value: string;
  label: string;
  provider: string;
  metadata?: unknown;
}

interface MetadataFieldSelectorProps {
  label: string;
  field: string;
  options: FieldOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

export function MetadataFieldSelector({
  label,
  field: _field,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = "Select a value"
}: MetadataFieldSelectorProps): React.ReactElement {
  // Group options by provider
  const groupedOptions = options.reduce((acc, option) => {
    const providerGroup = acc[option.provider] ?? [];
    return {
      ...acc,
      [option.provider]: [...providerGroup, option]
    };
  }, {} as Record<string, FieldOption[]>);
  // Create select data with groups
  const selectData = Object.entries(groupedOptions).map(([provider, providerOptions]) => ({
    group: provider,
    items: providerOptions.map(opt => ({
      value: opt.value,
      label: opt.label
    }))
  }));
  return (
    <Select
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(val) => val && onChange(val)}
      data={selectData}
      disabled={disabled}
      required={required}
      searchable
      clearable
      styles={{
        option: {
          '&[data-selected]': {
            '&, &:hover': {
              backgroundColor: 'var(--mantine-color-blue-6)',
              color: 'white',
            },
          },
        },
      }}
    />
  );
}

/**
 * Bulk field selector for multiple fields at once
 */
interface BulkFieldSelectorProps {
  fields: Array<{
    name: string;
    label: string;
    required?: boolean;
  }>;
  sources: Record<string, unknown>; // Provider -> Manga data
  currentSelections: Record<string, { source: string; value: unknown }>;
  onFieldChange: (field: string, source: string, value: unknown) => void;
}

export function BulkFieldSelector({
  fields,
  sources,
  currentSelections,
  onFieldChange
}: BulkFieldSelectorProps): React.ReactElement {
  // Helper to get field value from a source
  const getFieldValue = (source: unknown, field: string): unknown => {
    if (!source || typeof source !== 'object') return null;

    const sourceObj = source as Record<string, unknown>;
    // Check direct property
    if (sourceObj[field] !== undefined) return sourceObj[field];
    // Check metadata
    const metadata = sourceObj["metadata"] as Record<string, unknown> | undefined;
    if (metadata?.[field] !== undefined) return metadata[field];
    // Check rawData
    const rawData = sourceObj["rawData"] as Record<string, unknown> | undefined;
    if (rawData?.[field] !== undefined) return rawData[field];
    return null;
  };
  // Generate options for a field
  const getFieldOptions = (field: string): FieldOption[] => {
    const options: FieldOption[] = [];
    Object.entries(sources).forEach(([provider, manga]) => {
      const value = getFieldValue(manga, field);
      if (value !== null && value !== '') {
        // Create a unique key for this option
        const optionKey = `${provider}_${field}`;
        // Format the label based on value type
        let label = '';
        if (Array.isArray(value)) {
          label = value.length > 0 ? `${value.length} items` : 'Empty';
        } else if (typeof value === 'object') {
          label = JSON.stringify(value).substring(0, 50) + '...';
        } else {
          label = String(value);
        }
        
        options.push({
          value: optionKey,
          label,
          provider,
          metadata: value
        });
      }
    });
    return options;
  };
  return (
    <div>
      {fields.map(field => {
        const options = getFieldOptions(field["name"]);
        const currentSelection = currentSelections[field["name"]];
        const currentValue = currentSelection ? 
          `${currentSelection["source"]}_${field["name"]}` : '';
        return (
          <MetadataFieldSelector
            key={field["name"]}
            label={field.label}
            field={field["name"]}
            options={options}
            value={currentValue}
            onChange={(optionKey) => {
              // Parse the option key to get provider and field
              const [provider, ...fieldParts] = optionKey.split('_');
              const fieldName = fieldParts.join('_');
              // Find the actual value from options
              const option = options.find(opt => opt.value === optionKey);
              if (option && provider) {
                onFieldChange(fieldName, provider, option["metadata"]);
              }
            }}
            {...(field.required !== undefined && { required: field.required })}
          />
        );
      })}
    </div>
  );
}
