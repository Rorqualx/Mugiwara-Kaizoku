/**
 * PagesTable Filter Bar & Bulk Actions
 *
 * Extracted from PagesTable to reduce complexity.
 */

import React from 'react';

import {
  Text,
  Group,
  TextInput,
  Select,
  Checkbox,
  Button,
} from '@mantine/core';
import {
  IconSearch,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';

interface FilterBarProps {
  searchQuery: string;
  sourceFilter: string | null;
  statusFilter: string | null;
  pageSize: number;
  onSearchChange: (value: string) => void;
  onSourceFilterChange: (value: string | null) => void;
  onStatusFilterChange: (value: string | null) => void;
  onPageSizeChange: (value: string | null) => void;
  selectedCount: number;
  refetchHtml: boolean;
  onRefetchHtmlChange: (checked: boolean) => void;
  onBulkReprocess: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  isReprocessing: boolean;
  isDeleting: boolean;
}

export function FilterBar({
  searchQuery,
  sourceFilter,
  statusFilter,
  pageSize,
  onSearchChange,
  onSourceFilterChange,
  onStatusFilterChange,
  onPageSizeChange,
  selectedCount,
  refetchHtml,
  onRefetchHtmlChange,
  onBulkReprocess,
  onBulkDelete,
  onClearSelection,
  isReprocessing,
  isDeleting,
}: FilterBarProps): React.ReactElement {
  return (
    <Group justify="space-between">
      <Group>
        <TextInput
          placeholder="Search by URL or title..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          w={250}
        />
        <Select
          placeholder="Source"
          clearable
          data={[
            { value: 'FANDOM', label: 'Fandom' },
            { value: 'WIKIPEDIA', label: 'Wikipedia' },
            { value: 'ANILIST', label: 'AniList' },
            { value: 'COMICVINE', label: 'ComicVine' },
          ]}
          value={sourceFilter}
          onChange={onSourceFilterChange}
          w={130}
        />
        <Select
          placeholder="Status"
          clearable
          data={[
            { value: 'BOOTSTRAP', label: 'Bootstrap' },
            { value: 'AGENT_REVIEWED', label: 'Agent Reviewed' },
            { value: 'IN_PROGRESS', label: 'In Progress' },
            { value: 'REVIEWED', label: 'Reviewed' },
            { value: 'GOLD', label: 'Gold' },
            { value: 'REJECTED', label: 'Rejected' },
          ]}
          value={statusFilter}
          onChange={onStatusFilterChange}
          w={140}
        />
        <Select
          data={[
            { value: '10', label: '10 per page' },
            { value: '25', label: '25 per page' },
            { value: '50', label: '50 per page' },
            { value: '100', label: '100 per page' },
            { value: '200', label: '200 per page' },
            { value: '400', label: '400 per page' },
            { value: '600', label: '600 per page' },
            { value: '800', label: '800 per page' },
            { value: '1000', label: '1000 per page' },
          ]}
          value={pageSize.toString()}
          onChange={onPageSizeChange}
          w={140}
        />
      </Group>

      {/* Bulk Actions */}
      <Group gap="sm">
        {selectedCount > 0 && (
          <Text size="sm" c="dimmed">{selectedCount} selected</Text>
        )}
        <Checkbox
          label="Refetch HTML"
          size="xs"
          checked={refetchHtml}
          onChange={(e) => onRefetchHtmlChange(e.currentTarget.checked)}
        />
        <Button
          size="xs"
          variant="light"
          leftSection={<IconRefresh size={14} />}
          onClick={onBulkReprocess}
          loading={isReprocessing}
          disabled={selectedCount === 0}
        >
          Reprocess
        </Button>
        {selectedCount > 0 && (
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={onBulkDelete}
            loading={isDeleting}
          >
            Delete
          </Button>
        )}
        {selectedCount > 0 && (
          <Button size="xs" variant="subtle" onClick={onClearSelection}>
            Clear
          </Button>
        )}
      </Group>
    </Group>
  );
}
