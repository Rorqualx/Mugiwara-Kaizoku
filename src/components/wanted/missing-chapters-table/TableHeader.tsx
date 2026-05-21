/**
 * Table Header Component
 *
 * Column headers with sorting for missing chapters table.
 */

import React from 'react';

import { Table, Text, Group, Checkbox } from '@mantine/core';
import { IconChevronUp, IconChevronDown } from '@tabler/icons-react';

import type { SortField, SortDirection } from './sorting-helpers';

interface TableHeaderProps {
  isAllSelected: boolean;
  isIndeterminate: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  onSelectAll: () => void;
  onSort: (field: SortField) => void;
}

export function TableHeader({
  isAllSelected,
  isIndeterminate,
  sortField,
  sortDirection,
  onSelectAll,
  onSort
}: TableHeaderProps): React.ReactElement {
  const renderSortIcon = (field: SortField): JSX.Element | null => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />;
  };

  return (
    <Table.Thead>
      <Table.Tr>
        <Table.Th style={{ width: 50 }}>
          <Checkbox
            checked={isAllSelected}
            indeterminate={isIndeterminate}
            onChange={() => { void onSelectAll(); }}
          />
        </Table.Th>
        <Table.Th style={{ width: 60 }}>Cover</Table.Th>
        <Table.Th style={{ cursor: 'pointer' }} onClick={() => { void onSort('mangaTitle'); }}>
          <Group gap="xs">
            <Text size="sm" fw={500}>Manga</Text>
            {renderSortIcon('mangaTitle')}
          </Group>
        </Table.Th>
        <Table.Th style={{ cursor: 'pointer', width: 100 }} onClick={() => { void onSort('chapterNumber'); }}>
          <Group gap="xs">
            <Text size="sm" fw={500}>Chapter</Text>
            {renderSortIcon('chapterNumber')}
          </Group>
        </Table.Th>
        <Table.Th style={{ width: 250 }}>Chapter Title</Table.Th>
        <Table.Th style={{ cursor: 'pointer', width: 80 }} onClick={() => { void onSort('volumeNumber'); }}>
          <Group gap="xs">
            <Text size="sm" fw={500}>Volume</Text>
            {renderSortIcon('volumeNumber')}
          </Group>
        </Table.Th>
        <Table.Th style={{ cursor: 'pointer', width: 120 }} onClick={() => { void onSort('releaseDate'); }}>
          <Group gap="xs">
            <Text size="sm" fw={500}>Release Date</Text>
            {renderSortIcon('releaseDate')}
          </Group>
        </Table.Th>
        <Table.Th style={{ cursor: 'pointer', width: 80 }} onClick={() => { void onSort('pageCount'); }}>
          <Group gap="xs">
            <Text size="sm" fw={500}>Pages</Text>
            {renderSortIcon('pageCount')}
          </Group>
        </Table.Th>
        <Table.Th style={{ width: 100 }}>Status</Table.Th>
        <Table.Th style={{ width: 100 }}>Actions</Table.Th>
      </Table.Tr>
    </Table.Thead>
  );
}
