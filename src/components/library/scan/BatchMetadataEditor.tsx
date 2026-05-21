/**
 * Batch Metadata Editor Component
 *
 * Allows batch selection and application of metadata matches for multiple manga.
 * Refactored into modular architecture for maintainability.
 *
 * Architecture:
 * - types.ts - Type definitions
 * - utils.ts - Utility functions
 * - hooks/useMatchStates.ts - State management hook
 * - hooks/useStats.ts - Statistics computation hook
 * - components/MatchCard.tsx - Match display component
 * - components/MangaItem.tsx - Manga item component
 *
 * Original: 382 lines → Refactored: ~100 lines (74% reduction)
 */

import React from 'react';

import {
  Modal,
  Stack,
  Group,
  Text,
  TextInput,
  Badge,
  ScrollArea,
  Divider,
  Progress,
  Button,
  Tabs,
} from '@mantine/core';
import {
  IconSearch,
  IconCheck,
  IconX,
  IconAlertCircle,
} from '@tabler/icons-react';

import { MangaItem } from './batch-metadata-editor/components/MangaItem';
import { useMatchStates } from './batch-metadata-editor/hooks/useMatchStates';
import { useStats } from './batch-metadata-editor/hooks/useStats';

import type { BatchMetadataEditorProps } from './batch-metadata-editor/types';

/**
 * BatchMetadataEditor Component
 *
 * Main orchestration component for batch metadata matching
 */
export function BatchMetadataEditor({
  manga,
  onSave,
  onCancel,
  fetchMatches,
}: BatchMetadataEditorProps): JSX.Element {
  // Use custom hooks for state management
  const {
    matchStates,
    searchQuery,
    setSearchQuery,
    expandedManga,
    activeTab,
    setActiveTab,
    isSaving,
    filteredManga,
    handleSelectMatch,
    handleToggleExpanded,
    handleRetry,
    handleSave,
  } = useMatchStates({ manga, fetchMatches, onSave });

  const stats = useStats(matchStates);

  return (
    <Modal
      opened
      onClose={onCancel}
      size="xl"
      title="Match Metadata"
      closeOnClickOutside={!isSaving}
      closeOnEscape={!isSaving}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          Review and select the correct metadata match for each manga
        </Text>

        <Group justify="space-between">
          <TextInput
            placeholder="Search manga..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e): void => setSearchQuery(e.currentTarget.value)}
            style={{ flex: 1 }}
          />

          {stats.isLoading > 0 && (
            <Badge variant="light">Loading: {stats.isLoading}</Badge>
          )}
        </Group>

        <Tabs value={activeTab} onChange={(value): void => setActiveTab(value ?? 'all')}>
          <Tabs.List>
            <Tabs.Tab value="all">All ({stats.total})</Tabs.Tab>
            <Tabs.Tab value="matched" leftSection={<IconCheck size={16} />}>
              Matched ({stats.matched})
            </Tabs.Tab>
            <Tabs.Tab value="unmatched">Unmatched ({stats.unmatched})</Tabs.Tab>
            <Tabs.Tab value="no-results" leftSection={<IconAlertCircle size={16} />}>
              No Results ({stats.noResults})
            </Tabs.Tab>
            {stats.errors > 0 && (
              <Tabs.Tab value="errors" leftSection={<IconX size={16} />} color="red">
                Errors ({stats.errors})
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs>

        <Divider />

        <ScrollArea h={400}>
          <Stack gap="sm">
            {filteredManga.map((state) => (
              <MangaItem
                key={state.manga.id}
                state={state}
                isExpanded={expandedManga.has(state.manga.id)}
                onToggleExpanded={handleToggleExpanded}
                onSelectMatch={handleSelectMatch}
                onRetry={handleRetry}
              />
            ))}
          </Stack>
        </ScrollArea>

        {isSaving && (
          <>
            <Divider />
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Applying metadata...
              </Text>
              <Progress value={100} animated />
            </Stack>
          </>
        )}

        <Divider />

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {stats.matched} of {stats.total} manga matched
          </Text>

          <Group>
            <Button variant="default" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={(): void => {
                void handleSave();
              }}
              disabled={stats.matched === 0 || isSaving}
              loading={isSaving}
            >
              Apply Metadata to {stats.matched} Manga
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
