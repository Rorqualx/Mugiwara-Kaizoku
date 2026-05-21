/**
 * VolumesChaptersStep Component
 *
 * Handles volume and chapter selection for manga import.
 * This is step 3 of the UniversalImportWizard.
 *
 * Refactored from 1536 lines to ~250 lines by extracting:
 * - Custom hooks for auto-fetch, chapter covers, debug logging
 * - UI components for grids, lists, progress indicators, source selection
 */

import React, { useState } from 'react';

import {
  Stack,
  Title,
  Paper,
  TextInput,
  ActionIcon,
  Button,
  Tabs,
  Badge,
  Text,
  Group,
  Divider,
  Loader,
  Progress
} from '@mantine/core';
import { IconCheck, IconDownload } from '@tabler/icons-react';

import { type VolumesChaptersStepProps, isRecord, hasProperty, extractTotalChapters, isScrapingChapters, extractScrapingProgress } from './volumes-chapters';
import { ChapterList } from './volumes-chapters/components/ChapterList';
import { AutoFetchIndicator, ProgressiveFetchIndicator, AutoFetchError, BatchFetchProgress, ComicVineScrapingProgress } from './volumes-chapters/components/ProgressIndicators';
import { SourceSelection, type VolumeFieldSources } from './volumes-chapters/components/SourceSelection';
import { VolumeGrid } from './volumes-chapters/components/VolumeGrid';
import { useAutoFetch } from './volumes-chapters/hooks/useAutoFetch';
import { useAutoSwitchSource } from './volumes-chapters/hooks/useAutoSwitchSource';
import { useChapterCovers } from './volumes-chapters/hooks/useChapterCovers';
import { useDebugLogging } from './volumes-chapters/hooks/useDebugLogging';

// eslint-disable-next-line max-lines-per-function -- Complex wizard step with integrated UI state; already extracted hooks and components
export const VolumesChaptersStep: React.FC<VolumesChaptersStepProps> = React.memo(({
  manualVolumeUrl,
  setManualVolumeUrl,
  handleVolumeUrlParse,
  isParsingVolumeUrl,
  isScrapingComicVineChapters,
  parseChapterDetails,
  setParseChapterDetails,
  displayVolumes,
  allChapterUrls,
  volumesData,
  volumeDisplaySource,
  setVolumeDisplaySource,
  chapterDisplaySource,
  setChapterDisplaySource,
  provider,
  selectedSourcesMetadata,
  selectedSources,
  selectedVolumes,
  setSelectedVolumes,
  selectedChapters,
  setSelectedChapters,
  isBatchFetching,
  batchFetchProgress,
  setMediaGallery,
  logger,
  isProgressiveFetching,
  progressiveFetchProgress,
  failedChapterUrls,
  retryFailedChapters
}) => {
  // Use extracted hooks
  const { isAutoFetching, autoFetchError, setAutoFetchError } = useAutoFetch({
    provider,
    selectedSourcesMetadata,
    volumesData,
    isParsingVolumeUrl,
    manualVolumeUrl,
    handleVolumeUrlParse,
    setManualVolumeUrl,
    logger
  });

  useChapterCovers({
    selectedChapters,
    volumesData,
    setMediaGallery,
    logger
  });

  useDebugLogging({
    selectedSourcesMetadata,
    volumesData,
    displayVolumes,
    allChapterUrls,
    volumeDisplaySource,
    logger,
    hasAttemptedAutoFetch: false
  });

  // Field-level source selection for volumes and chapters (cover, summary, title)
  const [volumeFieldSources, setVolumeFieldSources] = useState<VolumeFieldSources>({
    volumeCover: volumeDisplaySource,
    volumeSummary: volumeDisplaySource,
    volumeTitle: volumeDisplaySource,
    chapterCover: chapterDisplaySource,
    chapterSummary: chapterDisplaySource,
    chapterTitle: chapterDisplaySource,
  });

  // Auto-switch display source when primary has no volumeData but secondary does
  // Also syncs field sources when display sources change
  useAutoSwitchSource({
    selectedSourcesMetadata,
    volumeDisplaySource,
    chapterDisplaySource,
    provider,
    logger,
    setVolumeDisplaySource,
    setChapterDisplaySource,
    setVolumeFieldSources,
  });

  // Track previous chapter display source to detect changes
  const prevChapterDisplaySourceRef = React.useRef(chapterDisplaySource);

  // Reset selectedChapters when chapterDisplaySource changes to prevent accumulation from multiple sources
  React.useEffect(() => {
    const prevSource = prevChapterDisplaySourceRef.current;

    // Only reset if source actually changed (not on initial render)
    if (prevSource !== chapterDisplaySource && prevSource !== '') {
      logger.info('[VolumesChaptersStep] Chapter display source changed, resetting selections', {
        prevSource,
        newSource: chapterDisplaySource,
        previousSelectionCount: selectedChapters.length,
        newChapterCount: allChapterUrls.length
      });

      // If all volumes are selected, auto-select all chapters from new source
      const allVolumesSelected = displayVolumes.length > 0 && selectedVolumes.length === displayVolumes.length;

      if (allVolumesSelected && allChapterUrls.length > 0) {
        // Select all chapters from the new source
        const chapterIds = allChapterUrls.map((chapter: unknown) => {
          if (!isRecord(chapter)) return chapter;
          const url = hasProperty(chapter, 'url') ? chapter['url'] : undefined;
          return url ?? chapter;
        });
        setSelectedChapters([...new Set(chapterIds)]);
        logger.info('[VolumesChaptersStep] Auto-selected all chapters from new source', {
          count: chapterIds.length
        });
      } else {
        // Clear selection - user needs to re-select from new source
        setSelectedChapters([]);
        logger.info('[VolumesChaptersStep] Cleared chapter selection for new source');
      }
    }

    prevChapterDisplaySourceRef.current = chapterDisplaySource;
  }, [chapterDisplaySource, allChapterUrls, displayVolumes.length, selectedVolumes.length, selectedChapters.length, logger, setSelectedChapters]);

  // Auto-select chapters when ComicVine scraping completes and all volumes are already selected
  React.useEffect(() => {
    const isScrapingComplete = !isScrapingChapters(volumesData) && !isScrapingComicVineChapters;
    const allVolumesSelected = displayVolumes.length > 0 && selectedVolumes.length === displayVolumes.length;
    const hasChapters = allChapterUrls.length > 0;
    const noChaptersSelected = selectedChapters.length === 0;

    if (isScrapingComplete && allVolumesSelected && hasChapters && noChaptersSelected) {
      logger.info('[VolumesChaptersStep] Auto-selecting chapters after scraping completed', {
        displayVolumesCount: displayVolumes.length,
        selectedVolumesCount: selectedVolumes.length,
        allChapterUrlsCount: allChapterUrls.length
      });

      // Select all chapters
      const allChapterUrlsSet: string[] = [];
      displayVolumes.forEach((volume: unknown) => {
        if (!isRecord(volume)) return;

        const chapters = hasProperty(volume, 'chapters') && Array.isArray(volume['chapters'])
          ? volume['chapters']
          : null;

        if (chapters && chapters.length > 0) {
          const volumeChapterUrls = chapters
            .filter((ch: unknown) => {
              if (!isRecord(ch)) return false;
              return hasProperty(ch, 'url');
            })
            .map((ch: unknown) => {
              if (!isRecord(ch)) return '';
              const url = hasProperty(ch, 'url') ? ch['url'] : undefined;
              return typeof url === 'string' ? url : '';
            })
            .filter((url): url is string => url !== '');
          allChapterUrlsSet.push(...volumeChapterUrls);
        }
      });
      setSelectedChapters([...new Set(allChapterUrlsSet)]);
    }
  }, [isScrapingComicVineChapters, volumesData, displayVolumes, selectedVolumes, allChapterUrls, selectedChapters.length, logger, setSelectedChapters]);

  // Selection handlers
  const handleSelectAllVolumes = (): void => {
    const volumes = displayVolumes;

    if (selectedVolumes.length === volumes.length && volumes.length > 0) {
      // Deselect all volumes and their chapters
      setSelectedVolumes([]);
      setSelectedChapters([]);
    } else {
      // Select all volumes
      const allVolumeNumbers = volumes.map((v: unknown, i: number) => {
        if (!isRecord(v)) return i + 1;

        const volumeNumber = hasProperty(v, 'volumeNumber') ? v['volumeNumber'] : undefined;
        const number = hasProperty(v, 'number') ? v['number'] : undefined;

        if (typeof volumeNumber === 'number' || typeof volumeNumber === 'string') {
          return volumeNumber;
        }
        if (typeof number === 'number' || typeof number === 'string') {
          return number;
        }
        return i + 1;
      });
      setSelectedVolumes(allVolumeNumbers);

      // Select ALL chapters from allChapterUrls (supports cross-provider selection)
      // This ensures all chapters are selected regardless of which provider they come from
      const chapterIds = allChapterUrls.map((chapter: unknown) => {
        if (!isRecord(chapter)) return chapter;
        const url = hasProperty(chapter, 'url') ? chapter['url'] : undefined;
        return url ?? chapter;
      });
      setSelectedChapters([...new Set(chapterIds)]);
    }
  };

  const handleSelectAllChapters = (): void => {
    if (selectedChapters.length === allChapterUrls.length && allChapterUrls.length > 0) {
      // Deselect all chapters
      setSelectedChapters([]);
    } else {
      // Select all chapters
      const chapterIds = allChapterUrls.map((chapter: unknown) => {
        if (!isRecord(chapter)) return chapter;

        const url = hasProperty(chapter, 'url') ? chapter['url'] : undefined;
        return url ?? chapter;
      });
      setSelectedChapters([...new Set(chapterIds)]);
    }
  };

  return (
    <Stack>
      <Title order={4}>Volumes and Chapters</Title>

      <Paper p="md">
        <Stack>
          <TextInput
            label="Volume List URL (Optional)"
            placeholder="URL to volume/chapter list (Fandom, Wikipedia, ComicVine, or MangaDex)..."
            value={manualVolumeUrl}
            onChange={e => setManualVolumeUrl(e.target.value)}
            description="Enter a URL to a volumes list page or a specific volume. Supports Fandom wikis, Wikipedia, ComicVine, and MangaDex URLs"
            rightSection={
              <ActionIcon
                size="sm"
                onClick={() => { void handleVolumeUrlParse(); }}
                loading={isParsingVolumeUrl || isScrapingComicVineChapters}
                disabled={!manualVolumeUrl || isScrapingComicVineChapters}
                title={isScrapingComicVineChapters ? "ComicVine scraping in progress..." : "Parse URL"}
              >
                <IconDownload size={14} />
              </ActionIcon>
            }
          />

          <Button
            variant={parseChapterDetails ? "filled" : "light"}
            onClick={() => setParseChapterDetails(!parseChapterDetails)}
            leftSection={parseChapterDetails ? <IconCheck size={16} /> : null}
          >
            {parseChapterDetails ? "Parsing detailed chapter information" : "Parse detailed chapter information"}
          </Button>
        </Stack>
      </Paper>

      <Divider my="md" />

      {/* Progress Indicators */}
      <AutoFetchIndicator isAutoFetching={isAutoFetching} provider={provider} />
      <ComicVineScrapingProgress
        isScrapingChapters={isScrapingChapters(volumesData) || isScrapingComicVineChapters}
        scrapingProgress={extractScrapingProgress(volumesData) as {
          current: number;
          total: number;
          message?: string;
          stage?: 'connecting' | 'api_call' | 'scraping' | 'merging' | 'complete' | 'error';
        } | null}
      />
      <ProgressiveFetchIndicator
        isProgressiveFetching={isProgressiveFetching}
        progressiveFetchProgress={progressiveFetchProgress}
        failedChapterUrls={failedChapterUrls}
        retryFailedChapters={retryFailedChapters}
      />
      <AutoFetchError
        autoFetchError={autoFetchError}
        isAutoFetching={isAutoFetching}
        setAutoFetchError={setAutoFetchError}
      />

      {/* Source Selection - Field-level selection for cover, summary, chapters */}
      <SourceSelection
        volumeDisplaySource={volumeDisplaySource}
        setVolumeDisplaySource={setVolumeDisplaySource}
        chapterDisplaySource={chapterDisplaySource}
        setChapterDisplaySource={setChapterDisplaySource}
        provider={provider}
        selectedSourcesMetadata={selectedSourcesMetadata}
        selectedSources={selectedSources}
        logger={logger}
        volumeFieldSources={volumeFieldSources}
        setVolumeFieldSources={setVolumeFieldSources}
      />

      <Tabs defaultValue="volumes">
        <Tabs.List>
          <Tabs.Tab value="volumes">Volumes ({displayVolumes.length})</Tabs.Tab>
          <Tabs.Tab value="chapters">
            <Group gap="xs">
              {isScrapingChapters(volumesData) || isScrapingComicVineChapters ? (
                <>
                  <Loader size={14} />
                  <Text size="sm">Chapters (Loading...)</Text>
                </>
              ) : (
                <Text size="sm">Chapters ({extractTotalChapters(volumesData) || allChapterUrls.length})</Text>
              )}
            </Group>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="volumes" pt="xs">
          <Paper p="md">
            <Stack gap="sm">
              <BatchFetchProgress
                isBatchFetching={isBatchFetching}
                provider={provider}
                batchFetchProgress={batchFetchProgress}
              />

              <Group justify="space-between">
                <Title order={5}>Volume Selection</Title>
                {displayVolumes.length > 0 && (
                  <Group>
                    <Button size="xs" variant="subtle" onClick={() => { void handleSelectAllVolumes(); }}>
                      {selectedVolumes.length === displayVolumes.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Badge>{selectedVolumes.length} / {displayVolumes.length} selected</Badge>
                  </Group>
                )}
              </Group>

              {displayVolumes.length === 0 ? (
                <Paper p="xl" bg="gray.9" style={{ textAlign: 'center' }}>
                  <Stack align="center" gap="md">
                    <Text c="dimmed" size="lg">No detailed volume data available</Text>
                    <Text c="dimmed" size="sm">
                      Use the URL input above to import volume data from Fandom, Wikipedia, ComicVine, or MangaDex
                    </Text>
                  </Stack>
                </Paper>
              ) : (
                <VolumeGrid
                  displayVolumes={displayVolumes}
                  selectedVolumes={selectedVolumes}
                  setSelectedVolumes={setSelectedVolumes}
                  selectedChapters={selectedChapters}
                  setSelectedChapters={setSelectedChapters}
                  allChapterUrls={allChapterUrls}
                  logger={logger}
                  volumeFieldSources={volumeFieldSources}
                  selectedSourcesMetadata={selectedSourcesMetadata}
                  selectedSources={selectedSources}
                />
              )}
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="chapters" pt="xs">
          <Paper p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={5}>Chapter Selection</Title>
                {allChapterUrls.length > 0 && (
                  <Group>
                    <Button size="xs" variant="subtle" onClick={() => { void handleSelectAllChapters(); }}>
                      {selectedChapters.length === allChapterUrls.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Badge>{selectedChapters.length} / {allChapterUrls.length} selected</Badge>
                  </Group>
                )}
              </Group>

              {/* Chapter scraping progress indicator */}
              {(isScrapingChapters(volumesData) || isScrapingComicVineChapters) && (
                <Paper p="sm" bg="blue.9" radius="sm">
                  <Stack gap="xs">
                    <Group gap="xs">
                      <Loader size={16} color="blue" />
                      <Text size="sm" fw={500}>
                        Scraping chapter data from ComicVine...
                      </Text>
                    </Group>
                    {(() => {
                      const progress = extractScrapingProgress(volumesData);
                      if (progress && progress.total > 0) {
                        const percentage = Math.round((progress.current / progress.total) * 100);
                        return (
                          <>
                            <Progress value={percentage} size="sm" animated />
                            <Text size="xs" c="dimmed">
                              {progress.message ?? `Volume ${progress.current} of ${progress.total}`}
                            </Text>
                          </>
                        );
                      }
                      return (
                        <>
                          <Progress value={100} size="sm" animated striped />
                          <Text size="xs" c="dimmed">
                            This may take a moment - using FlareSolverr for CloudFlare bypass
                          </Text>
                        </>
                      );
                    })()}
                  </Stack>
                </Paper>
              )}

              {/* Chapter count info from selected providers only (case-insensitive matching) */}
              <Group>
                {Object.entries(selectedSourcesMetadata)
                  .filter(([name, m]) => {
                    // Case-insensitive check for source inclusion
                    const nameLower = name.toLowerCase();
                    const isSelected = selectedSources.some(s => s.toLowerCase() === nameLower);
                    return isSelected &&
                      isRecord(m) &&
                      hasProperty(m, 'chapters') &&
                      m['chapters'] !== undefined;
                  })
                  .map(([name, m]) => (
                    <Badge key={name} variant="light">
                      {name.toUpperCase()}: {String(isRecord(m) && hasProperty(m, 'chapters') ? m['chapters'] : '')} CHAPTERS
                    </Badge>
                  ))}
              </Group>

              {allChapterUrls.length === 0 ? (
                <Paper p="xl" bg="gray.9" style={{ textAlign: 'center' }}>
                  <Stack align="center" gap="md">
                    <Text c="dimmed" size="lg">No detailed chapter data available</Text>
                    <Text c="dimmed" size="sm">
                      {(() => {
                        const totalChapters = extractTotalChapters(volumesData);
                        return totalChapters > 0
                          ? `${totalChapters} total chapters expected. Import volumes to see chapter details.`
                          : "Import volumes first to see available chapters";
                      })()}
                    </Text>
                  </Stack>
                </Paper>
              ) : (
                <ChapterList
                  allChapterUrls={allChapterUrls}
                  selectedChapters={selectedChapters}
                  setSelectedChapters={setSelectedChapters}
                  chapterFieldSources={volumeFieldSources}
                  selectedSourcesMetadata={selectedSourcesMetadata}
                  selectedSources={selectedSources}
                />
              )}
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
});
VolumesChaptersStep.displayName = 'VolumesChaptersStep';
