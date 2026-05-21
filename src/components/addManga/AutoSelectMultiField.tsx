import React, { useEffect, useRef } from 'react';

import { MultiSelect } from '@mantine/core';

import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';
import { logger } from '@/utils/logger';

import type { MultiSelectProps } from '@mantine/core';

interface AutoSelectMultiFieldProps extends Omit<MultiSelectProps, 'onChange'> {
  value: string[];
  onChange: (value: string[]) => void;
  data: string[];
  fieldName: string;
  autoSelectFromProviders?: boolean;
  preferredProviders?: string[];
}

/**
 * Enhanced MultiSelect component with automatic selection capabilities for array fields
 * - Auto-selects values from preferred providers (especially AniList)
 * - Accumulates values from multiple sources
 */
export function AutoSelectMultiField({
  value,
  onChange,
  data,
  fieldName,
  autoSelectFromProviders = true,
  // Use field-specific preferences from defaults (prop exists for future use/API consistency)
  preferredProviders: _preferredProviders = DEFAULT_FIELD_PRIORITIES['genres'],
  ...multiSelectProps
}: AutoSelectMultiFieldProps): React.ReactElement {
  const hasAutoSelected = useRef(false);
  const previousDataHash = useRef('');
  
  // Create a stable hash of data to detect real changes
  const dataHash = JSON.stringify(data);

  useEffect(() => {
    // Skip if no data or already has values
    if (data.length === 0 || value.length > 0 || !autoSelectFromProviders) {
      return;
    }

    // Check if data has actually changed
    const dataChanged = previousDataHash.current !== dataHash;
    previousDataHash.current = dataHash;

    // Skip if data hasn't changed or we've already auto-selected
    if (!dataChanged || hasAutoSelected.current) {
      return;
    }

    // Since data comes from getArrayFieldOptions which returns simple strings,
    // and we're already merging from all sources including AniList,
    // we should auto-select all available values when they appear
    if (data.length > 0) {
      logger.info(`[AutoSelectMultiField] Auto-selecting all available values for ${fieldName}:`, {
        values: data,
        count: data.length
      });
      
      onChange(data);
      hasAutoSelected.current = true;
    }
  }, [dataHash, value, onChange, fieldName, autoSelectFromProviders, data]);

  return (
    <MultiSelect
      {...multiSelectProps}
      value={value}
      onChange={onChange}
      data={[...new Set(data)]}
    />
  );
}