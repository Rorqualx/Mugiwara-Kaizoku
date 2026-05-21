/**
 * Volume Grouped Chapters Component
 *
 * Component for displaying chapters grouped by volumes.
 *
 * Features:
 * - Handles real and placeholder chapter data
 * - Global volume expansion controls
 * - Virtualization for large chapter lists
 * - AsyncResult pattern for state handling
 * - Multi-provider support (AniList, ComicVine, Fandom, Wikipedia)
 *
 * Extracted from: volumeChaptersTable.tsx
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';

import { Box, Text, Stack, ActionIcon, Tooltip } from '@mantine/core';
import { IconChevronsDown, IconChevronsUp } from '@tabler/icons-react';

// Internal imports
import { isSuccess, handleAsyncResult, type AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { trackApiCall } from '../apiCallAlert';
import classes from '../chaptersTable.module.css';
import { VirtualizedVolumeList } from '../virtualizedVolumeList';

import { useChapterFileVerification, useChapterProgress, useProgressMap } from './hooks/reading-progress';
import { useVolumeMetadata } from './hooks/useVolumeMetadata';
import { useVolumeProcessing } from './hooks/useVolumeProcessing';
import { VolumeChaptersTable } from './VolumeChaptersTable';

import type {
    VolumeGroupedChaptersProps,
    VolumeProcessingState,
    VolumeData
} from './types';
import type { FileVerificationMap } from './utils';
import type { Chapter } from "@prisma/client";

/**
 * Component for displaying chapters grouped by volumes
 * Supports placeholder generation and multi-provider metadata
 */
export const VolumeGroupedChapters = memo(({
    manga,
    mangaId: propMangaId,
    onToggleMonitoring,
    onAutoSearch,
    onManualSearch,
    onChapterClick,
    onForceRefresh,
    volumeTitles: _initialVolumeTitles,
    volumeCovers: initialVolumeCovers,
    enrichedVolumeData,
    rawProviderData,
    providerMetadata,
    selectedSourceId
}: VolumeGroupedChaptersProps): JSX.Element => {
    // State to track if all volumes are expanded or collapsed - default to collapsed
    const [allExpanded, setAllExpanded] = useState(false);

    // Parse selected sources
    const [selectedSources] = useState<Record<string, unknown>>(() => {
        if (selectedSourceId) {
            try {
                const parsed: unknown = typeof selectedSourceId === 'string' ?
                    JSON.parse(selectedSourceId) :
                    selectedSourceId;

                if (parsed && typeof parsed === 'object') {
                    return parsed as Record<string, unknown>;
                }
                return { default: selectedSourceId };
            }
            catch {
                logger.debug('selectedSourceId is not JSON, using as default:', selectedSourceId);
                return { default: selectedSourceId };
            }
        }
        return {};
    });

    // State for selected volume and chapter sources
    const volumesValue = selectedSources["volumes"];
    const volumeSource = typeof volumesValue === 'string' ? volumesValue : 'default';
    const [volumeCovers] = useState<Record<number, string> | undefined>(initialVolumeCovers);

    // Function to toggle all volumes
    const toggleAllVolumes = useCallback(() => {
        setAllExpanded((prevState) => !prevState);
    }, []);

    // Check if we have actual chapters or need to generate placeholders
    const chapters = manga.chapters;
    const hasActualChapters = Array.isArray(chapters) && chapters.length > 0;

    // Safely extract volume and chapter counts with fallbacks
    const metadata = manga.metadata;
    const volumeCount = (metadata && typeof metadata === 'object' && 'volumes' in metadata && typeof metadata.volumes === 'number')
        ? metadata.volumes
        : 0;
    const chapterCount = (metadata && typeof metadata === 'object' && 'chapters' in metadata && typeof metadata.chapters === 'number')
        ? metadata.chapters
        : 0;

    // Check if metadata has valid volume and chapter counts
    const hasMetadataCounts = volumeCount > 0 && chapterCount > 0;

    // Extract volume metadata using custom hook
    const { volumeTitles, volumeRanges: hookRanges } = useVolumeMetadata({
        rawProviderData,
        volumeSource,
        providerMetadata,
        manga
    });

    // Compute chapter ranges from actual chapter data as primary source
    const volumeRanges = useMemo(() => {
        if (hookRanges && Object.keys(hookRanges).length > 0) return hookRanges;
        if (!hasActualChapters) return undefined;
        const ranges: Record<number, { chapterStart: number; chapterEnd: number }> = {};
        for (const ch of chapters) {
            const vol = ch.volume as number | null;
            const num = ch.chapterNumber as number | null;
            if (vol === null || vol < 0) continue;
            if (num === null || !Number.isInteger(num)) continue;
            const existing = ranges[vol];
            if (existing) {
                if (num < existing.chapterStart) existing.chapterStart = num;
                if (num > existing.chapterEnd) existing.chapterEnd = num;
            } else {
                ranges[vol] = { chapterStart: num, chapterEnd: num };
            }
        }
        return Object.keys(ranges).length > 0 ? ranges : undefined;
    }, [hookRanges, hasActualChapters, chapters]);

    // === Parent-level queries (eliminate N+1) ===
    // Use prop mangaId if provided, otherwise extract from first chapter
    const mangaId = propMangaId ?? (hasActualChapters ? chapters[0]?.mangaId : undefined);

    // Collect ALL chapter IDs across all volumes for a single batch query
    const allChapterIds = useMemo(() => {
        if (!hasActualChapters || !Array.isArray(chapters)) return [];
        return chapters.map((ch: Chapter) => ch.id);
    }, [hasActualChapters, chapters]);

    // Single progress query for the entire manga (instead of per-volume)
    const { data: progressList } = useChapterProgress(mangaId);
    const parentProgressMap = useProgressMap(progressList as unknown[] | undefined);

    // Single file verification query for ALL chapters (instead of per-volume)
    const { data: fileVerificationData } = useChapterFileVerification(allChapterIds);
    const parentFileVerification: FileVerificationMap | undefined = fileVerificationData as FileVerificationMap | undefined;

    // Process chapters into volumes using custom hook
    const volumesResult: AsyncResult<VolumeProcessingState, Error> = useVolumeProcessing({
        chapters,
        hasActualChapters,
        hasMetadataCounts,
        volumeCount,
        chapterCount,
        mangaTitle: manga.title
    });

    // Track API call after successful volume processing
    useEffect(() => {
        if (isSuccess(volumesResult)) {
            const data = volumesResult.data as VolumeProcessingState;
            if (data.volumes.length > 0) {
                void trackApiCall(
                    `Process Volumes & Chapters (${manga.title ?? 'Unknown Manga'})`,
                    Promise.resolve(data.stats)
                ).catch((err) => {
                    logger.error('Failed to track API call', err);
                });
            }
        }
    }, [volumesResult, manga.title]);

    // Render based on AsyncResult state
    return (handleAsyncResult(volumesResult, {
        // Success state - render volumes
        // eslint-disable-next-line complexity -- complexity 27: each `{...(x !== undefined ? { x } : {})}` spread is required by exactOptionalPropertyTypes — components reject `prop: undefined` and need the key omitted entirely; ~12 such props for VirtualizedVolumeList and VolumeChaptersTable
        onSuccess: (data: VolumeProcessingState): JSX.Element => {
            const { volumes } = data;

            // If we have no volumes to display, show a fallback message
            if (volumes.length === 0) {
                const metadataExists = (volumeCount > 0) || (chapterCount > 0);
                const source = manga.source;

                return (
                    <Box p="xl" style={{ textAlign: 'center' }}>
                        <Text size="lg" c="dimmed">
                            No chapters available for this manga.
                        </Text>
                        <Text size="sm" c="dimmed" mt="md">
                            This could be because the manga was added from AniList, which provides metadata but not chapter information.
                        </Text>
                        {metadataExists &&
                            <Text size="sm" c="blue" mt="xs">
                                {source === 'comicvine' ? 'ComicVine' : 'AniList'} reports this manga has
                                {volumeCount > 0 ? ` approximately ${volumeCount} volumes` : ''}
                                {chapterCount > 0 && volumeCount > 0 ? ' and' : ''}
                                {chapterCount > 0 ? ` approximately ${chapterCount} chapters` : ''}.
                            </Text>
                        }
                    </Box>
                );
            }

            return (
                <Box style={{ position: 'relative' }}>
                    {/* Global toggle button - positioned absolute in top right */}
                    <Tooltip label={allExpanded ? "Collapse all volumes" : "Expand all volumes"} withArrow>
                        <ActionIcon
                            variant="filled"
                            color="blue"
                            size="lg"
                            onClick={toggleAllVolumes}
                            aria-label={allExpanded ? "Collapse all volumes" : "Expand all volumes"}
                            className={classes['actionIcon']}
                            style={{
                                position: 'absolute',
                                top: -40,
                                right: 10,
                                zIndex: 100
                            }}
                        >
                            {allExpanded ? <IconChevronsUp size={20}/> : <IconChevronsDown size={20}/>}
                        </ActionIcon>
                    </Tooltip>

                    {/* Render volumes list */}
                    {volumes.length > 20 ?
                        <VirtualizedVolumeList
                            volumes={volumes}
                            {...(onToggleMonitoring !== undefined ? { onToggleMonitoring } : {})}
                            {...(onAutoSearch !== undefined ? { onAutoSearch } : {})}
                            {...(onManualSearch !== undefined ? { onManualSearch } : {})}
                            {...(onChapterClick !== undefined ? { onChapterClick } : {})}
                            {...(onForceRefresh !== undefined ? { onForceRefresh } : {})}
                            {...(propMangaId !== undefined ? { mangaId: propMangaId } : {})}
                            {...(manga.title !== undefined ? { mangaTitle: manga.title } : {})}
                            allExpanded={allExpanded}
                            {...(volumeTitles !== undefined ? { volumeTitles } : {})}
                            {...(volumeCovers !== undefined ? { volumeCovers } : {})}
                            {...(enrichedVolumeData !== undefined ? { enrichedVolumeData } : {})}
                            {...(providerMetadata !== undefined ? { providerMetadata } : {})}
                            {...(selectedSourceId !== undefined ? { selectedSourceId: selectedSourceId as string | Record<string, unknown> } : {})}
                            {...(rawProviderData !== undefined ? { rawProviderData } : {})}
                            {...(manga.source !== undefined ? { mangaSource: manga.source } : {})}
                            parentProgressMap={parentProgressMap}
                            parentFileVerification={parentFileVerification}
                        /> :
                        <Stack style={{
                            maxHeight: '100%',
                            willChange: 'transform',
                            contain: 'content',
                            overflowY: 'auto'
                        }}>
                            {/* Render regular volumes first (including Volume 0 for prequels like JJK 0) */}
                            {volumes.
                                filter(([volumeNumber]: [number, Chapter[]]) => volumeNumber >= 0).
                                map(([volumeNumber, chapters]: [number, Chapter[]]) => (
                                    <VolumeChaptersTable
                                        key={`volume-${volumeNumber}`}
                                        volumeNumber={volumeNumber}
                                        chapters={chapters}
                                        mangaId={propMangaId ?? chapters[0]?.mangaId ?? undefined}
                                        mangaTitle={manga.title}
                                        {...(onToggleMonitoring !== undefined ? { onToggleMonitoring } : {})}
                                        {...(onAutoSearch !== undefined ? { onAutoSearch } : {})}
                                        {...(onManualSearch !== undefined ? { onManualSearch } : {})}
                                        {...(onChapterClick !== undefined ? { onChapterClick } : {})}
                                        {...(onForceRefresh !== undefined ? { onForceRefresh } : {})}
                                        {...(volumeTitles?.[volumeNumber] !== undefined ? { volumeTitle: volumeTitles[volumeNumber] } : {})}
                                        {...(volumeRanges?.[volumeNumber] !== undefined ? { chapterRange: `${volumeRanges[volumeNumber].chapterStart}-${volumeRanges[volumeNumber].chapterEnd}` } : {})}
                                        {...(volumeCovers?.[volumeNumber] !== undefined ? { volumeCover: volumeCovers[volumeNumber] } : {})}
                                        {...((() => {
                                            if (!enrichedVolumeData || !Array.isArray(enrichedVolumeData)) {
                                                return {};
                                            }
                                            const foundData = enrichedVolumeData.find((v: unknown) => {
                                                if (v && typeof v === 'object') {
                                                    const vData = v as VolumeData;
                                                    return (vData.volumeNumber ?? vData.number) === volumeNumber;
                                                }
                                                return false;
                                            }) as VolumeData | undefined;
                                            return foundData !== undefined ? { volumeData: foundData } : {};
                                        })())}
                                        {...(providerMetadata !== undefined ? { providerMetadata: providerMetadata as string | Record<string, unknown> | null | undefined } : {})}
                                        {...(manga.source !== undefined ? { selectedSource: manga.source } : {})}
                                        allExpanded={allExpanded}
                                        parentProgressMap={parentProgressMap}
                                        parentFileVerification={parentFileVerification}
                                    />
                                ))}

                            {/* Render unassigned chapters at the bottom */}
                            {volumes.
                                filter(([volumeNumber]: [number, Chapter[]]) => volumeNumber === -1).
                                map(([_volumeNumber, chapters]: [number, Chapter[]]) => (
                                    <VolumeChaptersTable
                                        key="unassigned"
                                        volumeNumber={-1}
                                        chapters={chapters}
                                        mangaId={propMangaId ?? chapters[0]?.mangaId ?? undefined}
                                        mangaTitle={manga.title}
                                        {...(onToggleMonitoring !== undefined ? { onToggleMonitoring } : {})}
                                        {...(onAutoSearch !== undefined ? { onAutoSearch } : {})}
                                        {...(onManualSearch !== undefined ? { onManualSearch } : {})}
                                        {...(onChapterClick !== undefined ? { onChapterClick } : {})}
                                        {...(onForceRefresh !== undefined ? { onForceRefresh } : {})}
                                        {...(providerMetadata !== undefined ? { providerMetadata: providerMetadata as string | Record<string, unknown> | null | undefined } : {})}
                                        {...(manga.source !== undefined ? { selectedSource: manga.source } : {})}
                                        allExpanded={allExpanded}
                                        parentProgressMap={parentProgressMap}
                                        parentFileVerification={parentFileVerification}
                                    />
                                ))}
                        </Stack>
                    }
                </Box>
            );
        },
        // Error state - display error message
        onError: (error: Error): JSX.Element => (
            <Box p="xl" style={{ textAlign: 'center' }}>
                <Text size="lg" c="red">
                    Error processing manga volumes:
                </Text>
                <Text size="md" c="red" mt="sm">
                    {(error instanceof Error ? error.message : String(error))}
                </Text>
            </Box>
        ),
        // Loading state - show loading indicator
        onLoading: (): JSX.Element => (
            <Box p="xl" style={{ textAlign: 'center' }}>
                <Text size="lg" c="dimmed">
                    Processing manga volumes...
                </Text>
            </Box>
        ),
        // Idle state - should never happen, but show fallback message
        onIdle: (): JSX.Element => (
            <Box p="xl" style={{ textAlign: 'center' }}>
                <Text size="lg" c="dimmed">
                    Waiting to process manga volumes...
                </Text>
            </Box>
        )
    }) ?? (
        <Box p="xl" style={{ textAlign: 'center' }}>
            <Text size="lg" c="red">
                Unexpected state in volume processing
            </Text>
        </Box>
    ));
});
// Set component display name
VolumeGroupedChapters.displayName = 'VolumeGroupedChapters';