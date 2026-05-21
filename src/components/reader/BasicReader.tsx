// Basic Reader Component - Following Mugiwara-Kaizoku patterns
import React, { useCallback, useEffect, useState } from 'react';

import { Box, Button, Group, Text, LoadingOverlay } from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconSettings } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { ProgressiveImage, preloadImage } from '@/components/images/ProgressiveImage';
import { useNavigation } from '@/hooks/useNavigation';
import { useReaderStore } from '@/store/readerSlice';
import type { MangaFile } from '@/types/reader/reader-types';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import {
  CLICK_NAVIGATION_ZONE_WIDTH,
  PAGE_TRANSITION_DURATION_MS,
  PAGE_TRANSITION_EASING
} from '@/utils/reader/constants';
import { trpc } from '@/utils/trpc-client';

export const BasicReader = React.memo(function BasicReader(): React.JSX.Element {
    const router = useRouter();
    const { navigateTo } = useNavigation();
    const { mangaId, chapterId } = router.query;
    // Reader store
    const { currentFile, currentPage, settings, setFile, setPage, setLoading, setError } = useReaderStore();
    // Local state for image URLs
    const [pages, setPages] = useState<string[]>([]);
    const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
    // Smooth transition state
    const [isTransitioning, setIsTransitioning] = useState(false);
    // tRPC queries
    const chapterFileQuery = trpc.reader.getChapterFile.useQuery({
        mangaId: toNumberId(mangaId),
        chapterId: toNumberId(chapterId)
    }, {
        enabled: !!mangaId && !!chapterId,
        retry: 1
    });
    const progressMutation = trpc.reader.updateProgress.useMutation();
    // Load chapter file
    useEffect(() => {
        if (chapterFileQuery.data?.filePath && chapterFileQuery.data.downloadStatus === 'COMPLETED') {
            // For now, create a mock file
            const mockFile: MangaFile = {
                id: `${mangaId}-${chapterId}`,
                mangaId: toNumberId(mangaId),
                chapterId: toNumberId(chapterId),
                chapterTitle: chapterFileQuery.data.title ?? 'Untitled Chapter',
                format: 'cbz',
                totalPages: chapterFileQuery.data.pageCount,
                metadata: {
                    ...(chapterFileQuery.data.title ? { title: chapterFileQuery.data.title } : {})
                }
            };
            setFile(mockFile);
            setLoading(false);
        }
    }, [chapterFileQuery.data, mangaId, chapterId, setFile, setLoading]);
    // Handle chapter file query errors
    useEffect(() => {
        if (chapterFileQuery.error) {
            setError(new Error(chapterFileQuery.error instanceof Error ? chapterFileQuery.error.message : String(chapterFileQuery.error)));
            setLoading(false);
        }
    }, [chapterFileQuery.error, setError, setLoading]);
    // Navigation functions
    const saveProgress = useCallback((page: number): void => {
        if (!currentFile)
            return;
        void progressMutation.mutateAsync({
            mangaId: currentFile.mangaId,
            chapterId: currentFile.chapterId,
            currentPage: page,
            totalPages: currentFile.totalPages
        });
    }, [currentFile, progressMutation]);

    // Navigate with smooth transition effect
    const navigateToPage = useCallback((newPage: number): void => {
        if (isTransitioning) return;
        setIsTransitioning(true);
        setTimeout(() => {
            setPage(newPage);
            saveProgress(newPage);
            setIsTransitioning(false);
        }, PAGE_TRANSITION_DURATION_MS);
    }, [isTransitioning, setPage, saveProgress]);

    const nextPage = useCallback((): void => {
        if (currentFile && currentPage < currentFile.totalPages) {
            navigateToPage(currentPage + 1);
        }
    }, [currentFile, currentPage, navigateToPage]);

    const prevPage = useCallback((): void => {
        if (currentPage > 1) {
            navigateToPage(currentPage - 1);
        }
    }, [currentPage, navigateToPage]);
    // Keyboard navigation
    useEffect(() => {
        if (!settings.enableKeyboard)
            return;
        const handleKeyDown = (e: KeyboardEvent): void => {
            switch (e.key) {
                case 'ArrowLeft':
                    if (settings.readingDirection === 'rtl') {
                        nextPage();
                    }
                    else {
                        prevPage();
                    }
                    break;
                case 'ArrowRight':
                    if (settings.readingDirection === 'rtl') {
                        prevPage();
                    }
                    else {
                        nextPage();
                    }
                    break;
                case ' ':
                    e.preventDefault();
                    nextPage();
                    break;
                default:
                    // No action for other keys
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, currentFile, settings.readingDirection, settings.enableKeyboard, nextPage, prevPage]);
    // Generate page URLs immediately (no delay needed - URLs are deterministic)
    useEffect(() => {
        if (currentFile && pages.length === 0) {
            // Page URLs are generated instantly - no extraction needed
            // The actual extraction happens server-side when each page is requested
            const pageUrls = Array.from(
                { length: currentFile.totalPages },
                (_, i) => `/api/reader/page/${currentFile.mangaId}/${currentFile.chapterId}/${i + 1}`
            );
            setPages(pageUrls);
        }
    }, [currentFile, pages.length]);

    // Preload first 3 pages immediately for instant navigation
    useEffect(() => {
        if (pages.length > 0) {
            const pagesToPreload = pages.slice(0, 3);
            pagesToPreload.forEach(url => {
                void preloadImage(url);
            });
        }
    }, [pages]);

    // Update current image URL
    useEffect(() => {
        if (pages.length > 0 && currentPage > 0) {
            const pageUrl = pages[currentPage - 1];
            if (pageUrl) {
                setCurrentImageUrl(pageUrl);
            }
        }
    }, [pages, currentPage]);
    // Loading state
    if (chapterFileQuery.isLoading) {
        return <Box h="100vh" pos="relative" bg={settings.backgroundColor}>
        <LoadingOverlay visible/>
      </Box>;
    }
    // Error state
    if (chapterFileQuery.error ?? (chapterFileQuery.data && chapterFileQuery.data.downloadStatus !== 'COMPLETED')) {
        return <Box h="100vh" bg={settings.backgroundColor} p="md">
        <Text c="red" ta="center">
          {chapterFileQuery.error?.message ?? 'Chapter not available for reading'}
        </Text>
        <Group justify="center" mt="md">
          <Button onClick={() => router.back()}>Go Back</Button>
        </Group>
      </Box>;
    }
    // No file loaded
    if (!currentFile) {
        return <Box h="100vh" bg={settings.backgroundColor} p="md">
        <Text c="white" ta="center">No file loaded</Text>
      </Box>;
    }
    return <Box h="100vh" bg={settings.backgroundColor} style={{
            overflow: 'hidden'
        }}>

      {/* Toolbar */}
      {settings.showToolbar && <Group justify="space-between" p="sm" style={{
                background: 'rgba(0, 0, 0, 0.8)',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10
            }}>

          <Button onClick={prevPage} disabled={currentPage === 1} size="sm" leftSection={<IconArrowLeft size={16}/>}>

            Previous
          </Button>
          
          <Text c="white" fw={500}>
            {currentFile.chapterTitle} - Page {currentPage} / {currentFile.totalPages}
          </Text>
          
          <Group>
            <Button onClick={nextPage} disabled={currentPage === currentFile.totalPages} size="sm" rightSection={<IconArrowRight size={16}/>}>

              Next
            </Button>
            
            <Button variant="subtle" size="sm" onClick={() => { void navigateTo(`/read/${mangaId}/${chapterId}/settings`); }}>

              <IconSettings size={16}/>
            </Button>
          </Group>
        </Group>}
      
      {/* Image Display */}
      <Box p="md" style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: settings.showToolbar ? '60px' : '0'
        }}>

        {currentImageUrl && <ProgressiveImage
            src={currentImageUrl}
            loadingType="skeleton"
            lazy={false}
            alt={`Page ${currentPage}`}
            style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                filter: `brightness(${settings.brightness}) contrast(${settings.contrast})`,
                opacity: isTransitioning ? 0 : 1,
                transition: `opacity ${PAGE_TRANSITION_DURATION_MS}ms ${PAGE_TRANSITION_EASING}`
            }}
            onError={() => logger.error('Failed to load page image')}
        />}
      </Box>
      
      {/* Click navigation zones */}
      {settings.clickNavigation && <>
          <Box style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: CLICK_NAVIGATION_ZONE_WIDTH,
                cursor: 'pointer'
            }} onClick={settings.readingDirection === 'rtl' ? nextPage : prevPage}/>

          <Box style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: CLICK_NAVIGATION_ZONE_WIDTH,
                cursor: 'pointer'
            }} onClick={settings.readingDirection === 'rtl' ? prevPage : nextPage}/>

        </>}
    </Box>;
});

BasicReader.displayName = 'BasicReader';
