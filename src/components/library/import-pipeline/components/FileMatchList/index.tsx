/**
 * FileMatchList Component
 *
 * Drop-in replacement for FileToChapterMatcher.
 * Flat inline list where each row shows file → matched chapter/volume.
 * Unmatched files sort to top with "Assign" popover.
 *
 * @module components/library/import-pipeline/components/FileMatchList
 */

import { memo, useReducer, useEffect, useCallback, useMemo, useState, type JSX } from 'react';

import {
  Stack,
  Text,
  Paper,
  Group,
  Badge,
  Switch,
  Divider,
  Progress,
} from '@mantine/core';
import { IconPlayerSkipForward } from '@tabler/icons-react';

import {
  calculateChapterMatchingStats,
  type ScannedFileInfo,
  type MetadataChapter,
  type MetadataVolume,
  type FileToChapterMapping,
  type ChapterMatchingStats,
  type EnrichedProviderMatch,
  type MetadataSource,
  type ExtractedMetadataResult,
} from '@/components/library/import-pipeline/types';
import {
  extractMetadataFromProvider,
  autoMatchFilesToChapters,
  manualMatchFileToChapter,
  manualMatchFileToVolume,
  unmatchFile,
  skipFile,
  initializeMappings,
  reparseFiles,
} from '@/components/library/import-pipeline/utils/chapter-matching-utils';

import { FileMatchRow } from './FileMatchRow';
import {
  sortMappingsForDisplay,
  getAvailableChapters,
  getAvailableVolumes,
} from './match-list-helpers';

// ============================================================================
// Types
// ============================================================================

export interface FileMatchListProps {
  files: ScannedFileInfo[];
  selectedMatch: EnrichedProviderMatch | null;
  onMappingsChange?: (mappings: Map<string, FileToChapterMapping>) => void;
}

interface MatchListState {
  volumes: MetadataVolume[];
  chapters: MetadataChapter[];
  mappings: Map<string, FileToChapterMapping>;
  stats: ChapterMatchingStats;
}

type MatchListAction =
  | { type: 'INIT'; files: ScannedFileInfo[]; volumes: MetadataVolume[]; chapters: MetadataChapter[] }
  | { type: 'MANUAL_MATCH'; filePath: string; chapterId: string }
  | { type: 'VOLUME_MATCH'; filePath: string; volumeId: string }
  | { type: 'UNMATCH'; filePath: string }
  | { type: 'SKIP'; filePath: string };

// ============================================================================
// Reducer
// ============================================================================

function createInitialState(): MatchListState {
  return {
    volumes: [],
    chapters: [],
    mappings: new Map(),
    stats: {
      totalFiles: 0,
      autoMatched: 0,
      manualMatched: 0,
      unmatched: 0,
      skipped: 0,
      duplicate: 0,
      totalMetadataChapters: 0,
      mappedMetadataChapters: 0,
    },
  };
}

function matchListReducer(state: MatchListState, action: MatchListAction): MatchListState {
  switch (action.type) {
    case 'INIT': {
      const reparsedFiles = reparseFiles(action.files);
      const initialized = initializeMappings(reparsedFiles);
      const mappings = autoMatchFilesToChapters(reparsedFiles, action.chapters, action.volumes);
      // Preserve any entries that auto-match missed (shouldn't happen, but safe)
      for (const [path, mapping] of initialized) {
        if (!mappings.has(path)) mappings.set(path, mapping);
      }
      return {
        volumes: action.volumes,
        chapters: action.chapters,
        mappings,
        stats: calculateChapterMatchingStats(mappings, action.chapters),
      };
    }

    case 'MANUAL_MATCH': {
      const file = state.mappings.get(action.filePath)?.file;
      const chapter = state.chapters.find((c) => c.id === action.chapterId);
      if (!file || !chapter) return state;
      const mappings = manualMatchFileToChapter(state.mappings, action.filePath, chapter, file);
      return { ...state, mappings, stats: calculateChapterMatchingStats(mappings, state.chapters) };
    }

    case 'VOLUME_MATCH': {
      const file = state.mappings.get(action.filePath)?.file;
      const volume = state.volumes.find((v) => v.id === action.volumeId);
      if (!file || !volume) return state;
      const mappings = manualMatchFileToVolume(state.mappings, action.filePath, volume.chapters, file);
      return { ...state, mappings, stats: calculateChapterMatchingStats(mappings, state.chapters) };
    }

    case 'UNMATCH': {
      const mappings = unmatchFile(state.mappings, action.filePath);
      return { ...state, mappings, stats: calculateChapterMatchingStats(mappings, state.chapters) };
    }

    case 'SKIP': {
      const mappings = skipFile(state.mappings, action.filePath);
      return { ...state, mappings, stats: calculateChapterMatchingStats(mappings, state.chapters) };
    }

    default:
      return state;
  }
}

// ============================================================================
// Subcomponents
// ============================================================================

function SummaryBar({ stats }: { stats: ChapterMatchingStats }): JSX.Element {
  const matched = stats.autoMatched + stats.manualMatched;
  const total = stats.totalFiles;
  const pct = total > 0 ? (matched / total) * 100 : 0;

  return (
    <Paper p="xs" withBorder bg="dark.7">
      <Group gap="xs" justify="space-between">
        <Group gap="xs">
          <Badge size="sm" color="green" variant="light">{matched} matched</Badge>
          {stats.unmatched > 0 && <Badge size="sm" color="orange" variant="light">{stats.unmatched} unmatched</Badge>}
          {stats.duplicate > 0 && <Badge size="sm" color="gray" variant="light">{stats.duplicate} duplicate</Badge>}
          {stats.skipped > 0 && <Badge size="sm" color="gray" variant="light">{stats.skipped} skipped</Badge>}
        </Group>
        <Text size="xs" c="dimmed">{matched}/{total} files</Text>
      </Group>
      <Progress value={pct} size="xs" color="green" mt="xs" />
    </Paper>
  );
}

// ============================================================================
// Main Component
// ============================================================================

function FileMatchListComponent(props: FileMatchListProps): JSX.Element {
  const { files, selectedMatch, onMappingsChange } = props;
  const [state, dispatch] = useReducer(matchListReducer, undefined, createInitialState);
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);

  // Extract metadata from provider
  const extractedMetadata: ExtractedMetadataResult = useMemo(() => {
    if (!selectedMatch) {
      return {
        volumes: [],
        chapters: [],
        source: 'synthetic' as MetadataSource,
        sourceProvider: 'none',
        totalChapters: 0,
        totalVolumes: 0,
      };
    }
    return extractMetadataFromProvider(selectedMatch, files.length, files);
  }, [selectedMatch, files]);

  // Initialize on mount / when data changes
  useEffect(() => {
    dispatch({
      type: 'INIT',
      files,
      volumes: extractedMetadata.volumes,
      chapters: extractedMetadata.chapters,
    });
  }, [files, extractedMetadata]);

  // Notify parent of mapping changes
  useEffect(() => {
    onMappingsChange?.(state.mappings);
  }, [state.mappings, onMappingsChange]);

  // Memoize available chapters/volumes for popover
  const availableChapters = useMemo(
    () => getAvailableChapters(state.chapters, state.mappings),
    [state.chapters, state.mappings]
  );
  const availableVolumes = useMemo(
    () => getAvailableVolumes(state.volumes, state.mappings),
    [state.volumes, state.mappings]
  );

  // Sort mappings
  const { active, skipped } = useMemo(
    () => sortMappingsForDisplay(state.mappings),
    [state.mappings]
  );

  // Optional filter
  const displayActive = unmatchedOnly
    ? active.filter((m) => m.status === 'unmatched')
    : active;

  // Callbacks
  const handleManualMatch = useCallback((filePath: string, chapterId: string) => {
    dispatch({ type: 'MANUAL_MATCH', filePath, chapterId });
  }, []);

  const handleVolumeMatch = useCallback((filePath: string, volumeId: string) => {
    dispatch({ type: 'VOLUME_MATCH', filePath, volumeId });
  }, []);

  const handleUnmatch = useCallback((filePath: string) => {
    dispatch({ type: 'UNMATCH', filePath });
  }, []);

  const handleSkip = useCallback((filePath: string) => {
    dispatch({ type: 'SKIP', filePath });
  }, []);

  if (!selectedMatch) {
    return (
      <Paper p="xl" withBorder>
        <Text size="sm" c="dimmed" ta="center">
          No metadata match selected. Go back and select a match first.
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      <SummaryBar stats={state.stats} />

      {state.stats.unmatched > 0 && (
        <Switch
          size="xs"
          label="Show unmatched only"
          checked={unmatchedOnly}
          onChange={(e) => setUnmatchedOnly(e.currentTarget.checked)}
        />
      )}

      {displayActive.length === 0 && skipped.length === 0 ? (
        <Paper p="md" withBorder>
          <Text size="sm" c="dimmed" ta="center">
            {unmatchedOnly ? 'All files are matched!' : 'No files to display'}
          </Text>
        </Paper>
      ) : (
        <>
          {displayActive.map((mapping) => (
            <FileMatchRow
              key={mapping.filePath}
              mapping={mapping}
              availableChapters={availableChapters}
              availableVolumes={availableVolumes}
              onManualMatch={handleManualMatch}
              onVolumeMatch={handleVolumeMatch}
              onUnmatch={handleUnmatch}
              onSkip={handleSkip}
            />
          ))}

          {skipped.length > 0 && !unmatchedOnly && (
            <>
              <Divider
                my="xs"
                label={
                  <Group gap="xs">
                    <IconPlayerSkipForward size={14} />
                    <Text size="xs" c="dimmed">Skipped ({skipped.length})</Text>
                  </Group>
                }
                labelPosition="center"
                color="dark.4"
              />
              {skipped.map((mapping) => (
                <FileMatchRow
                  key={mapping.filePath}
                  mapping={mapping}
                  availableChapters={availableChapters}
                  availableVolumes={availableVolumes}
                  onManualMatch={handleManualMatch}
                  onVolumeMatch={handleVolumeMatch}
                  onUnmatch={handleUnmatch}
                  onSkip={handleSkip}
                />
              ))}
            </>
          )}
        </>
      )}
    </Stack>
  );
}

export const FileMatchList = memo(FileMatchListComponent);
FileMatchList.displayName = 'FileMatchList';
