/**
 * SafeSelector Component
 *
 * Type-safe single select component with runtime validation.
 * Prevents common Select crashes from type mismatches and null values.
 *
 * Features:
 * - Type-safe option handling
 * - Null/undefined protection
 * - Runtime validation
 * - Error recovery
 * - Consistent API with Mantine Select
 *
 * @module components/common/SafeSelector
 */

import React, { useMemo, useCallback } from 'react';

import { Select } from '@mantine/core';

import { logger } from '@/utils/logger';

/**
 * Option type for SafeSelector
 */
export interface SafeSelectorOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

/**
 * SafeSelector props
 */
export interface SafeSelectorProps {
  /** Array of options or option groups - accepting flexible input */
  data?: SafeSelectorOption[] | undefined | null;
  /** Selected value - accepting flexible input */
  value?: string | undefined | null;
  /** Change handler */
  onChange: (value: string | null) => void;
  /** Error handler for validation failures */
  onError?: (error: Error) => void;
  /** Validate option before selection */
  validateOption?: (option: SafeSelectorOption) => boolean;
  /** Transform option before display */
  transformOption?: (option: SafeSelectorOption) => SafeSelectorOption;
  /** Debug mode for development */
  debug?: boolean;
  /** Allow null selection */
  allowDeselect?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Enable search */
  searchable?: boolean;
  /** Enable clear button */
  clearable?: boolean;
  /** Maximum dropdown height */
  maxDropdownHeight?: number;
  /** Additional props for Select */
  [key: string]: unknown;
}

/**
 * SafeSelector Component
 *
 * @example
 * ```tsx
 * <SafeSelector
 *   data={options}
 *   value={selectedValue}
 *   onChange={setSelectedValue}
 *   placeholder="Select an option"
 *   searchable
 * />
 * ```
 */
export const SafeSelector: React.FC<SafeSelectorProps> = (props): React.ReactElement => {
  const {
    data,
    value,
    onChange,
    onError,
    validateOption,
    transformOption,
    debug = false,
    allowDeselect = true,
    placeholder = "Select an option...",
    searchable = true,
    clearable = true,
    maxDropdownHeight = 220,
    ...restProps
  } = props;
  // Sanitize and validate data
  const safeData = useMemo(() => {
    try {
      if (!data) {
        if (debug) logger.warn('SafeSelector: data is null/undefined');
        return [];
      }

      if (!Array.isArray(data)) {
        if (debug) logger.warn('SafeSelector: data is not an array', data);
        return [];
      }

      // Filter and transform options
      const processedOptions = data.
      filter((option) => {
        // Type check
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- False positive, option can be null/undefined
        if (!option || typeof option !== 'object') {
          if (debug) logger.warn('SafeSelector: Invalid option', option);
          return false;
        }

        // Required fields check
        if (!option.value || !option.label) {
          if (debug) logger.warn('SafeSelector: Option missing value/label', option);
          return false;
        }

        // String type check
        if (typeof option.value !== 'string' || typeof option.label !== 'string') {
          if (debug) logger.warn('SafeSelector: Option value/label not string', option);
          return false;
        }

        // Custom validation
        if (validateOption && !validateOption(option)) {
          if (debug) logger.warn('SafeSelector: Option failed validation', option);
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
            if (debug) console.error('SafeSelector: Transform failed', error);
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
        logger.warn('SafeSelector: Removed duplicate options');
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
      if (value === null || value === '') {
        return null;
      }

      if (typeof value !== 'string') {
        if (debug) logger.warn('SafeSelector: value is not a string', value);
        return null;
      }

      // Check if value exists in options
      const exists = safeData.some((option) => option.value === value);
      if (!exists) {
        if (debug) logger.warn('SafeSelector: Value not in options', value);
        return null;
      }

      return value;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
      if (debug) console.error(errorMessage, error);
      if (onError) onError(new Error(errorMessage));
      return null;
    }
  }, [value, safeData, debug, onError]);

  // Safe onChange handler
  const safeOnChange = useCallback((newValue: string | null) => {
    try {
      if (newValue === null) {
        onChange(null);
        return;
      }

      if (typeof newValue !== 'string') {
        throw new Error(`Invalid value type from Select: ${typeof newValue}`);
      }

      onChange(newValue);
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
      if (debug) console.error(errorMessage, error);
      if (onError) onError(new Error(errorMessage));
    }
  }, [onChange, onError, debug]);

  // Error boundary for render
  try {
    return (
      <Select
        {...restProps}
        data={safeData}
        value={safeValue}
        onChange={safeOnChange}
        placeholder={placeholder}
        searchable={searchable}
        clearable={clearable}
        maxDropdownHeight={maxDropdownHeight}
        allowDeselect={allowDeselect} />);


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
        {placeholder || 'Select an option...'}
      </div>);

  }
};

/**
 * Hook for managing SafeSelector state
 *
 * @example
 * ```tsx
 * const selectProps = useSafeSelector({
 *   options: myOptions,
 *   defaultValue: 'option1',
 * });
 *
 * return <SafeSelector {...selectProps} />;
 * ```
 */
export function useSafeSelector(config: {
  options: SafeSelectorOption[] | undefined | null;
  defaultValue?: string | null;
  onSelectionChange?: (value: string | null) => void;
  debug?: boolean;
}): {
  data: SafeSelectorOption[] | undefined | null;
  value: string | null;
  onChange: (newValue: string | null) => void;
  debug?: boolean;
} {
  const [value, setValue] = React.useState<string | null>(config.defaultValue ?? null);

  const handleChange = useCallback((newValue: string | null) => {
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

export default SafeSelector;