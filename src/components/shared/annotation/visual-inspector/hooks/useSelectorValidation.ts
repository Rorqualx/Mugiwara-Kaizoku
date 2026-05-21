/**
 * Selector Validation Hook
 *
 * Custom hook for validating CSS/XPath selectors against a webpage.
 * Uses debouncing to prevent excessive API calls during typing.
 *
 * @module components/shared/annotation/visual-inspector/hooks/useSelectorValidation
 */

import { useMemo } from 'react';

import { useDebounce } from '@/hooks/common/useDebounce';
import { trpc } from '@/utils/trpc-client';
import { validateCssSelector } from '@/utils/validation/selectors';

import { EMPTY_VALIDATION_RESULT } from '../types';

import type {
  ExtractionType,
  SelectorType,
  SelectorValidationResult,
  UseSelectorValidationResult
} from '../types';

/**
 * Debounce delay for selector validation (ms)
 */
const DEBOUNCE_DELAY = 500;

/**
 * Hook for validating selectors with live preview
 *
 * Features:
 * - Debounced API calls (500ms delay)
 * - Local validation for immediate feedback
 * - Combines server response with local warnings/suggestions
 *
 * @param url - URL of the webpage to validate against
 * @param selector - The selector string to validate
 * @param extractType - Type of extraction (text, attribute, html)
 * @param attribute - Attribute name (when extractType is 'attribute')
 * @param enabled - Whether to enable the query
 * @param selectorType - Type of selector (css or xpath)
 */
// eslint-disable-next-line max-params -- Hook parameters represent distinct validation context: URL, selector, extraction config, and query state
export function useSelectorValidation(
  url: string,
  selector: string,
  extractType: ExtractionType,
  attribute: string | undefined,
  enabled: boolean,
  selectorType: SelectorType = 'css'
): UseSelectorValidationResult {
  // Debounce the selector to prevent excessive API calls
  const debouncedSelector = useDebounce(selector, DEBOUNCE_DELAY);

  // Perform local CSS validation for immediate feedback
  const localValidation = useMemo(() => {
    if (!selector || selectorType !== 'css') {
      return { warnings: [], suggestions: [], safetyIssues: [] };
    }

    const result = validateCssSelector(selector);
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const safetyIssues: string[] = [];

    if (!result.isValid) {
      safetyIssues.push(result.error ?? 'Invalid selector syntax');
    }

    if (result.suggestion) {
      // Parse suggestion string into array
      const suggestionParts = result.suggestion.split('; ');
      suggestions.push(...suggestionParts);
    }

    // Additional local warnings
    if (selector.includes('*')) {
      warnings.push('Universal selector (*) may be slow on large pages');
    }

    if (selector.split(' ').length > 5) {
      warnings.push('Deep nesting may make selector fragile');
    }

    if (/\[.*=.*\]/.test(selector) && !selector.includes('"') && !selector.includes("'")) {
      warnings.push('Attribute values should be quoted');
    }

    return { warnings, suggestions, safetyIssues };
  }, [selector, selectorType]);

  // Call the tRPC validation procedure
  const {
    data: serverData,
    isPending,
    isError,
    error,
    refetch
  } = trpc.nativeDownload.validateSelector.useQuery(
    {
      url,
      selector: debouncedSelector,
      selectorType,
      extractType,
      attribute
    },
    {
      enabled: enabled && !!debouncedSelector && !!url && localValidation.safetyIssues.length === 0,
      retry: 1,
      staleTime: 30000, // Cache for 30 seconds
      refetchOnWindowFocus: false
    }
  );

  // Combine server and local validation results
  const combinedResult = useMemo((): SelectorValidationResult | null => {
    // If local validation found safety issues, return immediately
    if (localValidation.safetyIssues.length > 0) {
      return {
        ...EMPTY_VALIDATION_RESULT,
        safetyIssues: localValidation.safetyIssues,
        warnings: localValidation.warnings,
        suggestions: localValidation.suggestions
      };
    }

    // If no server data yet, return null
    if (!serverData) {
      return null;
    }

    // Combine server and local results
    return {
      isValid: serverData.isValid,
      matchCount: serverData.matchCount,
      samples: serverData.samples,
      warnings: [...localValidation.warnings],
      suggestions: [...localValidation.suggestions],
      safetyIssues: []
    };
  }, [serverData, localValidation]);

  return {
    data: combinedResult,
    isPending: isPending && localValidation.safetyIssues.length === 0,
    isError,
    error: error?.message ?? null,
    refetch: () => void refetch()
  };
}
