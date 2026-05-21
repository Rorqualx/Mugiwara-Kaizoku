/**
 * Mobile Chapter Reader Component
 *
 * Complete chapter reading experience with:
 * - Chapter navigation
 * - Reading progress persistence
 * - Preloading adjacent chapters
 * - Offline support
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';


import { Box, LoadingOverlay, Alert, Group, Text, ActionIcon, Badge } from '@mantine/core';
import { IconAlertCircle, IconChevronLeft} from '@tabler/icons-react';
import { z } from 'zod';

import { useOfflineContent } from '@/hooks/offline/useOfflineStatus';
import type {
  AsyncResult} from '@/utils/async-result';
import {
  createLoadingResult,
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError
} from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { offlineStorage } from '@/utils/offline/offline-storage';

import { MobileReader, type ReaderChapter, type ReaderPage } from './MobileReader';

import type { Chapter as ChapterEntity } from '@prisma/client';

// Zod schemas for validating reading progress from localStorage
const ChapterProgressSchema = z.object({
    page: z.number(),
    mode: z.enum(['vertical', 'single', 'double']).optional(),
    direction: z.enum(['ltr', 'rtl']).optional(),
    timestamp: z.number()
});

const MangaProgressSchema = z.record(ChapterProgressSchema);

const ReadingProgressSchema = z.record(MangaProgressSchema);

interface MobileChapterReaderProps {
    /** Manga ID */
    mangaId: string;
    /** Initial chapter ID */
    chapterId: string;
    /** All chapters for navigation */
    chapters: ChapterEntity[];
    /** On close reader */
    onClose: () => void;
    /** Custom header component */
    header?: React.ReactNode;
    /** Enable offline reading */
    enableOffline?: boolean;
}
interface ReaderState {
    currentChapter: ReaderChapter | null;
    currentPage: number;
    readingMode: 'vertical' | 'single' | 'double';
    readingDirection: 'ltr' | 'rtl';
}
// Reading progress storage key
const READING_PROGRESS_KEY = 'mugiwara-reading-progress';
export function MobileChapterReader({ mangaId, chapterId: initialChapterId, chapters, onClose, header, enableOffline = true }: MobileChapterReaderProps): React.ReactElement | null {
    const [chapterId, setChapterId] = useState(initialChapterId);
    const [chapterData, setChapterData] = useState<AsyncResult<ReaderChapter, Error>>(createLoadingResult());
    const [readerState, setReaderState] = useState<ReaderState>({
        currentChapter: null,
        currentPage: 0,
        readingMode: 'vertical',
        readingDirection: 'ltr'
    });
    const { isAvailable: isOfflineAvailable } = useOfflineContent(mangaId);
    // Find current chapter index
    const currentChapterIndex = useMemo(() => {
        return chapters.findIndex(ch => toStringId(ch["id"]) === chapterId);
    }, [chapters, chapterId]);
    // Get adjacent chapters
    const adjacentChapters = useMemo(() => {
        return {
            prev: currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null,
            next: currentChapterIndex < chapters.length - 1 ? chapters[currentChapterIndex + 1] : null
        };
    }, [chapters, currentChapterIndex]);
    // Load reading progress
    const loadReadingProgress = useCallback(() => {
        try {
            const stored = localStorage.getItem(READING_PROGRESS_KEY);
            if (stored) {
                const parsed: unknown = JSON.parse(stored);
                const result = ReadingProgressSchema.safeParse(parsed);

                if (!result.success) {
                    logger.warn('Invalid reading progress format, clearing storage:', result.error);
                    localStorage.removeItem(READING_PROGRESS_KEY);
                    return;
                }

                const progress = result.data;
                const mangaProgress = progress[mangaId];
                if (mangaProgress) {
                    const chapterProgress = mangaProgress[chapterId];
                    if (chapterProgress) {
                        setReaderState(prev => ({
                            ...prev,
                            currentPage: chapterProgress.page || 0,
                            readingMode: chapterProgress.mode || prev.readingMode,
                            readingDirection: chapterProgress.direction || prev.readingDirection
                        }));
                    }
                }
            }
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to load reading progress:', errorMessage);
        }
    }, [mangaId, chapterId]);
    // Save reading progress
    const saveReadingProgress = useCallback((page: number) => {
        try {
            const stored = localStorage.getItem(READING_PROGRESS_KEY) ?? '{}';
            const parsed: unknown = JSON.parse(stored);
            const result = ReadingProgressSchema.safeParse(parsed);

            const progress = result.success ? result.data : {};

            // Initialize manga progress if it doesn't exist and update
            const mangaProgress = progress[mangaId] ?? {};
            mangaProgress[chapterId] = {
                page,
                mode: readerState.readingMode,
                direction: readerState.readingDirection,
                timestamp: Date.now()
            };
            progress[mangaId] = mangaProgress;
            localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(progress));
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to save reading progress:', errorMessage);
        }
    }, [mangaId, chapterId, readerState.readingMode, readerState.readingDirection]);

    // Preload adjacent chapters (first page only for fast navigation)
    const preloadAdjacentChapters = useCallback(() => {
        // Preload next chapter's first page
        if (adjacentChapters.next) {
            const img = new window.Image();
            img.src = `/api/reader/page/${mangaId}/${adjacentChapters.next["id"]}/1`;
        }
        // Preload previous chapter's first page
        if (adjacentChapters.prev) {
            const img = new window.Image();
            img.src = `/api/reader/page/${mangaId}/${adjacentChapters.prev["id"]}/1`;
        }
    }, [mangaId, adjacentChapters]);

    // Load chapter data
    const loadChapter = useCallback(async (id: string) => {
        setChapterData(createLoadingResult());
        try {
            // Check offline storage first if enabled
            if (enableOffline && isOfflineAvailable) {
                const offlineResult = await offlineStorage.getChapterContent(id);
                if (isSuccess(offlineResult) && offlineResult.data) {
                    const chapter = chapters.find(ch => toStringId(ch["id"]) === id);
                    if (chapter) {
                        const readerChapter: ReaderChapter = {
                            id: toStringId(chapter["id"]),
                            title: chapter["title"],
                            number: Number(chapter.chapterNumber),
                            pages: offlineResult.data.pages.map((url, index) => ({
                                id: `${id}-page-${index}`,
                                url,
                                pageNumber: index + 1,
                                width: 800,
                                // Default dimensions
                                height: 1200
                            }))
                        };
                        setChapterData(createSuccessResult(readerChapter));
                        setReaderState(prev => ({
                            ...prev,
                            currentChapter: readerChapter
                        }));
                        return;
                    }
                }
            }
            // Load from API
            const chapter = chapters.find(ch => toStringId(ch["id"]) === id);
            if (!chapter) {
                throw new ValidationError('Chapter not found');
            }

            // Get actual page count from chapter or API
            const pageCount = chapter.pageCount ?? 1;

            // Generate page URLs pointing to actual reader API
            const pages: ReaderPage[] = Array.from({
                length: pageCount
            }, (_, i) => ({
                id: `${id}-page-${i}`,
                url: `/api/reader/page/${mangaId}/${id}/${i + 1}`,
                pageNumber: i + 1,
                width: 800,
                height: 1200
            }));
            const readerChapter: ReaderChapter = {
                id: toStringId(chapter["id"]),
                title: chapter["title"],
                number: Number(chapter.chapterNumber),
                pages
            };
            setChapterData(createSuccessResult(readerChapter));
            setReaderState(prev => ({
                ...prev,
                currentChapter: readerChapter
            }));
            // Preload adjacent chapters
            preloadAdjacentChapters();
        }
        catch (error: unknown) {
            setChapterData(createErrorResult(error instanceof Error ? error : new Error('Failed to load chapter')));
        }
    }, [mangaId, chapters, enableOffline, isOfflineAvailable, preloadAdjacentChapters]);

    // Handle page change
    const handlePageChange = useCallback((page: number) => {
        setReaderState(prev => ({
            ...prev,
            currentPage: page
        }));
        saveReadingProgress(page);
    }, [saveReadingProgress]);
    // Handle chapter navigation
    const handleChapterChange = useCallback((direction: 'prev' | 'next') => {
        const targetChapter = direction === 'prev' ? adjacentChapters.prev : adjacentChapters.next;
        if (targetChapter) {
            setChapterId(toStringId(targetChapter["id"]));
            setReaderState(prev => ({
                ...prev,
                currentPage: direction === 'prev' ? 19 : 0
            }));
        }
    }, [adjacentChapters]);
    // Load chapter on mount or change
    useEffect(() => {
        void loadChapter(chapterId);
        void loadReadingProgress();
    }, [chapterId, loadChapter, loadReadingProgress]);
    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [onClose]);
    // Loading state
    if (chapterData["status"] === 'loading') {
        return <Box style={{
                position: 'relative',
                height: '100vh'
            }}>
        <LoadingOverlay visible/>
      </Box>;
    }
    // Error state
    if (isError(chapterData)) {
        return <Box style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'md'
            }}>

        <Alert icon={<IconAlertCircle />} title="Failed to load chapter" color="red">

          {chapterData.error instanceof Error ? chapterData.error.message : String(chapterData.error)}
        </Alert>
      </Box>;
    }
    // Success state
    if (isSuccess(chapterData) && readerState.currentChapter) {
        return <MobileReader chapter={readerState.currentChapter} currentPage={readerState.currentPage} mode={readerState.readingMode} direction={readerState.readingDirection} onPageChange={handlePageChange} onChapterChange={handleChapterChange} header={header ?? <Group justify="space-between">
              <Group>
                <ActionIcon variant="subtle" color="gray" onClick={onClose}>

                  <IconChevronLeft size={20}/>
                </ActionIcon>
                <Box>
                  <Text c="white" size="sm" fw={500}>
                    {readerState.currentChapter["title"]}
                  </Text>
                  <Text c="dimmed" size="xs">
                    Chapter {readerState.currentChapter.number}
                  </Text>
                </Box>
              </Group>
              
              {isOfflineAvailable && <Badge color="green" variant="light" size="sm">
                  Available Offline
                </Badge>}
            </Group>}/>;
    }
    return null;
}
/**
 * Get reading progress for a manga
 */
export function getReadingProgress(mangaId: string): Record<string, unknown> | null {
    try {
        const stored = localStorage.getItem(READING_PROGRESS_KEY);
        if (stored) {
            const parsed: unknown = JSON.parse(stored);
            const result = ReadingProgressSchema.safeParse(parsed);

            if (!result.success) {
                logger.warn('Invalid reading progress format:', result.error);
                return null;
            }

            const progress = result.data;
            return progress[mangaId] ?? null;
        }
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to get reading progress:', errorMessage);
    }
    return null;
}
/**
 * Clear reading progress for a manga
 */
export function clearReadingProgress(mangaId: string): void {
    try {
        const stored = localStorage.getItem(READING_PROGRESS_KEY) ?? '{}';
        const parsed: unknown = JSON.parse(stored);
        const result = ReadingProgressSchema.safeParse(parsed);

        const progress = result.success ? result.data : {};
        delete progress[mangaId];
        localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(progress));
    }
    catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to clear reading progress:', errorMessage);
    }
}
