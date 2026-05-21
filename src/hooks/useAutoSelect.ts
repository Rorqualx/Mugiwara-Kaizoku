import { useEffect, useRef } from 'react';

import { logger } from '../utils/logger';

/**
 * Options for configuring auto-select behavior
 */
interface AutoSelectOptions {
  /** Array of options with value and label */
  options: Array<{ value: string; label: string }>;
  /** Current selected value */
  currentValue: string | undefined | null;
  /** Callback to update the value */
  onChange: (value: string) => void;
  /** Name of the field for logging */
  fieldName: string;
  /** Whether to auto-select when there's only one option (default: true) */
  autoSelectSingle?: boolean;
  /** Whether to auto-select first option when value is empty (default: false) */
  autoSelectFirst?: boolean;
}

/**
 * Custom hook that automatically selects the first option in a dropdown
 * when there's only one option available or when options change
 */
export function useAutoSelect({
  options,
  currentValue,
  onChange,
  fieldName,
  autoSelectSingle = true,
  autoSelectFirst = false
}: AutoSelectOptions): boolean {
  const hasAutoSelected = useRef(false);
  const previousOptionsLength = useRef(0);
  const previousOptionsHash = useRef('');

  // Create a stable hash of options to detect real changes
  const optionsHash = JSON.stringify(options.map(o => o.value));

  useEffect(() => {
    // Skip if no options
    if (options.length === 0) {
      hasAutoSelected.current = false;
      previousOptionsLength.current = 0;
      previousOptionsHash.current = '';
      return;
    }

    // Check if options have actually changed (not just re-rendered)
    const optionsChanged = previousOptionsHash.current !== optionsHash;
    previousOptionsLength.current = options.length;
    previousOptionsHash.current = optionsHash;

    // Skip if options haven't actually changed
    if (!optionsChanged) {
      return;
    }

    // Auto-select single option
    if (autoSelectSingle && options.length === 1 && !hasAutoSelected.current) {
      const singleOption = options[0];
      if (singleOption && currentValue !== singleOption.value) {
        logger.info(`[useAutoSelect] Auto-selecting single option for ${fieldName}:`, {
          value: singleOption.value,
          label: singleOption.label
        });
        onChange(singleOption.value);
        hasAutoSelected.current = true;
      }
      return;
    }

    // Auto-select first option if enabled and no value is set
    if (autoSelectFirst && !currentValue && options.length > 0) {
      const firstOption = options[0];
      if (firstOption !== undefined) {
        logger.info(`[useAutoSelect] Auto-selecting first option for ${fieldName}:`, {
          value: firstOption.value,
          label: firstOption.label,
          totalOptions: options.length
        });
        onChange(firstOption.value);
        hasAutoSelected.current = true;
      }
      return;
    }

    // Reset auto-selected flag if options changed and we have multiple options
    if (options.length > 1) {
      hasAutoSelected.current = false;
    }
  }, [options, optionsHash, currentValue, onChange, fieldName, autoSelectSingle, autoSelectFirst]);

  return hasAutoSelected.current;
}

/**
 * Hook to auto-select the best/most complete option from multiple sources
 * Prioritizes options with more complete data or from preferred sources
 */
export function useSmartAutoSelect(
  options: Array<{ value: string; label: string }>,
  currentValue: string | undefined | null,
  onChange: (value: string) => void,
  fieldName: string,
  preferredProviders: string[] = ['anilist', 'mangadex', 'comicvine', 'fandom']
): boolean {
  const hasAutoSelected = useRef(false);
  const previousOptionsHash = useRef('');

  // Create a stable hash of options to detect real changes
  const optionsHash = JSON.stringify(options.map(o => o.value));

  useEffect(() => {
    // Skip if no options or already has value
    if (options.length === 0 || currentValue || hasAutoSelected.current) {
      return;
    }
    
    // Check if options have actually changed (not just re-rendered)
    const optionsChanged = previousOptionsHash.current !== optionsHash;
    previousOptionsHash.current = optionsHash;
    
    // Skip if options haven't actually changed
    if (!optionsChanged) {
      return;
    }

    // Try to find option from preferred provider
    for (const provider of preferredProviders) {
      const preferredOption = options.find(opt => 
        opt.label.toLowerCase().includes(provider.toLowerCase())
      );
      
      if (preferredOption) {
        logger.info(`[useSmartAutoSelect] Auto-selecting ${provider} option for ${fieldName}:`, {
          value: preferredOption.value,
          label: preferredOption.label
        });
        onChange(preferredOption.value);
        hasAutoSelected.current = true;
        return;
      }
    }

    // If no preferred provider found, select the first non-empty option
    const nonEmptyOption = options.find(opt => 
      opt.value && opt.value !== '' && opt.value !== 'null' && opt.value !== 'undefined'
    );
    
    if (nonEmptyOption) {
      logger.info(`[useSmartAutoSelect] Auto-selecting first valid option for ${fieldName}:`, {
        value: nonEmptyOption.value,
        label: nonEmptyOption.label
      });
      onChange(nonEmptyOption.value);
      hasAutoSelected.current = true;
    }
  }, [options, optionsHash, currentValue, onChange, fieldName, preferredProviders]);

  return hasAutoSelected.current;
}