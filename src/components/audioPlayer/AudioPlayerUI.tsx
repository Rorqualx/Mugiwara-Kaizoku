/**
 * AudioPlayerUI Component
 *
 * Composite component that renders the full audio player UI including:
 * - MiniPlayer (persistent bottom bar)
 * - FullscreenPlayer (modal overlay)
 * - Feature modals (SleepTimer, ChapterList, BookmarkList)
 *
 * This component manages the UI state for expanding/collapsing the player
 * and opening feature modals.
 *
 * @module components/audioPlayer/AudioPlayerUI
 */

import { memo, useCallback, useMemo, useState } from 'react';

import type { AudioBookmarkData, BookmarkColor } from '@/types/audioPlayer';
import { api } from '@/utils/api';

import { useAudioPlayerContext } from './AudioPlayerProvider';
import { BookmarkList } from './features/BookmarkList';
import { ChapterList } from './features/ChapterList';
import { SleepTimer } from './features/SleepTimer';
import { FullscreenPlayer } from './FullscreenPlayer';
import { MiniPlayer } from './MiniPlayer';



// ============================================================================
// Types
// ============================================================================

export interface AudioPlayerUIProps {
  /** Z-index for the MiniPlayer */
  miniPlayerZIndex?: number;
  /** Bottom offset for the MiniPlayer (e.g., for mobile nav) */
  bottomOffset?: number;
}

// ============================================================================
// Component
// ============================================================================

function AudioPlayerUIComponent({
  miniPlayerZIndex = 100,
}: AudioPlayerUIProps): JSX.Element {
  const { player } = useAudioPlayerContext();
  const { currentTrack } = player;

  // UI state for modals
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isChapterListOpen, setIsChapterListOpen] = useState(false);
  const [isBookmarkListOpen, setIsBookmarkListOpen] = useState(false);

  // Fetch bookmarks for current track's manga
  const { data: rawBookmarks = [] } = api.audioPlayer.getBookmarks.useQuery(
    { mangaId: currentTrack?.mangaId ?? 0 },
    { enabled: currentTrack !== null }
  );

  // Transform API bookmarks to AudioBookmarkData format
  const bookmarks: AudioBookmarkData[] = useMemo(() => {
    return rawBookmarks.map((b) => ({
      id: b.id,
      userId: b.userId,
      mangaId: b.mangaId,
      chapterId: b.chapterId,
      timestamp: b.timestamp,
      note: b.note ?? undefined,
      label: b.label ?? undefined,
      color: (b.color as BookmarkColor | null) ?? undefined,
      createdAt: b.createdAt,
    }));
  }, [rawBookmarks]);

  // Bookmark mutations
  const addBookmarkMutation = api.audioPlayer.addBookmark.useMutation();
  const removeBookmarkMutation = api.audioPlayer.removeBookmark.useMutation();
  const utils = api.useUtils();

  // Handle expand to fullscreen
  const handleExpand = useCallback((): void => {
    setIsFullscreenOpen(true);
  }, []);

  // Handle collapse from fullscreen
  const handleCollapse = useCallback((): void => {
    setIsFullscreenOpen(false);
  }, []);

  // Handle opening feature modals
  const handleOpenSleepTimer = useCallback((): void => {
    setIsSleepTimerOpen(true);
  }, []);

  const handleOpenChapters = useCallback((): void => {
    setIsChapterListOpen(true);
  }, []);

  const handleOpenBookmarks = useCallback((): void => {
    setIsBookmarkListOpen(true);
  }, []);

  // Handle closing feature modals
  const handleCloseSleepTimer = useCallback((): void => {
    setIsSleepTimerOpen(false);
  }, []);

  const handleCloseChapters = useCallback((): void => {
    setIsChapterListOpen(false);
  }, []);

  const handleCloseBookmarks = useCallback((): void => {
    setIsBookmarkListOpen(false);
  }, []);

  // Handle adding a bookmark
  const handleAddBookmark = useCallback(
    (bookmark: Omit<AudioBookmarkData, 'id' | 'createdAt' | 'userId'>): void => {
      addBookmarkMutation.mutate(
        {
          mangaId: bookmark.mangaId,
          chapterId: bookmark.chapterId,
          timestamp: bookmark.timestamp,
          note: bookmark.note,
          label: bookmark.label,
          color: bookmark.color,
        },
        {
          onSuccess: () => {
            void utils.audioPlayer.getBookmarks.invalidate();
          },
        }
      );
    },
    [addBookmarkMutation, utils.audioPlayer.getBookmarks]
  );

  // Handle deleting a bookmark
  const handleDeleteBookmark = useCallback(
    (id: number): void => {
      removeBookmarkMutation.mutate(
        { bookmarkId: id },
        {
          onSuccess: () => {
            void utils.audioPlayer.getBookmarks.invalidate();
          },
        }
      );
    },
    [removeBookmarkMutation, utils.audioPlayer.getBookmarks]
  );

  return (
    <>
      {/* MiniPlayer - always visible when a track is loaded */}
      <MiniPlayer onExpand={handleExpand} zIndex={miniPlayerZIndex} />

      {/* FullscreenPlayer - modal overlay */}
      <FullscreenPlayer
        opened={isFullscreenOpen}
        onClose={handleCollapse}
        onOpenSleepTimer={handleOpenSleepTimer}
        onOpenChapters={handleOpenChapters}
        onOpenBookmarks={handleOpenBookmarks}
      />

      {/* Sleep Timer Modal */}
      <SleepTimer opened={isSleepTimerOpen} onClose={handleCloseSleepTimer} />

      {/* Chapter List Modal */}
      <ChapterList opened={isChapterListOpen} onClose={handleCloseChapters} />

      {/* Bookmark List Modal */}
      <BookmarkList
        opened={isBookmarkListOpen}
        onClose={handleCloseBookmarks}
        bookmarks={bookmarks}
        onAddBookmark={handleAddBookmark}
        onDeleteBookmark={handleDeleteBookmark}
      />
    </>
  );
}

export const AudioPlayerUI = memo(AudioPlayerUIComponent);
export default AudioPlayerUI;
