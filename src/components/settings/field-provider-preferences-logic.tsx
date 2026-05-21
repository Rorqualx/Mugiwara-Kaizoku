/**
 * Field Provider Preferences Business Logic
 *
 * Helper functions and state management logic for the FieldProviderPreferences component.
 * Extracted for better separation of concerns and testability.
 *
 * @module components/settings/field-provider-preferences-logic
 */
import { } from '@tabler/icons-react';

import {
  METADATA_FIELDS,
  DEFAULT_FIELD_PRIORITIES,
  FieldProviderPreferencesType
} from '@/types/search.types';
import { notify } from '@/utils/notify';

/**
 * Migrate old format preferences (string) to new format (string[])
 * Also adds any new providers that were added after preferences were saved
 */
export function migratePreferences(
  savedPrefs: Record<string, string | string[]>
): FieldProviderPreferencesType {
  const migratedPrefs: FieldProviderPreferencesType = {};

  METADATA_FIELDS.forEach((field) => {
    const savedValue = savedPrefs[field.value];
    const defaultPriority = DEFAULT_FIELD_PRIORITIES[field.value] ?? [];

    if (Array.isArray(savedValue)) {
      // Already in new format - but check for new providers that need to be added
      const missingProviders = defaultPriority.filter(p => !savedValue.includes(p));
      // Add missing providers at the end (lowest priority)
      migratedPrefs[field.value] = [...savedValue, ...missingProviders];
    } else if (typeof savedValue === 'string') {
      // Old format - migrate to array with saved value as primary + defaults as fallbacks
      const filteredDefaults = defaultPriority.filter(p => p !== savedValue);
      migratedPrefs[field.value] = [savedValue, ...filteredDefaults];
    } else {
      // No saved value - use defaults
      migratedPrefs[field.value] = defaultPriority;
    }
  });

  return migratedPrefs;
}

/**
 * Get default preferences for all metadata fields
 */
export function getDefaultPreferences(): FieldProviderPreferencesType {
  const defaultPrefs: FieldProviderPreferencesType = {};
  METADATA_FIELDS.forEach((field) => {
    defaultPrefs[field.value] = DEFAULT_FIELD_PRIORITIES[field.value] ?? [];
  });
  return defaultPrefs;
}

/**
 * Show success notification for saved preferences
 */
export function showSaveSuccessNotification(): void {
  notify({ severity: 'SUCCESS', title: 'Success', message: 'Provider preferences saved successfully' });
}

/**
 * Show error notification for failed save
 */
export function showSaveErrorNotification(message?: string): void {
  notify({ severity: 'ERROR', title: 'Error', message: message ?? 'Failed to save preferences' });
}

/**
 * Show notification when preferences are disabled
 */
export function showDisabledNotification(): void {
  notify({ severity: 'INFO', title: 'Preferences Disabled', message: 'The wizard will now use default provider selection' });
}
