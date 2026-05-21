/**
 * SourceTester component for testing manga source providers
 *
 * This component provides a comprehensive testing interface for manga sources,
 * allowing users to search for manga, view chapters, and test source functionality.
 * Features include:
 * - Manga search with predefined queries
 * - Source selection and management
 * - Chapter listing and details
 * - Terminal output for debugging
 * - JSON and text result parsing
 *
 * @remarks
 * Testing Features:
 * - Search: Test source search functionality
 * - Chapters: Test chapter listing and metadata
 * - Terminal: View raw command output
 * - Source Selection: Test different manga sources
 *
 * Result Parsing:
 * - JSON Mode: Parse structured JSON output
 * - Text Mode: Fallback to text parsing
 * - Error Handling: Comprehensive error display
 *
 * @example
 * ```tsx
 * // Basic usage with default source
 * function TestPage() {
 *   return (
 *     <SourceTester />
 *   );
 * }
 *
 * // Usage with specific source
 * function ManganeloTester() {
 *   return (
 *     <SourceTester sourceName="manganelo" />
 *   );
 * }
 * ```
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

import { Box, Text, Paper, Group, Stack, Button, Loader, Collapse } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

import { logger } from '@/utils/logger';

import {
  SearchControls,
  TerminalPanel,
  SearchResultsGrid,
  ChaptersAccordion
} from './SourceTester/';
import {
  extractCommandOutput,
  parseChaptersResults,
  parseSearchResults,
  isMangalJsonManga,
  isMangalJsonChapterArray,
  type MangalJsonChapter
} from './SourceTester/utils';

import type { MangaResult, ChapterResult } from './SourceTester/';

/**
 * Interface for mangal command parameters
 */
interface MangalCommandParams {
  /** Command to execute */
  command: string;
  /** Optional ID for context */
  id?: number;
  /** Optional title for context */
  title?: string;
  /** Optional monitoring config */
  monitoringConfig?: string;
}

/**
 * Interface for mangal command output
 */
interface MangalCommandOutput {
  stdout: string;
  stderr: string;
}

/**
 * Interface for mangal command result with custom output
 */
interface MangalCommandResult {
  id: number;
  title: string;
  monitoringConfig: string;
  mangalOutput: MangalCommandOutput;
}

/**
 * Props for the SourceTester component
 */
interface SourceTesterProps {
  /** Optional source name to test (defaults to 'manganelo') */
  sourceName?: string;
}

export function SourceTester({ sourceName: initialSourceName }: SourceTesterProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('one piece');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MangaResult[]>([]);
  const [selectedManga, setSelectedManga] = useState<MangaResult | null>(null);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sourceName, setSourceName] = useState(initialSourceName ?? 'manganelo');
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string>('');
  const terminalRef = useRef<HTMLDivElement>(null);

  // Create a mock mangal command executor
  const mangalCommand = React.useMemo(() => ({
    mutateAsync: (params: MangalCommandParams): Promise<MangalCommandResult> => Promise.resolve({
      id: 0,
      title: '',
      monitoringConfig: '',
      mangalOutput: {
        stdout: 'Mock output for command: ' + params.command,
        stderr: ''
      }
    }),
    mutate: (): void => { },
    isLoading: false,
    isPending: false
  }), []);

  // Fetch available sources
  const fetchAvailableSources = useCallback(async (): Promise<void> => {
    try {
      const result = await mangalCommand.mutateAsync({
        command: 'sources',
        id: 0,
        title: 'Get Sources',
        monitoringConfig: ''
      });

      const output = extractCommandOutput(result);

      if (output.stdout) {
        const sources = output.stdout.split('\n').filter(Boolean);
        setAvailableSources(sources);
      } else {
        setAvailableSources(['manganelo', 'mangakakalot', 'mangasee', 'mangapark']);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to fetch sources:', errorMessage);
      setAvailableSources(['manganelo', 'mangakakalot', 'mangasee', 'mangapark']);
    }
  }, [mangalCommand]);

  /**
   * Process search results from mangal command output
   */
  const processSearchResults = useCallback((output: { stdout: string; stderr: string }): void => {
    if (output.stdout) {
      try {
        const fixedJson = '[' + output.stdout.replace(/}{/g, '},{') + ']';
        const jsonResults: unknown = JSON.parse(fixedJson);

        if (!Array.isArray(jsonResults)) {
          throw new Error('Invalid JSON structure: expected array');
        }

        const mangaResults: MangaResult[] = jsonResults.map(
          (item: unknown, index: number): MangaResult => {
            if (typeof item !== 'object' || item === null) {
              return {
                id: `manga-${index}`,
                title: 'Unknown',
                url: '',
                source: sourceName,
                index
              };
            }

            const resultItem = item as Record<string, unknown>;
            const mangalData = resultItem['mangal'];

            if (isMangalJsonManga(mangalData)) {
              return {
                id: mangalData.id,
                title: mangalData.name,
                url: mangalData.url,
                source:
                  typeof resultItem['source'] === 'string'
                    ? resultItem['source']
                    : sourceName,
                status: mangalData.status ?? 'Unknown',
                description: mangalData.description ?? '',
                coverUrl: mangalData.coverUrl ?? '/cover-not-found.jpg',
                index
              };
            }

            return {
              id: `manga-${index}`,
              title: 'Unknown',
              url: typeof resultItem['address'] === 'string' ? resultItem['address'] : '',
              source: sourceName,
              index
            };
          }
        );

        setSearchResults(mangaResults);
      } catch (_jsonError: unknown) {
        const mangaResults = parseSearchResults(output.stdout, sourceName);
        setSearchResults(mangaResults);
      }
    } else if (output.stderr) {
      setError(`Error: ${output.stderr}`);
      setTerminalOutput((prev) => `${prev}\nError: ${output.stderr}`);
    } else {
      setError('No results found');
    }
  }, [sourceName]);

  // Execute search for manga using tRPC
  const searchManga = useCallback(async (): Promise<void> => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setSelectedManga(null);

    try {
      const searchCommand = `inline -q "${searchQuery}" -j`;
      const result = await mangalCommand.mutateAsync({
        command: searchCommand,
        id: 0,
        title: `Search: ${searchQuery}`,
        monitoringConfig: ''
      });

      const output = extractCommandOutput(result);
      setTerminalOutput((prev) => `${prev}\n$ mangal ${searchCommand}\n${output.stdout}`);

      processSearchResults(output);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to search: ${errorMessage}`);
      setTerminalOutput((prev) => `${prev}\nError: ${errorMessage}`);
    } finally {
      setIsSearching(false);
    }
  }, [mangalCommand, searchQuery, processSearchResults]);

  /**
   * Process chapters results from mangal command output
   */
  const processChaptersResults = useCallback((output: { stdout: string; stderr: string }, manga: MangaResult): void => {
    if (output.stdout) {
      try {
        const jsonResult: unknown = JSON.parse(output.stdout);

        if (typeof jsonResult !== 'object' || jsonResult === null) {
          throw new Error('Invalid JSON result');
        }

        const resultObj = jsonResult as Record<string, unknown>;
        const mangalData = resultObj['mangal'];

        if (isMangalJsonManga(mangalData) && isMangalJsonChapterArray(mangalData.chapters)) {
          const chapters: ChapterResult[] = mangalData.chapters.map(
            (chapter: MangalJsonChapter, index: number): ChapterResult => ({
              title: chapter.name,
              number: chapter.index.toString(),
              url: chapter.url,
              date: chapter.date,
              index
            })
          );

          if (chapters.length > 0) {
            setSelectedManga({ ...manga, chapters });
          } else {
            setError('No chapters found for this manga');
          }
        } else {
          const chapters = parseChaptersResults(output.stdout);
          if (chapters.length > 0) {
            setSelectedManga({ ...manga, chapters });
          } else {
            setError('No chapters found for this manga');
          }
        }
      } catch (_jsonError: unknown) {
        const chapters = parseChaptersResults(output.stdout);
        if (chapters.length > 0) {
          setSelectedManga({ ...manga, chapters });
        } else {
          setError('No chapters found for this manga');
        }
      }
    } else if (output.stderr) {
      setError(`Error: ${output.stderr}`);
      setTerminalOutput((prev) => `${prev}\nError: ${output.stderr}`);
    } else {
      setError('No chapters found for this manga');
    }
  }, []);

  // Get chapters for a selected manga using tRPC
  const getChapters = async (manga: MangaResult): Promise<void> => {
    if (!manga.id) {
      setError('Cannot get chapters: Missing manga ID');
      return;
    }

    setIsLoadingChapters(true);
    setError(null);
    setSelectedManga(manga);

    try {
      const mangaIndex = manga.index ?? 0;
      const chaptersCommand = `inline -q "${searchQuery}" --manga ${mangaIndex} -j`;

      const result = await mangalCommand.mutateAsync({
        command: chaptersCommand,
        id: 0,
        title: `Chapters: ${manga.title}`,
        monitoringConfig: ''
      });

      const output = extractCommandOutput(result);
      setTerminalOutput((prev) => `${prev}\n$ mangal ${chaptersCommand}\n${output.stdout}`);

      processChaptersResults(output, manga);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Failed to get chapters: ${errorMessage}`);
      setTerminalOutput((prev) => `${prev}\nError: ${errorMessage}`);
    } finally {
      setIsLoadingChapters(false);
    }
  };

  // Handle source change
  const handleSourceChange = (value: string | null): void => {
    if (value) {
      setSourceName(value);
      setSearchResults([]);
      setSelectedManga(null);
    }
  };

  // Fetch available sources on mount
  useEffect(() => {
    void fetchAvailableSources();
  }, [fetchAvailableSources]);

  // Auto-scroll terminal to bottom when new output is added
  useEffect(() => {
    if (terminalRef.current && showTerminal) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput, showTerminal]);

  // Execute search on mount if query is provided
  useEffect(() => {
    if (isExpanded && searchQuery && !searchResults.length && !isSearching) {
      void searchManga();
    }
  }, [isExpanded, isSearching, searchManga, searchQuery, searchResults.length]);

  return (
    <Box>
      <Group justify="space-between" mb="xs">
        <Button
          variant="subtle"
          leftSection={isExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          onClick={() => setIsExpanded(!isExpanded)}
          fullWidth
        >
          Test Options
        </Button>
      </Group>

      <Collapse in={isExpanded}>
        <Paper withBorder p="md" mb="md">
          <SearchControls
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            isSearching={isSearching}
            onSearch={() => void searchManga()}
            sourceName={sourceName}
            availableSources={availableSources}
            onSourceChange={handleSourceChange}
            showSourceSelector={!initialSourceName}
            showTerminal={showTerminal}
            onToggleTerminal={() => setShowTerminal(!showTerminal)}
          />

          <TerminalPanel
            terminalOutput={terminalOutput}
            onClear={() => setTerminalOutput('')}
            isVisible={showTerminal}
            terminalRef={terminalRef}
          />

          {error && (
            <Text c="red" size="sm" mb="md">
              {error}
            </Text>
          )}

          {isSearching ? (
            <Box ta="center" py="xl">
              <Loader size="md" />
              <Text mt="md">Searching for manga...</Text>
            </Box>
          ) : searchResults.length > 0 ? (
            <Stack>
              <Text fw={500} mb="xs">
                Search Results:
              </Text>
              <SearchResultsGrid
                searchResults={searchResults}
                onViewChapters={(manga: MangaResult) => void getChapters(manga)}
                selectedManga={selectedManga}
                isLoadingChapters={isLoadingChapters}
              />
              {selectedManga && <ChaptersAccordion selectedManga={selectedManga} />}
            </Stack>
          ) : (
            <Text c="dimmed" ta="center" py="md">
              Search for manga to see results
            </Text>
          )}
        </Paper>
      </Collapse>
    </Box>
  );
}
