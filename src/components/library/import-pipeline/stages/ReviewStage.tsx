/**
 * ReviewStage Component
 *
 * Stage 4: Review and confirm items before import with detailed
 * file-to-chapter mapping and metadata display.
 *
 * @module components/library/import-pipeline/stages/ReviewStage
 */

import { memo, useState, useCallback, type JSX } from 'react';

import {
  Stack,
  Group,
  Button,
  Text,
  Paper,
  Checkbox,
  Badge,
  Divider,
  Image,
  Collapse,
  ActionIcon,
  Tooltip,
  Box,
  Progress,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconDownload,
  IconBook,
  IconCalendar,
  IconTags,
  IconChevronUp,
  IconPhoto,
  IconLink,
  IconSearch,
  IconRefresh,
} from '@tabler/icons-react';

import { FileMatchList } from '../components/FileMatchList';
import {
  getMetadataSourceLabel,
  getMetadataSourceColor,
  calculateChapterMatchingStats,
  type MatchedMangaItem,
  type ImportOptions,
  type FileToChapterMapping,
  type EnrichedProviderMatch,
} from '../types';
import { extractMetadataFromProvider } from '../utils/chapter-matching-utils';

import { ImportOptionsSection } from './ImportOptionsSection';
import { formatFileSize, extractMetadata, type MatchMetadata } from './review-stage-helpers';
import { SearchModal } from './SearchModal';

// ============================================================================
// Types
// ============================================================================

export interface ReviewStageProps {
  items: MatchedMangaItem[];
  selectedIds: Set<string>;
  importOptions: ImportOptions;
  onSelectionChange: (itemId: string, selected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onOptionsChange: (options: Partial<ImportOptions>) => void;
  onChapterMappingsChange: (itemId: string, mappings: Map<string, FileToChapterMapping>) => void;
  onItemSearch: (itemId: string, query: string) => Promise<void>;
  onItemSelectMatch: (itemId: string, match: EnrichedProviderMatch | null) => void;
  onResetAllMappings: () => void;
  onNext: () => void;
  onBack: () => void;
  canProceed: boolean;
}

// ============================================================================
// Subcomponents
// ============================================================================

function SelectionSummary({ total, selected, onSelectAll, onDeselectAll, onResetAll }: {
  total: number;
  selected: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onResetAll: () => void;
}): JSX.Element {
  return (
    <Group justify="space-between">
      <Group gap="xs">
        <Badge size="lg" variant="filled" color="blue">{selected} / {total}</Badge>
        <Text size="sm" c="dimmed">selected for import</Text>
      </Group>
      <Group gap="xs">
        <Button size="xs" variant="subtle" leftSection={<IconRefresh size={14} />} onClick={onResetAll}>
          Reset All
        </Button>
        <Button size="xs" variant="light" onClick={onSelectAll}>Select All</Button>
        <Button size="xs" variant="light" onClick={onDeselectAll}>Deselect All</Button>
      </Group>
    </Group>
  );
}
function CoverImage({ src, alt }: { src: string | null; alt: string }): JSX.Element {
  if (src) {
    return <Image src={src} alt={alt} w={80} h={120} fit="cover" radius="sm" fallbackSrc="https://placehold.co/80x120?text=No+Cover" />;
  }
  return (
    <Box w={80} h={120} bg="dark.6" style={{ borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <IconPhoto size={24} color="gray" />
    </Box>
  );
}

function MetadataRow({ meta, fileCount }: { meta: MatchMetadata; fileCount: number }): JSX.Element {
  return (
    <Group gap="sm" wrap="wrap">
      <Group gap={4}><IconBook size={12} color="gray" /><Text size="xs" c="dimmed">{meta.issueCount ?? fileCount} ch{meta.volumeCount ? ` / ${meta.volumeCount} vol` : ''}</Text></Group>
      {meta.year && <Group gap={4}><IconCalendar size={12} color="gray" /><Text size="xs" c="dimmed">{meta.year}</Text></Group>}
      {meta.publisher && <Group gap={4}><IconTags size={12} color="gray" /><Text size="xs" c="dimmed" lineClamp={1}>{meta.publisher}</Text></Group>}
      {meta.status && <Badge size="xs" variant="dot" color={meta.status === 'FINISHED' ? 'green' : 'blue'}>{meta.status}</Badge>}
    </Group>
  );
}

function GenreTags({ genres }: { genres: string[] }): JSX.Element | null {
  if (genres.length === 0) return null;
  return (
    <Group gap={4}>
      {genres.slice(0, 4).map((g) => <Badge key={g} size="xs" variant="light" color="gray">{g}</Badge>)}
      {genres.length > 4 && <Text size="xs" c="dimmed">+{genres.length - 4}</Text>}
    </Group>
  );
}

// ============================================================================
// Item Card with File Matching
// ============================================================================

interface ItemCardProps {
  item: MatchedMangaItem;
  isSelected: boolean;
  onToggle: (id: string, sel: boolean) => void;
  onChapterMappingsChange: (itemId: string, mappings: Map<string, FileToChapterMapping>) => void;
  onSearch: (query: string) => Promise<void>;
  onSelectMatch: (match: EnrichedProviderMatch | null) => void;
}

// eslint-disable-next-line complexity -- Item card with file matching, search, status badges, and action buttons
function ItemCardImpl({ item, isSelected, onToggle, onChapterMappingsChange, onSearch, onSelectMatch }: ItemCardProps): JSX.Element {
  const [showMatcher, setShowMatcher] = useState(true); // Default expanded to show file matching
  const [showSearch, setShowSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      await onSearch(query);
    } finally {
      setIsSearching(false);
    }
  }, [onSearch]);

  const hasMatch = item.selectedMatch !== null;
  const meta = hasMatch ? extractMetadata(item.selectedMatch?.metadata) : null;
  const files = item.files ?? [];
  const hasFiles = files.length > 0 || item.fileCount > 0;

  // Extract metadata source from provider match
  const metadataResult = hasMatch && item.selectedMatch
    ? extractMetadataFromProvider(item.selectedMatch, item.fileCount, files)
    : null;
  const sourceLabel = metadataResult
    ? getMetadataSourceLabel(metadataResult.source, metadataResult.sourceProvider, metadataResult.totalVolumes > 0)
    : null;
  const sourceColor = metadataResult
    ? getMetadataSourceColor(metadataResult.source)
    : 'gray';

  const handleMappingsChange = useCallback((newMappings: Map<string, FileToChapterMapping>) => {
    onChapterMappingsChange(item.id, newMappings);
  }, [item.id, onChapterMappingsChange]);

  // Calculate matching stats for this item
  const extractedChapters = metadataResult?.chapters ?? [];
  const matchingStats = calculateChapterMatchingStats(item.chapterMappings, extractedChapters);
  const matchedCount = matchingStats.autoMatched + matchingStats.manualMatched;
  // Use item.fileCount as fallback when mappings haven't been initialized yet
  const totalFiles = matchingStats.totalFiles > 0 ? matchingStats.totalFiles : item.fileCount;
  const matchProgress = totalFiles > 0 ? (matchedCount / totalFiles) * 100 : 0;

  return (
    <Paper p="md" withBorder mb="sm">
      <Group align="flex-start" wrap="nowrap">
        <Checkbox
          checked={isSelected}
          onChange={(e) => onToggle(item.id, e.currentTarget.checked)}
          disabled={!hasMatch}
          mt={4}
        />
        <CoverImage src={meta?.coverImage ?? null} alt={item.parsedTitle} />
        <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap">
            <Box style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} lineClamp={1}>{hasMatch ? item.selectedMatch?.title : item.parsedTitle}</Text>
              {hasMatch && item.selectedMatch?.title !== item.parsedTitle && (
                <Text size="xs" c="dimmed" lineClamp={1}>← {item.parsedTitle}</Text>
              )}
            </Box>
            <Group gap="xs">
              <Badge
                color={hasMatch ? 'green' : item.status === 'skipped' ? 'gray' : 'red'}
                size="sm"
                variant="light"
              >
                {hasMatch ? 'Ready' : item.status === 'skipped' ? 'Skipped' : 'No Match'}
              </Badge>
              <Tooltip label="Search for match">
                <ActionIcon size="sm" variant="light" color="yellow" onClick={() => setShowSearch(true)}>
                  <IconSearch size={14} />
                </ActionIcon>
              </Tooltip>
              {hasFiles && hasMatch && (
                <Tooltip label={showMatcher ? 'Hide file matching' : 'Match files to chapters'}>
                  <ActionIcon size="sm" variant={showMatcher ? 'filled' : 'light'} color="blue" onClick={() => setShowMatcher(!showMatcher)}>
                    {showMatcher ? <IconChevronUp size={14} /> : <IconLink size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Group>

          {hasMatch && meta && <MetadataRow meta={meta} fileCount={item.fileCount} />}

          <Group gap="xs" wrap="wrap">
            {hasMatch && sourceLabel && (
              <Badge size="xs" variant="filled" color={sourceColor}>{sourceLabel}</Badge>
            )}
            <Badge size="xs" variant="light" color="blue">{item.fileCount} files</Badge>
            <Text size="xs" c="dimmed">{formatFileSize(item.fileSize)}</Text>
          </Group>

          {meta && <GenreTags genres={meta.genres} />}

          {/* File matching progress - inline in card */}
          {hasFiles && hasMatch && (
            <Group gap="xs" align="center">
              <Progress value={matchProgress} size="sm" color="green" style={{ flex: 1 }} />
              <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{matchedCount}/{totalFiles} matched</Text>
              {totalFiles - matchedCount > 0 && (
                <Badge size="xs" color="orange" variant="light">{totalFiles - matchedCount} unmatched</Badge>
              )}
            </Group>
          )}
        </Stack>
      </Group>

      {hasFiles && hasMatch && (
        <Collapse in={showMatcher}>
          <Divider my="md" />
          {files.length > 0 ? (
            <FileMatchList
              files={files}
              selectedMatch={item.selectedMatch}
              onMappingsChange={handleMappingsChange}
            />
          ) : (
            <Paper p="md" withBorder bg="dark.8">
              <Text size="sm" c="dimmed" ta="center">
                File details not available. Re-scan the directory to enable file-to-chapter matching.
              </Text>
            </Paper>
          )}
        </Collapse>
      )}

      {/* Search Modal for manual matching - only mounted when open */}
      {showSearch && (
        <SearchModal
          item={item}
          isOpen={showSearch}
          isSearching={isSearching}
          onClose={() => setShowSearch(false)}
          onSearch={(q) => void handleSearch(q)}
          onSelect={(match) => {
            onSelectMatch(match);
            setShowSearch(false);
          }}
        />
      )}
    </Paper>
  );
}

// Memoize to skip re-rendering when neither the item identity nor selection state
// changed. Parent callbacks (onSearch, onSelectMatch, onToggle, onChapterMappingsChange)
// are recreated every parent render but invoke through stable parent-side useCallbacks,
// so a stale closure still routes correctly.
const ItemCard = memo(
  ItemCardImpl,
  (prev, next) => prev.item === next.item && prev.isSelected === next.isSelected
);

// ============================================================================
// Main Component
// ============================================================================

function ReviewStageComponent(props: ReviewStageProps): JSX.Element {
  const {
    items,
    selectedIds,
    importOptions,
    onSelectionChange,
    onSelectAll,
    onDeselectAll,
    onOptionsChange,
    onChapterMappingsChange,
    onItemSearch,
    onItemSelectMatch,
    onResetAllMappings,
    onNext,
    onBack,
    canProceed,
  } = props;

  // When true (default) IN_LIBRARY rows (including top-up rows that have new
  // chapters to add) are hidden from the main list. They're handled by the
  // existing `topUpExisting` import option and the user came here to deal with
  // new content. Mirror of the Detect & Match stage's `hideInLibrary` toggle.
  const [hideInLibrary, setHideInLibrary] = useState(true);
  // Default to showing only items the user actually selected at Detect & Match —
  // rendering all 98 rows when only 13 are selected is confusing and made
  // unrelated wrong matches feel like the import would touch them. Toggle stays
  // available so the user can see the full set if needed.
  const [showSelectedOnly, setShowSelectedOnly] = useState(true);

  // Always exclude rows without a match and rows where library content already
  // has every chapter on disk (nothing to do for those regardless of toggle).
  const allImportable = items.filter((i) => {
    if (i.selectedMatch === null) return false;
    if (i.selectedMatch.provider === 'library' && i.newChapters === 0) return false;
    return true;
  });
  const libraryTopUpItems = allImportable.filter((i) => i.selectedMatch?.provider === 'library');
  const inLibraryFiltered = hideInLibrary
    ? allImportable.filter((i) => i.selectedMatch?.provider !== 'library')
    : allImportable;
  const importableItems = showSelectedOnly
    ? inLibraryFiltered.filter((i) => selectedIds.has(i.id))
    : inLibraryFiltered;
  const hiddenUnselectedCount = inLibraryFiltered.length - importableItems.length;
  const completeCount = items.filter((i) => i.selectedMatch?.provider === 'library' && i.newChapters === 0).length;
  const selectedCount = selectedIds.size;

  return (
    <Stack gap="lg">
      <SelectionSummary
        total={importableItems.length}
        selected={selectedCount}
        onSelectAll={onSelectAll}
        onDeselectAll={onDeselectAll}
        onResetAll={onResetAllMappings}
      />

      {(libraryTopUpItems.length > 0 || completeCount > 0 || hiddenUnselectedCount > 0) && (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {completeCount > 0 && <>Hidden: {completeCount} manga already complete (no new chapters). </>}
            {hideInLibrary && libraryTopUpItems.length > 0 && (
              <>Hidden: {libraryTopUpItems.length} already-in-library top-ups. </>
            )}
            {showSelectedOnly && hiddenUnselectedCount > 0 && (
              <>Hidden: {hiddenUnselectedCount} unselected.</>
            )}
          </Text>
          <Group gap="xs">
            {hiddenUnselectedCount > 0 || !showSelectedOnly ? (
              <Button
                size="xs"
                variant={showSelectedOnly ? 'light' : 'filled'}
                color="blue"
                onClick={() => setShowSelectedOnly((v) => !v)}
              >
                {showSelectedOnly
                  ? `Show all (${inLibraryFiltered.length})`
                  : `Show selected only (${selectedCount})`}
              </Button>
            ) : null}
            {libraryTopUpItems.length > 0 && (
              <Button
                size="xs"
                variant={hideInLibrary ? 'light' : 'filled'}
                color="teal"
                onClick={() => setHideInLibrary((v) => !v)}
              >
                {hideInLibrary
                  ? `Show in-library (${libraryTopUpItems.length})`
                  : `Hide in-library (${libraryTopUpItems.length})`}
              </Button>
            )}
          </Group>
        </Group>
      )}

      {/* No nested scroll - let page scroll naturally */}
      {importableItems.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text size="sm" c="dimmed" ta="center">
            {hideInLibrary && libraryTopUpItems.length > 0
              ? 'No new manga to import. Toggle "Show in-library" above to review existing-manga top-ups.'
              : 'No items ready. Go back and match first.'}
          </Text>
        </Paper>
      ) : (
        <Stack gap="sm">
          {importableItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onToggle={onSelectionChange}
              onChapterMappingsChange={onChapterMappingsChange}
              onSearch={(query) => onItemSearch(item.id, query)}
              onSelectMatch={(match) => onItemSelectMatch(item.id, match)}
            />
          ))}
        </Stack>
      )}

      <ImportOptionsSection options={importOptions} onChange={onOptionsChange} />

      <Divider />

      <Group justify="space-between">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={onBack}>
          Back
        </Button>
        <Button
          rightSection={<IconDownload size={16} />}
          onClick={onNext}
          disabled={!canProceed || selectedCount === 0}
        >
          Import {selectedCount}
        </Button>
      </Group>
    </Stack>
  );
}

export const ReviewStage = memo(ReviewStageComponent);
ReviewStage.displayName = 'ReviewStage';
