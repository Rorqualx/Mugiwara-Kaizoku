/**
 * SafeMultiSelect Component
 *
 * Type-safe multi-select component with runtime validation.
 * Prevents common MultiSelect crashes from type mismatches and null values.
 *
 * Features:
 * - Type-safe option handling
 * - Null/undefined protection
 * - Runtime validation
 * - Error recovery
 * - Consistent API with Mantine MultiSelect
 *
 * @module components/common/SafeMultiSelect
 */

import React, { useMemo, useCallback } from 'react';

import { MultiSelect } from '@mantine/core';

import { logger } from '@/utils/logger';

/**
 * Option type for SafeMultiSelect
 */
export interface SafeSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

/**
 * SafeMultiSelect props
 */
export interface SafeMultiSelectProps {
  /** Array of options or option groups - accepting flexible input */
  data?: SafeSelectOption[] | undefined | null;
  /** Selected values - accepting flexible input */
  value?: string[] | undefined | null;
  /** Change handler */
  onChange: (value: string[]) => void;
  /** Error handler for validation failures */
  onError?: (error: Error) => void;
  /** Validate option before selection */
  validateOption?: (option: SafeSelectOption) => boolean;
  /** Transform option before display */
  transformOption?: (option: SafeSelectOption) => SafeSelectOption;
  /** Debug mode for development */
  debug?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Enable search */
  searchable?: boolean;
  /** Enable clear button */
  clearable?: boolean;
  /** Maximum dropdown height */
  maxDropdownHeight?: number;
  /** Additional props for MultiSelect */
  [key: string]: unknown;
}

/**
 * SafeMultiSelect Component
 *
 * @example
 * ```tsx
 * <SafeMultiSelect
 *   data={options}
 *   value={selectedValues}
 *   onChange={setSelectedValues}
 *   placeholder="Select multiple options"
 *   searchable
 * />
 * ```
 */
export const SafeMultiSelect: React.FC<SafeMultiSelectProps> = (props): React.ReactElement | null => {
  const {
    data,
    value,
    onChange,
    onError,
    validateOption,
    transformOption,
    debug = false,
    placeholder = "Select options...",
    searchable = true,
    clearable = true,
    maxDropdownHeight = 220,
    ...restProps
  } = props;
  // Sanitize and validate data
  const safeData = useMemo(() => {
    try {
      if (!data) {
        if (debug) logger.warn('SafeMultiSelect: data is null/undefined');
        return [];
      }

      if (!Array.isArray(data)) {
        if (debug) logger.warn('SafeMultiSelect: data is not an array', data);
        return [];
      }

      // Filter and transform options
      const processedOptions = data.
      filter((option) => {
        // Type check
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- False positive, option can be null/undefined
        if (!option || typeof option !== 'object') {
          if (debug) logger.warn('SafeMultiSelect: Invalid option', option);
          return false;
        }

        // Required fields check
        if (!option.value || !option.label) {
          if (debug) logger.warn('SafeMultiSelect: Option missing value/label', option);
          return false;
        }

        // String type check
        if (typeof option.value !== 'string' || typeof option.label !== 'string') {
          if (debug) logger.warn('SafeMultiSelect: Option value/label not string', option);
          return false;
        }

        // Custom validation
        if (validateOption && !validateOption(option)) {
          if (debug) logger.warn('SafeMultiSelect: Option failed validation', option);
          return false;
        }

        return true;
      }).
      map((option) => {
        // Apply transformation if provided
        if (transformOption) {
          try {
            return transformOption(option);
          } catch (error: unknown) {
            if (debug) console.error('SafeMultiSelect: Transform failed', error);
            return option;
          }
        }
        return option;
      });

      // Remove duplicates by value
      const uniqueOptions = processedOptions.filter(
        (option, index, self) =>
        index === self.findIndex((o) => o.value === option.value)
      );

      if (debug && uniqueOptions.length !== processedOptions.length) {
        logger.warn('SafeMultiSelect: Removed duplicate options');
      }

      return uniqueOptions;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
      if (debug) console.error(errorMessage, error);
      if (onError) onError(new Error(errorMessage));
      return [];
    }
  }, [data, validateOption, transformOption, debug, onError]);

  // Sanitize value
  const safeValue = useMemo(() => {
    try {
      if (!value) {
        return [];
      }

      if (!Array.isArray(value)) {
        if (debug) logger.warn('SafeMultiSelect: value is not an array', value);
        return [];
      }

      // Filter to only include valid string values that exist in options
      const validValues = value.filter((v) => {
        if (typeof v !== 'string') {
          if (debug) logger.warn('SafeMultiSelect: Non-string value', v);
          return false;
        }

        // Check if value exists in options
        const exists = safeData.some((option) => option.value === v);
        if (!exists) {
          if (debug) logger.warn('SafeMultiSelect: Value not in options', v);
          return false;
        }

        return true;
      });

      return validValues;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
      if (debug) console.error(errorMessage, error);
      if (onError) onError(new Error(errorMessage));
      return [];
    }
  }, [value, safeData, debug, onError]);

  // Safe onChange handler
  const safeOnChange = useCallback((newValue: string[]) => {
    try {
      if (!Array.isArray(newValue)) {
        throw new Error('Invalid value type from MultiSelect');
      }

      // Validate all values
      const validValues = newValue.filter((v) => {
        if (typeof v !== 'string') {
          if (debug) logger.warn('SafeMultiSelect: Ignoring non-string value', v);
          return false;
        }
        return true;
      });

      onChange(validValues);
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
      if (debug) console.error(errorMessage, error);
      if (onError) onError(new Error(errorMessage));
    }
  }, [onChange, onError, debug]);

  // Error boundary for render
  try {
    return (
      <MultiSelect
        {...restProps}
        data={safeData}
        value={safeValue}
        onChange={safeOnChange}
        placeholder={placeholder}
        searchable={searchable}
        clearable={clearable}
        maxDropdownHeight={maxDropdownHeight} />);


  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
    if (debug) console.error(errorMessage, error);
    if (onError) onError(new Error(errorMessage));

    // Fallback UI
    return (
      <div style={{
        padding: '8px 12px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        color: '#666',
        fontSize: '14px'
      }}>
        {placeholder || 'Select options...'}
      </div>);

  }
};

/**
 * Hook for managing SafeMultiSelect state
 *
 * @example
 * ```tsx
 * const selectProps = useSafeMultiSelect({
 *   options: myOptions,
 *   defaultValue: ['option1'],
 * });
 *
 * return <SafeMultiSelect {...selectProps} />;
 * ```
 */
export interface UseSafeMultiSelectReturn {
  data: SafeSelectOption[] | undefined | null;
  value: string[];
  onChange: (newValue: string[]) => void;
  debug?: boolean;
}

export function useSafeMultiSelect(config: {
  options: SafeSelectOption[] | undefined | null;
  defaultValue?: string[];
  onSelectionChange?: (values: string[]) => void;
  debug?: boolean;
}): UseSafeMultiSelectReturn {
  const [value, setValue] = React.useState<string[]>(config.defaultValue ?? []);

  const handleChange = useCallback((newValue: string[]) => {
    setValue(newValue);
    if (config.onSelectionChange) {
      config.onSelectionChange(newValue);
    }
  }, [config]);

  return {
    data: config.options,
    value,
    onChange: handleChange,
    ...(config.debug !== undefined ? { debug: config.debug } : {})
  };
}

export default SafeMultiSelect;