/**
 * ProviderSearchSection Component
 *
 * Search input section for finding manga across all providers.
 * Handles search input and triggers multi-provider search.
 *
 * @module components/addManga/steps/wizard/basic-info-step/components
 */

import React from 'react';

import {
  Stack,
  Text,
  TextInput,
  Button,
  Group,
  Alert
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

/**
 * Props for ProviderSearchSection component
 */
export interface ProviderSearchSectionProps {
  /** Current search input value */
  searchInput: string;
  /** Search input change handler */
  onSearchInputChange: (value: string) => void;
  /** Search trigger handler */
  onSearch: () => void;
  /** Search loading state */
  isSearching: boolean;
  /** Number of providers with results */
  resultCount: number;
  /** Original title for reset functionality */
  originalTitle: string;
  /** Whether search has been performed */
  hasSearched: boolean;
}

/**
 * ProviderSearchSection Component
 *
 * Provides search input and button for multi-provider manga search.
 * Shows result count and allows resetting to original title.
 */
export const ProviderSearchSection: React.FC<ProviderSearchSectionProps> = ({
  searchInput,
  onSearchInputChange,
  onSearch,
  isSearching,
  resultCount,
  originalTitle,
  hasSearched
}): React.ReactElement => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && searchInput.trim() && !isSearching) {
      onSearch();
    }
  };

  return (
    <Stack>
      <div>
        <Text fw={600} size="lg">Additional metadata sources</Text>
        <Text size="sm" c="dimmed">
          Search and select matching manga from other providers to combine their metadata.
        </Text>
      </div>

      {/* Search Input and Button */}
      <Group align="flex-end" gap="xs">
        <TextInput
          label="Search Title"
          placeholder="Enter title to search across all providers..."
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          description="Press Enter or click Search to search across all providers"
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <Button
          size="sm"
          onClick={onSearch}
          loading={isSearching}
          leftSection={<IconSearch size={14} />}
          disabled={!searchInput.trim()}
        >
          Search
        </Button>
      </Group>

      {/* Reset Button */}
      {searchInput.trim() && searchInput !== originalTitle && (
        <Button
          variant="subtle"
          size="xs"
          onClick={() => onSearchInputChange(originalTitle)}
        >
          Reset to original title
        </Button>
      )}

      {/* Results Count Alert */}
      {resultCount > 0 && (
        <Alert color="blue" mb="sm">
          Found results from {resultCount} providers
          {hasSearched && searchInput && ` for "${searchInput}"`}
        </Alert>
      )}
    </Stack>
  );
};

export default ProviderSearchSection;
