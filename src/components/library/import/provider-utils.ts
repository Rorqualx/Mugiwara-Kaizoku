/**
 * Provider preference utilities for Import Library wizard.
 * Handles sorting and selecting metadata based on user provider preferences.
 */
import { DEFAULT_FIELD_PRIORITIES } from '@/types/search.types';

import type { ProviderMatch } from './types';

/** Get priority index for a provider based on title field preferences */
export function createProviderPriorityGetter(
  prefsEnabled: boolean,
  preferences: Record<string, string>
): (provider: string) => number {
  const titlePrefs = prefsEnabled && preferences['title']
    ? [preferences['title']]
    : DEFAULT_FIELD_PRIORITIES['title'] ?? [];
  return (provider: string): number => {
    const idx = titlePrefs.indexOf(provider);
    return idx === -1 ? 999 : idx;
  };
}

/** Sort matches by provider preference (preferred first) */
export function sortMatchesByPreference(
  matches: ProviderMatch[],
  getPriority: (provider: string) => number
): ProviderMatch[] {
  return [...matches].sort((a, b) => getPriority(a.provider) - getPriority(b.provider));
}

/** Get best match based on provider preferences */
export function getBestMatch(
  matches: ProviderMatch[],
  getPriority: (provider: string) => number
): ProviderMatch | null {
  if (matches.length === 0) return null;
  const sorted = sortMatchesByPreference(matches, getPriority);
  return sorted[0] ?? null;
}

/** Get best field value from matches based on field-specific provider preferences */
export function getFieldValue<T>(
  matches: ProviderMatch[],
  field: string,
  getter: (match: ProviderMatch) => T | null,
  prefsEnabled: boolean,
  getPreferredProvider: (field: string) => string | null
): T | null {
  if (matches.length === 0) return null;
  const preferredProvider = prefsEnabled ? getPreferredProvider(field) : null;
  const defaultPriority = DEFAULT_FIELD_PRIORITIES[field] ?? [];
  const priorityOrder = preferredProvider ? [preferredProvider] : defaultPriority;
  for (const provider of priorityOrder) {
    const match = matches.find((m) => m.provider === provider);
    if (match) {
      const value = getter(match);
      if (value !== null && value !== undefined && value !== '') return value;
    }
  }
  for (const match of matches) {
    const value = getter(match);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}
