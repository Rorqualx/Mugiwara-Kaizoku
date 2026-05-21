/**
 * FieldSelector Component
 * 
 * A unified field selector component that handles different input types
 * and displays provider information with confidence scores.
 */

import React, { useMemo, useCallback, memo } from 'react';

import {
  Select,
  TextInput,
  NumberInput,
  Textarea,
  Box,
  MultiSelect,
  Text
} from '@mantine/core';
import { DateInput } from '@mantine/dates';

import type { FieldOption, FieldType, FieldValue } from '@/components/addManga/types';

interface FieldSelectorProps {
  /** Unique field name identifier */
  fieldName: string;
  /** Display label for the field */
  fieldLabel: string;
  /** Type of input field to render */
  fieldType: FieldType;
  /** Available options for select fields */
  options: FieldOption[];
  /** Current field value */
  value: FieldValue;
  /** Change handler */
  onChange: (value: FieldValue) => void;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Field description or help text */
  description?: string;
  /** Whether to show confidence scores */
  showConfidence?: boolean;
  /** Whether to show source provider */
  showSource?: boolean;
  /** Error message */
  error?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Type for formatted select options
 */
interface FormattedOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
  data: {
    source: string;
    confidence?: number;
    description?: string;
    originalValue: FieldValue;
  };
}

// eslint-disable-next-line complexity -- Complex UI component with multiple field type cases
export const FieldSelector = memo(function FieldSelector({
  fieldName,
  fieldLabel,
  fieldType,
  options,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder,
  description,
  showConfidence: _showConfidence = true,
  showSource = true,
  error,
  className
}: FieldSelectorProps) {
  // Format options for Mantine select components
  const formattedOptions = useMemo(() => {
    const mapped = options.map(opt => {
      const formatted: FormattedOption = {
        value: String(opt.value), // Ensure string value for selects
        label: opt.label,
        data: {
          source: opt["source"],
          ...(opt.confidence !== undefined && { confidence: opt.confidence }),
          ...(opt["description"] !== undefined && { description: opt["description"] }),
          originalValue: opt.value as FieldValue
        }
      };

      // Only add optional fields if they have a value
      if (showSource && opt["source"]) {
        formatted.group = opt["source"];
      }
      if (opt.disabled !== undefined) {
        formatted.disabled = opt.disabled;
      }

      return formatted;
    });

    // Deduplicate by value to prevent Mantine "Duplicate options" errors
    const seen = new Set<string>();
    return mapped.filter(opt => {
      if (seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });
  }, [options, showSource]);

  // Handle value changes with type conversion
  const handleChange = useCallback((newValue: string | string[] | null) => {
    // For select fields, find the original value from options
    if ((fieldType === 'select' || fieldType === 'multiselect') && formattedOptions.length > 0) {
      if (fieldType === 'select' && typeof newValue === 'string') {
        const option = formattedOptions.find(opt => opt.value === newValue);
        onChange(option?.data.originalValue ?? newValue);
      } else if (Array.isArray(newValue)) {
        const originalValues = newValue.map(val => {
          const option = formattedOptions.find(opt => opt.value === val);
          return option?.data.originalValue ?? val;
        });
        onChange(originalValues as FieldValue);
      }
    } else {
      onChange(newValue as FieldValue);
    }
  }, [fieldType, formattedOptions, onChange]);

  // Render the appropriate field type
  switch (fieldType) {
    case 'select':
      return (
        <Select
          label={fieldLabel}
          placeholder={placeholder ?? `Select ${fieldLabel.toLowerCase()}`}
          data={formattedOptions}
          value={String(value ?? '')}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          {...(error !== undefined && { error })}
          {...(description !== undefined && { description })}
          searchable
          clearable
          nothingFoundMessage="No options available"
          {...(className !== undefined && { className })}
          data-field={fieldName}
        />
      );

    case 'multiselect': {
      const multiValue = Array.isArray(value)
        ? value.map(v => String(v))
        : value ? [String(value)] : [];

      return (
        <MultiSelect
          label={fieldLabel}
          placeholder={placeholder ?? `Select multiple ${fieldLabel.toLowerCase()}`}
          data={formattedOptions}
          value={multiValue}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          {...(error !== undefined && { error })}
          {...(description !== undefined && { description })}
          searchable
          clearable
          nothingFoundMessage="No options available"
          {...(className !== undefined && { className })}
          data-field={fieldName}
        />
      );
    }

    case 'text':
      return (
        <TextInput
          label={fieldLabel}
          {...(placeholder !== undefined && { placeholder })}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.currentTarget.value)}
          required={required}
          disabled={disabled}
          {...(error !== undefined && { error })}
          {...(description !== undefined && { description })}
          {...(className !== undefined && { className })}
          data-field={fieldName}
        />
      );

    case 'textarea':
      return (
        <Textarea
          label={fieldLabel}
          {...(placeholder !== undefined && { placeholder })}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.currentTarget.value)}
          required={required}
          disabled={disabled}
          {...(error !== undefined && { error })}
          {...(description !== undefined && { description })}
          minRows={3}
          autosize
          maxRows={10}
          {...(className !== undefined && { className })}
          data-field={fieldName}
        />
      );

    case 'number':
      return (
        <NumberInput
          label={fieldLabel}
          {...(placeholder !== undefined && { placeholder })}
          value={value as number}
          onChange={(val) => onChange(val)}
          required={required}
          disabled={disabled}
          {...(error !== undefined && { error })}
          {...(description !== undefined && { description })}
          min={0}
          {...(className !== undefined && { className })}
          data-field={fieldName}
        />
      );

    case 'date': {
      // Convert string dates to Date objects for the DateInput
      let dateValue: Date | null = null;
      if (value) {
        if (value instanceof Date) {
          dateValue = value;
        } else if (typeof value === 'string') {
          const parsed = new Date(value);
          if (!isNaN(parsed.getTime())) {
            dateValue = parsed;
          }
        }
      }

      return (
        <DateInput
          label={fieldLabel}
          placeholder={placeholder ?? 'Select date'}
          value={dateValue}
          onChange={(val) => onChange(val)}
          required={required}
          disabled={disabled}
          {...(error !== undefined && { error })}
          {...(description !== undefined && { description })}
          clearable
          {...(className !== undefined && { className })}
          data-field={fieldName}
        />
      );
    }

    default:
      return (
        <Box {...(className !== undefined && { className })}>
          <Text size="sm" c="dimmed">
            Unsupported field type: {fieldType}
          </Text>
        </Box>
      );
  }
});

// Export helper function to create field options from data
export function createFieldOptions(
  data: Record<string, unknown[]>,
  fieldName: string,
  getLabel?: (value: unknown) => string
): FieldOption[] {
  const options: FieldOption[] = [];
  const seen = new Set<string>();

  Object.entries(data).forEach(([source, values]) => {
    if (!Array.isArray(values)) return;

    values.forEach(value => {
      const label = getLabel ? getLabel(value) : String(value);
      const key = `${source}:${label}`;

      if (!seen.has(key)) {
        seen.add(key);

        // Type guard for objects with confidence property
        const confidence = (
          value &&
          typeof value === 'object' &&
          'confidence' in value &&
          typeof (value as { confidence?: number }).confidence === 'number'
        ) ? (value as { confidence: number }).confidence : undefined;

        options.push({
          value,
          label: `${label} (${source})`,
          source,
          ...(confidence !== undefined && { confidence })
        });
      }
    });
  });

  return options;
}