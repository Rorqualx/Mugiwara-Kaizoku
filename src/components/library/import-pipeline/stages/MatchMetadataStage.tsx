/**
 * MatchMetadataStage Component
 *
 * Stage 3: Match scanned items with metadata from providers.
 *
 * @module components/library/import-pipeline/stages/MatchMetadataStage
 */

import { memo, useState, useCallback, type JSX } from 'react';

import {
  Stack,
  Group,
  Button,
  Text,
  Paper,
  Progress,
  Badge,
  SegmentedControl,
  Menu,
  ScrollArea,
  Table,
  ActionIcon,
  Tooltip,
  Image,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconX,
  IconDotsVertical,
  IconLoader2,
} from '@tabler/icons-react';

import { getConfidenceColor } from '../types';

import {
  formatFileSize,
  extractMatchDetails,
  EMPTY_MATCH_DETAILS,
} from './MatchMetadataStage/helpers';
import { SearchModal } from './SearchModal';

import type { MatchedMangaItem, MatchFilter, MatchProgress, MatchStats, BatchMatchAction, EnrichedProviderMatch } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface MatchMetadataStageProps {
  items: MatchedMangaItem[];
  progress: MatchProgress;
  stats: MatchStats;
  activeFilter: MatchFilter;
  isMatching: boolean;
  onFilterChange: (filter: MatchFilter) => void;
  onItemUnmatch: (itemId: string) => void;
  onItemSearch: (itemId: string, query: string) => Promise<void>;
  onItemSelectMatch: (itemId: string, match: EnrichedProviderMatch) => void;
  onBatchAction: (action: BatchMatchAction) => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

// ============================================================================
// Subcomponents
// ============================================================================

interface ProgressSectionProps {
  progress: MatchProgress;
  isMatching: boolean;
}

function ProgressSection({ progress, isMatching }: ProgressSectionProps): JSX.Element | null {
  if (!isMatching && progress.current === 0) return null;
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          {isMatching && (
            <IconLoader2
              size={16}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          )}
          <Text size="sm" fw={500}>
            {isMatching ? 'Searching providers for matches...' : 'Matching Progress'}
          </Text>
        </Group>
        <Text size="sm" c="dimmed">{progress.current} / {progress.total}</Text>
      </Group>
      <Progress value={pct} animated={isMatching} size="lg" color={isMatching ? 'blue' : 'green'} />
      {isMatching && (
        <Text size="xs" c="dimmed" mt="xs">
          Querying AniList, ComicVine, Fandom, and Wikipedia...
        </Text>
      )}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Paper>
  );
}

interface StatsBadgesProps {
  stats: MatchStats;
}

function StatsBadges({ stats }: StatsBadgesProps): JSX.Element {
  return (
    <Group gap="xs">
      <Badge color="green" variant="light">Matched: {stats.matched}</Badge>
      <Badge color="yellow" variant="light">Low Confidence: {stats.lowConfidence}</Badge>
      <Badge color="red" variant="light">No Match: {stats.noMatch}</Badge>
      <Badge color="gray" variant="light">Skipped: {stats.skipped}</Badge>
    </Group>
  );
}

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

interface BatchActionsMenuProps {
  onBatchAction: (action: BatchMatchAction) => void;
}

function BatchActionsMenu({ onBatchAction }: BatchActionsMenuProps): JSX.Element {
  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <Button variant="light" size="xs" rightSection={<IconDotsVertical size={14} />}>
          Batch Actions
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => onBatchAction('accept_high_confidence')}>
          Accept High Confidence (≥85%)
        </Menu.Item>
        <Menu.Item onClick={() => onBatchAction('accept_all_suggested')}>
          Accept All Suggested (≥50%)
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item onClick={() => onBatchAction('unmatch_low_confidence')}>
          Unmatch Low Confidence
        </Menu.Item>
        <Menu.Item onClick={() => onBatchAction('unmatch_all')} c="red">
          Unmatch All
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item onClick={() => onBatchAction('skip_unmatched')}>
          Skip All Unmatched
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

// ============================================================================
// Item Row Component
// ============================================================================

interface ItemRowProps {
  item: MatchedMangaItem;
  onUnmatch: (id: string) => void;
  onSearch: (id: string) => void;
}

function ItemRow({ item, onUnmatch, onSearch }: ItemRowProps): JSX.Element {
  const confidenceColor = item.selectedMatch ? getConfidenceColor(item.confidence) : 'gray';
  const confidencePct = Math.round(item.confidence * 100);
  const matchDetails = item.selectedMatch ? extractMatchDetails(item.selectedMatch.metadata) : EMPTY_MATCH_DETAILS;
  const alternativesCount = item.availableMatches.length;
  const metadata = item.selectedMatch?.metadata as Record<string, unknown> | undefined;
  const coverImage = metadata?.['coverImage'] as string | undefined;

  return (
    <Table.Tr>
      {/* Match Info (now first) */}
      <Table.Td style={{ maxWidth: 280 }}>
        {item.selectedMatch ? (
          <Group gap="sm" wrap="nowrap">
            {coverImage && (
              <Image src={coverImage} alt={item.selectedMatch.title} w={40} h={55} fit="cover" radius="sm" />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={500} lineClamp={1}>{item.selectedMatch.title}</Text>
              <Group gap="xs" mt={2}>
                <Badge size="xs" variant="outline" color="violet">
                  {item.selectedMatch.provider.toUpperCase()}
                </Badge>
                {matchDetails.year !== null && (
                  <Text size="xs" c="dimmed">{matchDetails.year}</Text>
                )}
                {matchDetails.issueCount !== null && (
                  <Text size="xs" c="dimmed">{matchDetails.issueCount} issues</Text>
                )}
              </Group>
              {matchDetails.publisher !== null && (
                <Text size="xs" c="dimmed" lineClamp={1} mt={2}>{matchDetails.publisher}</Text>
              )}
              {alternativesCount > 1 && (
                <Text size="xs" c="blue" mt={2}>+{alternativesCount - 1} alternatives</Text>
              )}
            </div>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">No match selected</Text>
        )}
      </Table.Td>
      {/* Source Info (now second) */}
      <Table.Td style={{ maxWidth: 220 }}>
        <Text size="sm" fw={500} lineClamp={1}>{item.parsedTitle}</Text>
        <Text size="xs" c="dimmed" lineClamp={1}>{item.path}</Text>
        <Group gap="xs" mt={4}>
          <Badge size="xs" variant="light" color="blue">
            {item.fileCount} files
          </Badge>
          <Badge size="xs" variant="light" color="gray">
            {formatFileSize(item.fileSize)}
          </Badge>
        </Group>
      </Table.Td>
      {/* Confidence */}
      <Table.Td>
        <Badge color={confidenceColor} variant="filled" size="sm">
          {item.selectedMatch ? `${confidencePct}%` : '-'}
        </Badge>
      </Table.Td>
      {/* Status */}
      <Table.Td>
        <StatusBadge status={item.status} />
      </Table.Td>
      {/* Actions */}
      <Table.Td>
        <Group gap="xs">
          <Tooltip label="Remove match">
            <ActionIcon
              size="sm"
              variant="light"
              color="red"
              onClick={() => onUnmatch(item.id)}
              disabled={!item.selectedMatch}
            >
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
          <Button size="xs" variant="light" onClick={() => onSearch(item.id)}>
            Confirm Series Metadata
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const colorMap: Record<string, string> = {
    matched: 'green',
    manual: 'blue',
    low_confidence: 'yellow',
    no_match: 'red',
    unmatched: 'gray',
    skipped: 'gray',
    matching: 'blue',
    error: 'red',
  };
  return <Badge color={colorMap[status] ?? 'gray'} size="sm" variant="light">{status}</Badge>;
}

// ============================================================================
// Main Component
// ============================================================================

function MatchMetadataStageComponent(props: MatchMetadataStageProps): JSX.Element {
  const {
    items, progress, stats, activeFilter, isMatching,
    onFilterChange, onItemUnmatch, onItemSearch, onItemSelectMatch,
    onBatchAction, onNext, onBack, canProceed,
  } = props;

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const selectedItem = selectedItemId !== null ? items.find((i) => i.id === selectedItemId) ?? null : null;

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
      <ProgressSection progress={progress} isMatching={isMatching} />
      <Group justify="space-between">
        <StatsBadges stats={stats} />
        <Group gap="xs">
          <FilterControl activeFilter={activeFilter} onFilterChange={onFilterChange} />
          <BatchActionsMenu onBatchAction={onBatchAction} />
        </Group>
      </Group>
      <Paper p="md" withBorder>
        <ScrollArea h={400}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Match</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Confidence</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed" ta="center" py="xl">No items to display</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onUnmatch={onItemUnmatch}
                    onSearch={handleOpenSearch}
                  />
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
      <Group justify="space-between" mt="md">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          Back
        </Button>
        <Button
          rightSection={<IconArrowRight size={16} />}
          onClick={onNext}
          disabled={!canProceed || isMatching}
        >
          Continue to Review
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

export const MatchMetadataStage = memo(MatchMetadataStageComponent);
MatchMetadataStage.displayName = 'MatchMetadataStage';
