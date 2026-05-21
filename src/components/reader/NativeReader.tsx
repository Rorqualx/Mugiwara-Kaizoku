// Native Reader Component - Full implementation with useReader hook
import React, { useCallback, useEffect, useState } from 'react';

import { Box, LoadingOverlay } from '@mantine/core';
import { useFullscreen } from '@mantine/hooks';
// Icon imports moved to ReaderToolbar component
import { useRouter } from 'next/router';

import { useImageRetry } from '@/hooks/reader/useImageRetry';
import { useReader } from '@/hooks/reader/useReader';
import { useReaderBookmarks } from '@/hooks/reader/useReaderBookmarks';
import { useReaderKeyboard } from '@/hooks/reader/useReaderKeyboard';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import { ContinuousVerticalReader } from './ContinuousVerticalReader';
import { DoublePageCanvas } from './DoublePageCanvas';
import { PageErrorOverlay } from './PageErrorOverlay';
import { ReaderCanvas } from './ReaderCanvas';
import { ReaderSettingsModal } from './ReaderSettingsModal';
import { ReaderStateHandler } from './ReaderStateHandler';
import { ReaderToolbar } from './ReaderToolbar';

interface ChapterNavigation {
  prevChapter: { id: number; index: number; title: string | null; pageCount: number | null } | null | undefined;
  currentChapter: { id: number; index: number; title: string | null; pageCount: number | null } | null | undefined;
  nextChapter: { id: number; index: number; title: string | null; pageCount: number | null } | null | undefined;
  totalChapters: number;
  currentIndex: number;
  chapters: Array<{ id: number; index: number; title: string | null; pageCount: number | null }>;
}
// eslint-disable-next-line complexity -- Reader orchestrator composing multiple hooks (archive, nav, bookmarks, keyboard, file sources)
export function NativeReader(): React.JSX.Element {
    const router = useRouter();
    const { mangaId, chapterId } = router.query;
    const { toggle: toggleFullscreen, fullscreen } = useFullscreen();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const {
        file,
        currentPage,
        totalPages,
        isLoading,
        error,
        settings,
        loadChapter,
        nextPage,
        prevPage,
        goToPage,
        updateSettings,
        getPageUrl,
        currentDoublePageUrls,
        chapterNavigation,
        nextChapter,
        prevChapter,
        jumpToChapter,
        reloadCurrentChapter,
    } = useReader();

    // File sources for source toggle
    const numericChapterId = chapterId ? toNumberId(chapterId) : undefined;
    const fileSourcesQuery = trpc.reader.getChapterFileSources.useQuery(
        { chapterId: numericChapterId ?? 0 },
        { enabled: numericChapterId !== undefined }
    );
    const switchSourceMutation = trpc.reader.switchChapterFileSource.useMutation({
        onSuccess: () => {
            void reloadCurrentChapter();
            void fileSourcesQuery.refetch();
        },
    });

    const fileSources = fileSourcesQuery.data?.map((s: { id: number; fileName: string; sourceType: string; isActive: boolean }) => ({
        id: s.id,
        fileName: s.fileName,
        sourceType: s.sourceType,
        isActive: s.isActive,
    }));

    const handleSwitchSource = useCallback((chapterFileId: number) => {
        if (numericChapterId === undefined) return;
        switchSourceMutation.mutate({ chapterId: numericChapterId, chapterFileId });
    }, [numericChapterId, switchSourceMutation]);

    // Bookmark management
    const { isBookmarked, toggleBookmark } = useReaderBookmarks({
        mangaId,
        chapterId,
        currentPage,
        file,
    });
    // Load chapter on mount or when URL params change
    useEffect(() => {
        if (mangaId && chapterId) {
            void loadChapter(toNumberId(mangaId), toNumberId(chapterId));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mangaId, chapterId]);
    // Reset image loaded state when page changes
    useEffect(() => {
        setImageLoaded(false);
    }, [currentPage]);

    // Keyboard navigation
    useReaderKeyboard({
        enabled: settings.enableKeyboard,
        settingsOpen,
        settings,
        currentPage,
        totalPages,
        nextPage,
        prevPage,
        goToPage,
        toggleFullscreen,
        toggleBookmark,
        setSettingsOpen,
        nextChapter,
        prevChapter,
    });

    // Swipe handlers
    const handleSwipeLeft = useCallback((): void => {
        settings.readingDirection === 'rtl' ? prevPage() : nextPage();
    }, [settings.readingDirection, prevPage, nextPage]);

    const handleSwipeRight = useCallback((): void => {
        settings.readingDirection === 'rtl' ? nextPage() : prevPage();
    }, [settings.readingDirection, nextPage, prevPage]);

    // Click navigation handlers
    const handleLeftClick = useCallback((): void => {
        settings.readingDirection === 'rtl' ? nextPage() : prevPage();
    }, [settings.readingDirection, nextPage, prevPage]);

    const handleRightClick = useCallback((): void => {
        settings.readingDirection === 'rtl' ? prevPage() : nextPage();
    }, [settings.readingDirection, prevPage, nextPage]);

    // Get current page URL
    const currentPageUrl = file ? getPageUrl(currentPage) : null;

    // Auto-retry with exponential backoff on page load failures
    const {
      currentSrc: retrySrc,
      isRetrying,
      hasFailed: imageError,
      handleError: handleImageError,
      manualRetry,
    } = useImageRetry({ src: currentPageUrl });

    // Handle loading, error, and empty states
    if (isLoading || error || !file) {
        return (
            <ReaderStateHandler
                isLoading={isLoading}
                error={error}
                hasFile={!!file}
                backgroundColor={settings.backgroundColor}
                mangaId={mangaId}
                chapterId={chapterId}
                loadChapter={loadChapter}
            />
        );
    }

    return <>
      <Box h="100vh" bg={settings.backgroundColor} style={{
            overflow: 'hidden'
        }}>


        {/* Toolbar */}
        <ReaderToolbar
          visible={settings.showToolbar}
          fullscreen={fullscreen}
          mangaId={mangaId}
          file={file}
          currentPage={currentPage}
          totalPages={totalPages}
          chapterNavigation={chapterNavigation as ChapterNavigation | null}
          prevPage={prevPage}
          nextPage={nextPage}
          prevChapter={prevChapter}
          nextChapter={nextChapter}
          jumpToChapter={jumpToChapter}
          isBookmarked={isBookmarked}
          toggleBookmark={toggleBookmark}
          toggleFullscreen={toggleFullscreen}
          setSettingsOpen={setSettingsOpen}
          {...(fileSources ? { fileSources } : {})}
          onSwitchSource={handleSwitchSource}
        />

        {/* Image Display */}
        <Box style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: settings.showToolbar && !fullscreen ? '60px' : '0',
            position: 'relative'
        }}>

          {/* Continuous vertical/webtoon mode */}
          {(settings.readingMode === 'continuous_vertical' || settings.readingMode === 'webtoon') ? (
            <ContinuousVerticalReader
              totalPages={totalPages}
              currentPage={currentPage}
              getPageUrl={getPageUrl}
              settings={settings}
              onPageChange={(page) => goToPage(page)}
            />
          ) : (
            <ReaderCanvas settings={settings} onSwipeLeft={handleSwipeLeft} onSwipeRight={handleSwipeRight}>

              {settings.readingMode === 'double' ? <DoublePageCanvas leftUrl={currentDoublePageUrls.left} rightUrl={currentDoublePageUrls.right} settings={settings} onLoad={() => setImageLoaded(true)} currentPage={currentPage}/> : <>
                  {!imageLoaded && !imageError && !isRetrying && <LoadingOverlay visible/>}

                  {isRetrying && <LoadingOverlay visible />}

                  {imageError ? (
                    <PageErrorOverlay
                      pageNumber={currentPage}
                      backgroundColor={settings.backgroundColor}
                      onRetry={() => {
                        setImageLoaded(false);
                        manualRetry();
                      }}
                    />
                  ) : retrySrc && (
                    <img
                      key={retrySrc}
                      src={retrySrc}
                      alt={`Page ${currentPage}`}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: settings.fitMode === 'fit-width' ? 'contain' : settings.fitMode as React.CSSProperties['objectFit'],
                        filter: `brightness(${settings.brightness}) contrast(${settings.contrast})`,
                        display: imageLoaded ? 'block' : 'none'
                      }}
                      onLoad={() => setImageLoaded(true)}
                      onError={(e) => {
                        const img = e.currentTarget;
                        logger.error('Failed to load page image', { src: img.src, naturalWidth: img.naturalWidth, page: currentPage });
                        handleImageError();
                      }}
                    />
                  )}
                </>}
            </ReaderCanvas>
          )}
        </Box>

        {/* Click navigation zones */}
        {settings.clickNavigation && <>
            <Box style={{
                position: 'absolute',
                left: 0,
                top: settings.showToolbar && !fullscreen ? '60px' : 0,
                bottom: 0,
                width: '30%',
                cursor: 'pointer',
                zIndex: 5
            }} onClick={handleLeftClick}/>

            <Box style={{
                position: 'absolute',
                right: 0,
                top: settings.showToolbar && !fullscreen ? '60px' : 0,
                bottom: 0,
                width: '30%',
                cursor: 'pointer',
                zIndex: 5
            }} onClick={handleRightClick}/>

          </>}
      </Box>

      {/* Settings Modal */}
      <ReaderSettingsModal
        opened={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
      />
    </>;
}
