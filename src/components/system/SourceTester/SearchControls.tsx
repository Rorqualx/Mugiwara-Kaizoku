/**
 * SearchControls component for manga source testing
 *
 * Provides UI controls for:
 * - Source selection dropdown
 * - Search query input with predefined queries
 * - Search button and terminal toggle
 */
import React from 'react';

import { Box, Group, TextInput, Button, Select, ActionIcon, Tooltip, Menu } from '@mantine/core';
import { IconSearch, IconSourceCode, IconCode, IconList, IconCheck } from '@tabler/icons-react';

import { PREDEFINED_QUERIES } from './types';

export interface SearchControlsProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchQueryChange: (value: string) => void;
  /** Whether search is in progress */
  isSearching: boolean;
  /** Callback to execute search */
  onSearch: () => void;
  /** Current source name */
  sourceName: string;
  /** Available source names */
  availableSources: string[];
  /** Callback when source changes */
  onSourceChange: (value: string | null) => void;
  /** Whether to show source selector */
  showSourceSelector: boolean;
  /** Whether terminal is visible */
  showTerminal: boolean;
  /** Callback to toggle terminal */
  onToggleTerminal: () => void;
}

/**
 * SearchControls component
 * Renders search input, source selector, and action buttons
 */
export function SearchControls({
  searchQuery,
  onSearchQueryChange,
  isSearching,
  onSearch,
  sourceName,
  availableSources,
  onSourceChange,
  showSourceSelector,
  showTerminal,
  onToggleTerminal
}: SearchControlsProps): React.ReactElement {
  const handleQuerySelect = (value: string): void => {
    onSearchQueryChange(value);
  };

  return (
    <Group mb="md" align="flex-end">
      {showSourceSelector && (
        <Select
          label="Source"
          placeholder="Select source"
          data={availableSources.map((source) => ({ value: source, label: source }))}
          value={sourceName}
          onChange={onSourceChange}
          style={{ width: '150px' }}
          leftSection={<IconSourceCode size={16} />}
        />
      )}

      <Box style={{ flexGrow: 1 }}>
        <TextInput
          label="Search Query"
          placeholder="Search manga..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.currentTarget.value)}
          disabled={isSearching}
          leftSection={<IconSearch size={16} />}
          rightSection={
            <Menu>
              <Menu.Target>
                <ActionIcon size="sm">
                  <IconList size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Quick Searches</Menu.Label>
                {PREDEFINED_QUERIES.map((query) => (
                  <Menu.Item
                    key={query.value}
                    leftSection={
                      <IconCheck size={16} opacity={searchQuery === query.value ? 1 : 0} />
                    }
                    onClick={() => handleQuerySelect(query.value)}
                  >
                    {query.label}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          }
        />
      </Box>

      <Group>
        <Button
          onClick={onSearch}
          loading={isSearching}
          leftSection={<IconSearch size={16} />}
        >
          Search
        </Button>

        <Tooltip label={showTerminal ? "Hide Terminal" : "Show Terminal"}>
          <ActionIcon
            variant="light"
            color={showTerminal ? "gray" : "blue"}
            onClick={onToggleTerminal}
          >
            <IconCode size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}
