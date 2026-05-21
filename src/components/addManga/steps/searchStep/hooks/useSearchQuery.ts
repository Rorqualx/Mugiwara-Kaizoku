/**
 * useSearchQuery Hook
 *
 * Manages search query state and parsing.
 * Handles query changes, form synchronization, and provider suggestions.
 */

import { useState, useCallback } from 'react';
import type { ChangeEvent } from 'react';


import type { FormType } from '@/components/addManga/form';

import { parseSearchQuery } from '../helpers';

import type { ParsedSearchQuery } from '../types';
import type { UseSearchQueryReturn } from './types';
import type { UseFormReturnType } from '@mantine/form';

/**
 * Props for useSearchQuery hook
 */
interface UseSearchQueryProps {
  form: UseFormReturnType<FormType>;
  onProviderSuggested?: (provider: string) => void;
}

/**
 * Hook to manage search query state and parsing
 *
 * @param props - Hook configuration
 * @returns Query state and handlers
 *
 * @example
 * ```tsx
 * const { query, parsedQuery, handleQueryChange } = useSearchQuery({ form });
 * ```
 */
export function useSearchQuery({
  form,
  onProviderSuggested
}: UseSearchQueryProps): UseSearchQueryReturn {
  const [query, setQuery] = useState<string>('');
  const [parsedQuery, setParsedQuery] = useState<ParsedSearchQuery | null>(null);

  const handleQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.currentTarget.value;
    setQuery(value);
    form.setFieldValue('query', value);

    const parsed = parseSearchQuery(value);
    setParsedQuery(parsed);

    // Notify parent if a single provider is suggested
    const suggestedProvider = parsed.suggestedProviders?.[0];
    if (parsed.suggestedProviders?.length === 1 && suggestedProvider && onProviderSuggested) {
      onProviderSuggested(suggestedProvider);
    }
  }, [form, onProviderSuggested]);

  const setFormQuery = useCallback((value: string): void => {
    form.setFieldValue('query', value);
  }, [form]);

  return {
    query,
    parsedQuery,
    handleQueryChange,
    setFormQuery
  };
}
