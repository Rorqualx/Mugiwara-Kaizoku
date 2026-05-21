/**
 * DetectMatchStage Component
 *
 * Combined Stage 2: Progressive scanning and metadata matching.
 * Shows dual progress bars and real-time updates as items are discovered and matched.
 *
 * @module components/library/import-pipeline/stages/DetectMatchStage
 */

import { memo, useState, useCallback, useMemo, type JSX } from 'react';

import {
  Stack,
  Group,
  Button,
  Text,
  Paper,
  Badge,
  SegmentedControl,
  Table,
  ActionIcon,
  Tooltip,
  Checkbox,
  HoverCard,
  ScrollArea,
} from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconX } from '@tabler/icons-react';

import { getConfidenceColor } from '@/components/library/import-pipeline/types';
import type {
  MatchedMangaItem,
  MatchFilter,
  DetectMatchProgress,
  DetectMatchStats,
  EnrichedProviderMatch,
} from '@/components/library/import-pipeline/types';

import { SearchModal } from '../SearchModal';

import { LibraryFooters } from './LibraryFooters';
import { MatchDetails } from './MatchDetails';
import { DualProgress, LiveActivityFeed } from './ProgressComponents';
import { SortableTh, sortItems, type SortCol } from './sort';

// ============================================================================
// Types
// ============================================================================

export interface DetectMatchStageProps {
  progress: DetectMatchProgress;
  items: MatchedMangaItem[];
  stats: DetectMatchStats;
  activeFilter: MatchFilter;
  isActive: boolean;
  selectedForImport: Set<string>;
  onFilterChange: (filter: MatchFilter) => void;
  onItemUnmatch: (itemId: string) => void;
  onItemSearch: (itemId: string, query: string) => Promise<void>;
  onItemSelectMatch: (itemId: string, match: EnrichedProviderMatch) => void;
  onToggleSelect: (itemId: string, selected: boolean) => void;
  onCancel: () => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

// ============================================================================
// Stats Component
// ============================================================================

interface StatsBarProps {
  stats: DetectMatchStats;
}

function StatsBar({ stats, completeCount, selectedCount }: StatsBarProps & { completeCount: number; selectedCount: number }): JSX.Element {
  return (
    <Group gap="xs">
      <Badge color="blue" variant="light">Found: {stats.discovered}</Badge>
      <Badge color="green" variant="light">Matched: {stats.matched}</Badge>
      <Badge color="yellow" variant="light">Low Conf: {stats.lowConfidence}</Badge>
      <Badge color="red" variant="light">No Match: {stats.noMatch}</Badge>
      {stats.duplicates > 0 && <Badge color="teal" variant="light">In Library: {stats.duplicates}</Badge>}
      {completeCount > 0 && <Badge color="gray" variant="light">Complete: {completeCount}</Badge>}
      <Badge color="lime" variant="filled">Will import: {selectedCount}</Badge>
    </Group>
  );
}

// ============================================================================
// Filter Control
// ============================================================================

interface FilterControlProps {
  activeFilter: MatchFilter;
  onFilterChange: (filter: MatchFilter) => void;
}

function FilterControl({ activeFilter, onFilterChange }: FilterControlProps): JSX.Element {
  return (
    <SegmentedControl
      value={activeFilter}
      onChange={(v) => onFilterChange(v as MatchFilter)}
      data={[
        { label: 'All', value: 'all' },
        { label: 'Matched', value: 'matched' },
        { label: 'Needs Review', value: 'needs_review' },
        { label: 'Unmatched', value: 'unmatched' },
      ]}
      size="xs"
    />
  );
}

// ============================================================================
// Item Row Component
// ============================================================================

interface ItemRowProps {
  item: MatchedMangaItem;
  isSelected: boolean;
  onUnmatch: (id: string) => void;
  onSearch: (id: string) => void;
  onToggleSelect: (id: string, selected: boolean) => void;
}


function ItemRow({ item, isSelected, onUnmatch, onSearch, onToggleSelect }: ItemRowProps): JSX.Element {
  const confidenceColor = item.selectedMatch ? getConfidenceColor(item.confidence) : 'gray';
  const confidencePct = Math.round(item.confidence * 100);
  const isLibrary = item.selectedMatch?.provider === 'library';
  const canSelect = item.selectedMatch !== null;
  const tooltip = !canSelect
    ? 'Pick a match before selecting for import'
    : isLibrary
      ? 'Will merge files into the existing library entry'
      : 'Will create a new manga entry';

  return (
    <Table.Tr style={isSelected ? { background: 'rgba(57, 168, 96, 0.08)' } : undefined}>
      <Table.Td style={{ width: 40 }}>
        <Tooltip label={tooltip}>
          <Checkbox
            aria-label="Select for import"
            checked={isSelected}
            disabled={!canSelect}
            onChange={(e) => onToggleSelect(item.id, e.currentTarget.checked)}
          />
        </Tooltip>
      </Table.Td>
      <Table.Td style={{ maxWidth: 320 }}>
        <MatchDetails item={item} />
      </Table.Td>
      <Table.Td style={{ maxWidth: 240 }}>
        <Text size="sm" fw={500} lineClamp={1}>{item.parsedTitle}</Text>
        <Tooltip label={item.path} multiline maw={520} openDelay={300}>
          <Text size="xs" c="dimmed" lineClamp={1}>{item.path}</Text>
        </Tooltip>
        {(item.mergedCount ?? 1) > 1 && (
          <HoverCard width={520} shadow="md" position="bottom-start" withinPortal openDelay={150}>
            <HoverCard.Target>
              <Text size="xs" c="dimmed" mt={2} style={{ cursor: 'help', textDecoration: 'underline dotted' }}>
                Files from {item.mergedCount} folders ▾
              </Text>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Text size="xs" fw={500} mb={4}>{item.mergedCount} merged source folders:</Text>
              <ScrollArea h={Math.min(280, 22 * (item.mergedPaths?.length ?? 1) + 8)}>
                <Stack gap={2}>
                  {(item.mergedPaths ?? [item.path]).map((p) => (
                    <Text key={p} size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                      {p}
                    </Text>
                  ))}
                </Stack>
              </ScrollArea>
            </HoverCard.Dropdown>
          </HoverCard>
        )}
        <Group gap={4} mt={4}>
          <Badge size="xs" variant="light" color="blue">{item.fileCount} files</Badge>
          {item.year && <Badge size="xs" variant="light" color="gray">{item.year}</Badge>}
        </Group>
      </Table.Td>
      <Table.Td>
        <Badge color={confidenceColor} variant="filled" size="sm">
          {item.selectedMatch ? `${confidencePct}%` : '-'}
        </Badge>
      </Table.Td>
      <Table.Td>
        <StatusBadge status={item.status} isSearching={item.isSearching} isLibrary={isLibrary} />
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Tooltip label="Remove match">
            <ActionIcon size="sm" variant="light" color="red" onClick={() => onUnmatch(item.id)} disabled={!item.selectedMatch}>
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
          <Button size="xs" variant="light" onClick={() => onSearch(item.id)} disabled={item.isSearching}>
            {isLibrary ? 'Change Match' : 'Confirm Series Metadata'}
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

function StatusBadge({ status, isSearching, isLibrary }: { status: string; isSearching: boolean; isLibrary: boolean }): JSX.Element {
  if (isSearching) {
    return <Badge color="blue" size="sm" variant="light">Matching</Badge>;
  }
  if (isLibrary && status === 'matched') {
    return <Badge color="teal" size="sm" variant="light">In Library</Badge>;
  }
  const colorMap: Record<string, string> = {
    matched: 'green',
    manual: 'blue',
    low_confidence: 'yellow',
    no_match: 'red',
    unmatched: 'gray',
    skipped: 'gray',
    pending: 'gray',
    error: 'red',
  };
  const labelMap: Record<string, string> = {
    matched: 'Matched',
    manual: 'Manual',
    low_confidence: 'Low Confidence',
    no_match: 'No Match',
    unmatched: 'Unmatched',
    skipped: 'Skipped',
    pending: 'Pending',
    error: 'Error',
  };
  return <Badge color={colorMap[status] ?? 'gray'} size="sm" variant="light">{labelMap[status] ?? status}</Badge>;
}

// ============================================================================
// Main Component
// ============================================================================

function DetectMatchStageComponent(props: DetectMatchStageProps): JSX.Element {
  const {
    progress, items, stats, activeFilter, isActive, selectedForImport,
    onFilterChange, onItemUnmatch, onItemSearch, onItemSelectMatch, onToggleSelect,
    onCancel, onNext, onBack, canProceed,
  } = props;

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  /** Sort key + direction; null = preserve insertion order. Click cycles
   * none → asc → desc → none. */
  const [sortBy, setSortBy] = useState<{ col: SortCol; dir: 'asc' | 'desc' } | null>(null);
  const cycleSort = useCallback((col: SortCol): void => {
    setSortBy((prev) => {
      if (prev?.col !== col) return { col, dir: 'asc' };
      if (prev.dir === 'asc') return { col, dir: 'desc' };
      return null;
    });
  }, []);
  /** When true (default), IN_LIBRARY rows are hidden from the main table and
   * surfaced only in the collapsible footers. The user came here to deal with
   * new content; library rows that are auto-handled (top-up) shouldn't add
   * noise. */
  const [hideInLibrary, setHideInLibrary] = useState(true);

  const selectedItem = selectedItemId !== null ? items.find((i) => i.id === selectedItemId) ?? null : null;

  // Three buckets:
  //   - libraryComplete: IN_LIBRARY with newChapters === 0 (nothing to add)
  //   - libraryWithNew : IN_LIBRARY with newChapters > 0 OR not yet computed
  //   - active         : everything else (NEW / MATCHED / NO_MATCH / LOW_CONF)
  //
  // hideInLibrary=true (default) → main table = active only; both library
  // buckets surface as collapsible footers.
  // hideInLibrary=false           → main table = active + libraryWithNew.
  const { activeItems, libraryWithNewItems, completeItems } = useMemo(() => {
    const active: typeof items = [];
    const withNew: typeof items = [];
    const complete: typeof items = [];
    for (const it of items) {
      const isLibraryMatch = it.selectedMatch?.provider === 'library';
      if (!isLibraryMatch) { active.push(it); continue; }
      if (it.newChapters === 0) { complete.push(it); continue; }
      withNew.push(it);
    }
    return { activeItems: active, libraryWithNewItems: withNew, completeItems: complete };
  }, [items]);

  const baseVisibleItems = useMemo(
    () => hideInLibrary ? activeItems : [...activeItems, ...libraryWithNewItems],
    [hideInLibrary, activeItems, libraryWithNewItems]
  );
  const visibleItems = useMemo(
    () => sortBy ? sortItems(baseVisibleItems, sortBy.col, sortBy.dir) : baseVisibleItems,
    [baseVisibleItems, sortBy]
  );

  // Selection summary across the visible rows.
  const selectableItems = useMemo(() => visibleItems.filter((i) => i.selectedMatch !== null), [visibleItems]);
  const selectedVisibleCount = useMemo(
    () => selectableItems.reduce((n, i) => n + (selectedForImport.has(i.id) ? 1 : 0), 0),
    [selectableItems, selectedForImport]
  );
  const allSelected = selectableItems.length > 0 && selectedVisibleCount === selectableItems.length;
  const someSelected = selectedVisibleCount > 0 && !allSelected;
  const handleToggleAllVisible = useCallback((selected: boolean): void => {
    for (const i of selectableItems) {
      if (selectedForImport.has(i.id) !== selected) onToggleSelect(i.id, selected);
    }
  }, [selectableItems, selectedForImport, onToggleSelect]);

  const handleOpenSearch = useCallback((itemId: string): void => {
    setSelectedItemId(itemId);
  }, []);

  const handleCloseModal = useCallback((): void => {
    setSelectedItemId(null);
    setIsSearching(false);
  }, []);

  const handleSearch = useCallback(async (query: string): Promise<void> => {
    if (selectedItemId === null) return;
    setIsSearching(true);
    try {
      await onItemSearch(selectedItemId, query);
    } finally {
      setIsSearching(false);
    }
  }, [selectedItemId, onItemSearch]);

  const handleSelectMatch = useCallback((match: EnrichedProviderMatch): void => {
    if (selectedItemId === null) return;
    onItemSelectMatch(selectedItemId, match);
    handleCloseModal();
  }, [selectedItemId, onItemSelectMatch, handleCloseModal]);

  return (
    <Stack gap="lg">
      <DualProgress progress={progress} isActive={isActive} />

      {/* Live activity during processing */}
      {(isActive || items.some((i) => i.isSearching)) && (
        <LiveActivityFeed items={items} isActive={isActive} />
      )}

      <Group justify="space-between">
        <StatsBar stats={stats} completeCount={completeItems.length} selectedCount={selectedVisibleCount} />
        <Group gap="xs">
          {libraryWithNewItems.length + completeItems.length > 0 && (
            <Button
              size="xs"
              variant={hideInLibrary ? 'light' : 'filled'}
              color="teal"
              onClick={() => setHideInLibrary((v) => !v)}
            >
              {hideInLibrary
                ? `Show all (${libraryWithNewItems.length + completeItems.length} in-library hidden)`
                : `Hide in-library (${libraryWithNewItems.length + completeItems.length})`}
            </Button>
          )}
          <FilterControl activeFilter={activeFilter} onFilterChange={onFilterChange} />
        </Group>
      </Group>

      {/* No nested scroll - let page scroll naturally */}
      <Paper p="md" withBorder style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>
                <Tooltip label={allSelected ? 'Deselect all visible' : 'Select all visible'}>
                  <Checkbox
                    aria-label="Toggle all visible rows"
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={selectableItems.length === 0}
                    onChange={(e) => handleToggleAllVisible(e.currentTarget.checked)}
                  />
                </Tooltip>
              </Table.Th>
              <SortableTh label="Match" col="match" sortBy={sortBy} onCycle={cycleSort} />
              <SortableTh label="Source" col="source" sortBy={sortBy} onCycle={cycleSort} />
              <SortableTh label="Confidence" col="confidence" sortBy={sortBy} onCycle={cycleSort} />
              <SortableTh label="Status" col="status" sortBy={sortBy} onCycle={cycleSort} />
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibleItems.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed" ta="center" py="xl">
                    {isActive ? 'Waiting for items...' : 'No items to display'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              visibleItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedForImport.has(item.id)}
                  onUnmatch={onItemUnmatch}
                  onSearch={handleOpenSearch}
                  onToggleSelect={onToggleSelect}
                />
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      <LibraryFooters
        libraryWithNewItems={libraryWithNewItems}
        completeItems={completeItems}
        selectedForImport={selectedForImport}
        onToggleSelect={onToggleSelect}
        showLibraryWithNewSection={hideInLibrary}
      />

      <Group justify="space-between" mt="md">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
            Back
          </Button>
          {isActive && (
            <Button variant="light" color="red" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Group>
        <Button
          rightSection={<IconArrowRight size={16} />}
          onClick={onNext}
          disabled={!canProceed || isActive}
        >
          Continue to Review ({selectedVisibleCount})
        </Button>
      </Group>

      <SearchModal
        item={selectedItem}
        isOpen={selectedItemId !== null}
        isSearching={isSearching}
        onClose={handleCloseModal}
        onSearch={(q) => void handleSearch(q)}
        onSelect={handleSelectMatch}
      />
    </Stack>
  );
}

export const DetectMatchStage = memo(DetectMatchStageComponent);
DetectMatchStage.displayName = 'DetectMatchStage';
