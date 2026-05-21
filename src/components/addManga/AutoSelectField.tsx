import React, { useCallback } from 'react';

import { Select } from '@mantine/core';

import { useAutoSelect, useSmartAutoSelect } from '@/hooks/useAutoSelect';
import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';

import type { SelectProps } from '@mantine/core';

interface AutoSelectFieldProps extends Omit<SelectProps, 'onChange' | 'value'> {
  value: string | null;
  onChange: (value: string) => void;
  data: Array<{ value: string; label: string }> | string[];
  fieldName: string;
  autoSelectSingle?: boolean;
  autoSelectFirst?: boolean;
  useSmartSelection?: boolean;
  preferredProviders?: string[];
}

/**
 * Enhanced Select component with automatic selection capabilities
 * - Auto-selects when there's only one option
 * - Can auto-select first option when configured
 * - Can use smart selection to pick best option from multiple sources
 */
export function AutoSelectField({
  value,
  onChange,
  data,
  fieldName,
  autoSelectSingle = true,
  autoSelectFirst = false,
  useSmartSelection = false,
  preferredProviders,
  ...selectProps
}: AutoSelectFieldProps): React.ReactElement {
  // Use field-specific preferences from defaults, falling back to 'title' field
  const effectivePreferredProviders = preferredProviders
    ?? DEFAULT_FIELD_PRIORITIES[fieldName as keyof typeof DEFAULT_FIELD_PRIORITIES]
    ?? DEFAULT_FIELD_PRIORITIES['title'];
  // Normalize data to array of objects
  const normalizedData = React.useMemo(() => {
    if (data.length === 0) return [];
    return data.map(item =>
      typeof item === 'string'
        ? { value: item, label: item }
        : item
    );
  }, [data]);
  
  // Memoize the onChange callback to prevent infinite loops
  const memoizedOnChange = useCallback((newValue: string) => {
    onChange(newValue);
  }, [onChange]);

  // Always call both hooks - they internally handle whether to execute
  useSmartAutoSelect(
    useSmartSelection ? normalizedData : [],
    value ?? null,
    memoizedOnChange,
    fieldName,
    effectivePreferredProviders
  );

  useAutoSelect({
    options: !useSmartSelection ? normalizedData : [],
    currentValue: value ?? null,
    onChange: memoizedOnChange,
    fieldName,
    autoSelectSingle,
    autoSelectFirst
  });

  return (
    <Select
      {...selectProps}
      value={value ?? ''}
      onChange={(val) => onChange(val ?? '')}
      data={normalizedData}
    />
  );
}