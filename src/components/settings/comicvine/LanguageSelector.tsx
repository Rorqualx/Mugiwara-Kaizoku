/**
 * Language Selector for ComicVine Settings
 *
 * Allows users to select their preferred language for filtering
 * ComicVine search results to prioritize specific language editions.
 */
import React from 'react';

import { Select, Text, Stack } from '@mantine/core';

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Available language options for ComicVine filtering
 */
const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'any', label: 'Any Language (no filtering)' },
];

/**
 * Language selector component for ComicVine settings
 */
export function LanguageSelector({
  value,
  onChange,
  disabled = false,
}: LanguageSelectorProps): React.ReactElement {
  return (
    <Stack gap="xs">
      <Select
        label="Preferred Language"
        description="Prioritize results in this language when searching ComicVine"
        placeholder="Select language"
        data={LANGUAGE_OPTIONS}
        value={value}
        onChange={(newValue) => {
          if (newValue) {
            onChange(newValue);
          }
        }}
        disabled={disabled}
        searchable
        clearable={false}
      />
      <Text size="xs" c="dimmed">
        Non-preferred language editions will be deprioritized in search results.
      </Text>
    </Stack>
  );
}
