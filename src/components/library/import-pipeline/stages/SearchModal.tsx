/**
 * SearchModal Component
 *
 * AniList-only search modal for selecting metadata matches.
 * Single-click selection — backend enrichment pipeline handles all
 * other providers automatically after import.
 * Includes library search to match against existing manga in the app.
 *
 * @module components/library/import-pipeline/stages/SearchModal
 */

import { memo, useState, useCallback, useEffect, type JSX } from 'react';

import {
  Stack,
  Group,
  Button,
  Text,
  Paper,
  Badge,
  ScrollArea,
  Modal,
  TextInput,
  Loader,
  Card,
  Image,
  Box,
  SegmentedControl,
  Checkbox,
} from '@mantine/core';
import { IconSearch, IconBooks, IconWorld } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

import { getConfidenceColor } from '../types';

import type { MatchedMangaItem, EnrichedProviderMatch } from '../types';

type SearchMode = 'anilist' | 'library';

const NO_WRAP = 'nowrap' as const;

function normalizeSearchTitle(title: string): string {
  let normalized = title;
  normalized = normalized.replace(/\s*[[(][^\])]*(?:manga|scan|digital|sd|hd|web|raw|eng|jpn|group|release|\d{4}(?:-\d{4})?)[^\])]*[\])]/gi, '');
  normalized = normalized.replace(/\s*(?:v|vol\.?|volume)\s*\d+(?:-\d+)?/gi, '');
  normalized = normalized.replace(/\s*(?:c|ch\.?|chapter)\s*\d+(?:-\d+)?/gi, '');
  normalized = normalized.replace(/\s*[[(]\d{4}[\])]/g, '');
  normalized = normalized.replace(/\s*[[(](?:digital|scan|raw|hq|lq|sd|hd|web|webrip|cbz|cbr|pdf|epub)[\])]/gi, '');
  normalized = normalized.replace(/\s*[[(][A-Z0-9]{2,10}[\])]\s*$/gi, '');
  normalized = normalized.replace(/\s*\([^)]*(?:manga|digital|scan|raw|eng|jpn)\s*\)\s*$/gi, '');
  normalized = normalized.replace(/\s+\d+$/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized || title;
}

// ============================================================================
// Match metadata extraction
// ============================================================================

interface MatchCardMeta {
  coverImage: string | undefined;
  status: string | undefined;
  chapters: number | undefined;
  volumes: number | undefined;
  genres: string[];
  year: string | null;
}

function extractCardMeta(match: EnrichedProviderMatch): MatchCardMeta {
  const meta = match.metadata as Record<string, unknown> | undefined;
  const year = typeof meta?.['startYear'] === 'number'
    ? String(meta['startYear'])
    : typeof meta?.['year'] === 'number' || typeof meta?.['year'] === 'string'
      ? String(meta['year'])
      : null;

  return {
    coverImage: typeof meta?.['coverImage'] === 'string' ? meta['coverImage'] as string : undefined,
    status: typeof meta?.['status'] === 'string' ? meta['status'] as string : undefined,
    chapters: typeof meta?.['chapters'] === 'number' ? meta['chapters'] as number : undefined,
    volumes: typeof meta?.['volumes'] === 'number' ? meta['volumes'] as number : undefined,
    genres: Array.isArray(meta?.['genres']) ? (meta['genres'] as string[]).slice(0, 3) : [],
    year,
  };
}

const COVER_PLACEHOLDER_STYLE = {
  width: 50, height: 70, borderRadius: 4,
  backgroundColor: 'var(--mantine-color-dark-5)',
  display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
};

// ============================================================================
// AniListMatchCard
// ============================================================================

interface AniListMatchCardProps {
  match: EnrichedProviderMatch;
  onSelect: (match: EnrichedProviderMatch) => void;
}

function AniListMatchCard({ match, onSelect }: AniListMatchCardProps): JSX.Element {
  const confidencePct = Math.round(match.confidence * 100);
  const { coverImage, status, chapters, volumes, genres, year } = extractCardMeta(match);

  const detailParts = [
    chapters !== undefined ? `${chapters} ch` : null,
    volumes !== undefined ? `${volumes} vol` : null,
    genres.length > 0 ? genres.join(', ') : null,
  ].filter(Boolean).join(' · ');

  const statusColor = status === 'FINISHED' || status === 'completed' ? 'green' : 'blue';

  return (
    <Card p="sm" withBorder style={{ cursor: 'pointer' }} onClick={() => onSelect(match)}>
      <Group gap="md" wrap={NO_WRAP}>
        {coverImage
          ? <Image src={coverImage} alt={match.title} w={50} h={70} fit="cover" radius="sm" />
          : <div style={COVER_PLACEHOLDER_STYLE}><Text size="xs" c="dimmed">N/A</Text></div>}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap={NO_WRAP}>
            <Text size="sm" fw={500} lineClamp={1}>{match.title}</Text>
            <Badge color={getConfidenceColor(match.confidence)} size="xs">{confidencePct}%</Badge>
          </Group>
          <Group gap="xs" mt={4}>
            {year !== null && <Text size="xs" c="dimmed">{year}</Text>}
            {status && <Badge size="xs" variant="light" color={statusColor}>{status}</Badge>}
          </Group>
          {detailParts && <Text size="xs" c="dimmed" mt={2} lineClamp={1}>{detailParts}</Text>}
        </Box>
      </Group>
    </Card>
  );
}

// ============================================================================
// Library match conversion
// ============================================================================

function convertLibraryResult(manga: { id: string; title: string }): EnrichedProviderMatch {
  const mangaRecord = manga as Record<string, unknown>;
  let year: string | null = null;
  const startDate = mangaRecord['startDate'];
  if (startDate && typeof startDate === 'string') {
    year = new Date(startDate).getFullYear().toString();
  }
  const coverImage = (mangaRecord['coverImage'] ?? mangaRecord['cover'] ?? '') as string;
  const providerMetadata = mangaRecord['providerMetadata'] as Record<string, unknown> | null;
  const libraryChapters = mangaRecord['libraryChapters'] as Array<{
    id: string; number: number; title: string; volumeNumber?: number;
    coverImage?: string; pages?: number; releaseDate?: string; summary?: string;
  }> | null;
  const libraryVolumes = mangaRecord['libraryVolumes'] as Array<{
    id: number; number: number; title?: string; coverImage?: string;
    chapterStart?: number; chapterEnd?: number;
  }> | null;

  return {
    id: `library-${manga.id}`,
    providerId: String(mangaRecord['libraryId'] ?? manga.id),
    title: manga.title,
    provider: 'library',
    confidence: 1.0,
    metadata: {
      coverImage,
      description: (mangaRecord['description'] ?? '') as string,
      year,
      status: (mangaRecord['status'] ?? 'Unknown') as string,
      libraryId: mangaRecord['libraryId'] as number,
      inLibrary: true,
      ...providerMetadata,
      libraryChapters,
      libraryVolumes,
      volumes: mangaRecord['volumes'] as number | null,
      chapters: mangaRecord['chapters'] as number | null,
    },
  };
}

// ============================================================================
// Search input + mode controls
// ============================================================================

interface SearchControlsProps {
  item: MatchedMangaItem | null;
  searchMode: SearchMode;
  setSearchMode: (mode: SearchMode) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: () => void;
  currentlySearching: boolean;
  onlyWithoutFiles: boolean;
  setOnlyWithoutFiles: (v: boolean) => void;
}

function SearchControls(props: SearchControlsProps): JSX.Element {
  const {
    item, searchMode, setSearchMode, searchQuery, setSearchQuery,
    onSearch, currentlySearching, onlyWithoutFiles, setOnlyWithoutFiles,
  } = props;

  const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') onSearch();
  }, [onSearch]);

  return (
    <>
      {item !== null && (
        <Paper p="sm" withBorder bg="dark.6">
          <Text size="sm" fw={500}>Source: {item.parsedTitle}</Text>
          <Text size="xs" c="dimmed">{item.path}</Text>
        </Paper>
      )}

      <SegmentedControl
        value={searchMode}
        onChange={(v) => setSearchMode(v as SearchMode)}
        data={[
          { value: 'anilist', label: <Group gap="xs"><IconWorld size={14} /><Text size="sm">AniList</Text></Group> },
          { value: 'library', label: <Group gap="xs"><IconBooks size={14} /><Text size="sm">Library</Text></Group> },
        ]}
        fullWidth
      />

      <Group gap="xs">
        <TextInput
          placeholder={searchMode === 'anilist' ? 'Search AniList...' : 'Search your library...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <Button
          onClick={onSearch}
          disabled={currentlySearching}
          leftSection={currentlySearching ? <Loader size={14} /> : <IconSearch size={14} />}
        >
          Search
        </Button>
      </Group>

      {searchMode === 'library' && (
        <Checkbox
          label="Only show manga without files"
          description="Filter to library entries that don't have downloaded chapters"
          checked={onlyWithoutFiles}
          onChange={(e) => setOnlyWithoutFiles(e.currentTarget.checked)}
          size="sm"
        />
      )}
    </>
  );
}

// ============================================================================
// SearchModal
// ============================================================================

export interface SearchModalProps {
  item: MatchedMangaItem | null;
  isOpen: boolean;
  isSearching: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  onSelect: (match: EnrichedProviderMatch) => void;
}

function SearchModalComponent({ item, isOpen, isSearching, onClose, onSearch, onSelect }: SearchModalProps): JSX.Element {
  const normalizedTitle = item?.cleanTitle ? normalizeSearchTitle(item.cleanTitle) : '';
  const [searchQuery, setSearchQuery] = useState(normalizedTitle);
  const [searchMode, setSearchMode] = useState<SearchMode>('anilist');
  const [onlyWithoutFiles, setOnlyWithoutFiles] = useState(false);
  const itemId = item?.id;

  const librarySearchQuery = trpc.manga.searchLibrary.useQuery(
    { keyword: searchQuery.trim(), include: { library: true, metadata: true }, onlyWithoutFiles },
    { enabled: searchMode === 'library' && (searchQuery.trim().length > 0 || onlyWithoutFiles) }
  );

  const libraryMatches = (librarySearchQuery.data ?? []).map(convertLibraryResult);

  useEffect(() => {
    if (item?.cleanTitle) setSearchQuery(normalizeSearchTitle(item.cleanTitle));
  }, [itemId, item?.cleanTitle]);

  const handleSearch = useCallback((): void => {
    if (searchQuery.trim()) onSearch(searchQuery.trim());
  }, [searchQuery, onSearch]);

  const handleSelectMatch = useCallback((match: EnrichedProviderMatch): void => {
    onSelect(match);
  }, [onSelect]);

  const anilistMatches = (item?.availableMatches ?? [])
    .filter((m) => m.provider.toLowerCase() === 'anilist')
    .sort((a, b) => b.confidence - a.confidence);

  const currentMatches = searchMode === 'anilist' ? anilistMatches : libraryMatches;
  const isLibrarySearching = librarySearchQuery.isFetching;
  const currentlySearching = searchMode === 'anilist' ? isSearching : isLibrarySearching;

  return (
    <Modal opened={isOpen} onClose={onClose} title={<Text fw={600}>Select AniList Match</Text>} size="lg">
      <Stack gap="md">
        <SearchControls
          item={item}
          searchMode={searchMode}
          setSearchMode={setSearchMode}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          currentlySearching={currentlySearching}
          onlyWithoutFiles={onlyWithoutFiles}
          setOnlyWithoutFiles={setOnlyWithoutFiles}
        />

        <Box>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              {currentMatches.length > 0 ? `${currentMatches.length} Matches` : 'No matches found'}
            </Text>
            {searchMode === 'anilist' && <Text size="xs" c="dimmed">Click to select</Text>}
          </Group>
          <ScrollArea h={350}>
            <Stack gap="xs">
              {currentMatches.map((match) => (
                <AniListMatchCard key={match.id} match={match} onSelect={handleSelectMatch} />
              ))}
              {currentMatches.length === 0 && !currentlySearching && (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  {searchMode === 'library'
                    ? 'No manga found in your library. Try a different search term.'
                    : 'No AniList matches found. Try a different search query.'}
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Box>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export const SearchModal = memo(SearchModalComponent);
