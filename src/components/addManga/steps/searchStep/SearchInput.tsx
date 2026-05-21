/**
 * SearchInput Component
 *
 * Search input field with help popover, provider selector,
 * and search/refresh button.
 *
 * Extracted from: searchStep.tsx (lines 1210-1337)
 */

import React, { type ChangeEvent } from 'react';

import {
  Paper,
  Group,
  Box,
  TextInput,
  Select,
  ActionIcon,
  Text,
  Badge,
  Divider,
  Code,
  Popover,
  Stack
} from '@mantine/core';
import {
  IconSearch,
  IconArrowRight,
  IconRefresh,
  IconInfoCircle
} from '@tabler/icons-react';

import type { AsyncResult } from '@/utils/async-result';

import { getSearchExamples, checkIsLoading } from './helpers';

import type { MetadataProvider, ParsedSearchQuery } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the SearchInput component
 */
interface SearchInputProps {
  /** Current search query */
  query: string;
  /** Parsed search query for special syntax display */
  parsedQuery: ParsedSearchQuery | null;
  /** Currently selected provider */
  selectedProvider: string;
  /** Available metadata providers */
  enabledSources: MetadataProvider[];
  /** Current search state */
  searchState: AsyncResult<unknown[], Error>;
  /** Whether search help popover is open */
  showSearchHelp: boolean;
  /** Last searched query for determining button state */
  lastSearchedQuery: string;
  /** Handler for query input changes */
  onQueryChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Handler for Enter key press */
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Handler for provider selection change */
  onProviderChange: (value: string | null) => void;
  /** Handler for search button click */
  onSearchClick: () => void;
  /** Handler for toggling search help */
  onToggleSearchHelp: (show: boolean) => void;
  /** Form field setter for query */
  setFormQuery: (value: string) => void;
}

// ============================================================================
// Styles
// ============================================================================

const inputStyles = {
  input: {
    fontSize: 'var(--mantine-font-size-md)',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#ffffff'
  },
  wrapper: {
    border: 'none'
  }
};

// ============================================================================
// Component
// ============================================================================

/**
 * SearchInput component for manga search with provider selection
 *
 * Features:
 * - Text input with placeholder guidance
 * - Help popover with search syntax examples
 * - Provider selector dropdown
 * - Search/refresh button with loading state
 * - Badge indicator for special query types
 */
export function SearchInput({
  query,
  parsedQuery,
  selectedProvider,
  enabledSources,
  searchState,
  showSearchHelp,
  lastSearchedQuery,
  onQueryChange,
  onKeyDown,
  onProviderChange,
  onSearchClick,
  onToggleSearchHelp,
  setFormQuery,
}: SearchInputProps): React.ReactElement {
  const isLoading = checkIsLoading(searchState);
  const isRefresh = lastSearchedQuery === query;

  return (
    <Paper
      p="xs"
      radius="xl"
      withBorder
      style={{
        borderColor: '#4d4d4d',
        backgroundColor: '#383838'
      }}
    >
      <Group gap="xs" align="center">
        {/* Search icon */}
        <Box pl="md">
          <IconSearch size={20} color="#cccccc" />
        </Box>

        {/* Search input with help button */}
        <Box style={{ flex: 1, position: 'relative' }}>
          <TextInput
            data-autofocus
            size="md"
            placeholder="Search by title, anilist:ID, isbn:number, or click ? for help"
            value={query}
            onChange={onQueryChange}
            onKeyDown={onKeyDown}
            styles={() => ({
              input: {
                ...inputStyles.input,
                paddingRight: '40px'
              },
              wrapper: inputStyles.wrapper
            })}
            rightSection={
              <Popover
                width={450}
                position="bottom-end"
                withArrow
                shadow="md"
                opened={showSearchHelp}
                onChange={onToggleSearchHelp}
              >
                <Popover.Target>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => onToggleSearchHelp(!showSearchHelp)}
                  >
                    <IconInfoCircle size={16} />
                  </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown style={{ backgroundColor: '#2C2C2C' }}>
                  <Stack gap="xs">
                    <Text size="sm" fw={500} c="#eeeeee">
                      Advanced Search Syntax
                    </Text>
                    <Divider color="#444444" />
                    <Stack gap="xs">
                      {getSearchExamples().map((example, idx) => (
                        <Group
                          key={idx}
                          gap="xs"
                          wrap="nowrap"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            onQueryChange({
                              currentTarget: { value: example.query }
                            } as ChangeEvent<HTMLInputElement>);
                            setFormQuery(example.query);
                            onToggleSearchHelp(false);
                          }}
                        >
                          <Code
                            style={{
                              backgroundColor: '#383838',
                              color: '#aaaaaa',
                              fontSize: '11px',
                              flex: 1,
                              cursor: 'pointer'
                            }}
                          >
                            {example.query}
                          </Code>
                          <Text
                            size="xs"
                            c="#999999"
                            style={{ minWidth: '140px' }}
                          >
                            {example.description}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                    <Divider color="#444444" />
                    <Text size="xs" c="#999999" fs="italic">
                      Click any example to use it
                    </Text>
                  </Stack>
                </Popover.Dropdown>
              </Popover>
            }
          />

          {parsedQuery && parsedQuery.type !== 'text' && (
            <Badge
              size="xs"
              variant="dot"
              color={
                parsedQuery.type === 'id'
                  ? 'blue'
                  : parsedQuery.type === 'isbn'
                    ? 'green'
                    : 'purple'
              }
              style={{
                position: 'absolute',
                top: -8,
                right: 8,
                zIndex: 1
              }}
            >
              {parsedQuery.type === 'id'
                ? 'ID Search'
                : parsedQuery.type === 'isbn'
                  ? 'ISBN Search'
                  : 'Filtered Search'}
            </Badge>
          )}
        </Box>

        {/* Divider */}
        <Box h={28} w={1} style={{ backgroundColor: '#4d4d4d' }} />

        {/* Provider selector */}
        <Select
          value={selectedProvider}
          onChange={onProviderChange}
          data={[
            { value: '', label: 'All providers' },
            ...enabledSources.map((provider: MetadataProvider) => ({
              value: provider.id,
              label: provider.name || provider.id
            }))
          ]}
          placeholder="Provider"
          style={{ width: '150px' }}
        />

        {/* Search/refresh button */}
        <Group gap="xs" pr="md">
          <ActionIcon
            size={34}
            radius="xl"
            variant="filled"
            color="blue"
            disabled={!query || isLoading || query.length < 3}
            onClick={onSearchClick}
            title={isRefresh ? 'Refresh search' : 'Search'}
          >
            {isRefresh ? (
              <IconRefresh size={18} strokeWidth={1.5} />
            ) : (
              <IconArrowRight size={18} strokeWidth={1.5} />
            )}
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
}

export default SearchInput;
