/**
 * Audio Player Type Definitions
 *
 * Centralized types for the native audiobook player feature.
 * Reuses types from audio-extractor where applicable.
 *
 * @module types/audioPlayer
 */

// Re-export types from audio-extractor
export type {
  AudioFormat,
  AudioChapter,
  AudioMetadata,
  AudioExtractionResult,
} from '@/server/services/conversion/utils/audio-extractor';

// ============================================================================
// Core Audio Player Types
// ============================================================================

/**
 * Represents a playable audio track in the player
 */
export interface AudioTrack {
  /** Database chapter ID */
  chapterId: number;
  /** Parent manga ID */
  mangaId: number;
  /** Display title */
  title: string;
  /** Parent manga title */
  mangaTitle: string;
  /** Artist/author name */
  artist: string | undefined;
  /** Album/series name */
  album: string | undefined;
  /** File path on server */
  filePath: string;
  /** Audio format */
  format: string;
  /** Duration in seconds */
  duration: number;
  /** Cover image URL */
  coverUrl: string | undefined;
  /** Chapters within the audio file (for M4B) */
  chapters: AudioTrackChapter[];
  /** Track index in playlist */
  index: number;
}

/**
 * Chapter marker within an audio track (for M4B files)
 */
export interface AudioTrackChapter {
  /** Chapter title */
  title: string;
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Duration in seconds */
  duration: number;
  /** Chapter index */
  index: number;
}

// ============================================================================
// Playback State Types
// ============================================================================

/**
 * Audio player playback state
 */
export interface AudioPlaybackState {
  /** Currently playing track */
  currentTrack: AudioTrack | null;
  /** Is audio playing */
  isPlaying: boolean;
  /** Is audio loading */
  isLoading: boolean;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Buffered time in seconds */
  bufferedTime: number;
  /** Volume level (0-1) */
  volume: number;
  /** Is muted */
  isMuted: boolean;
  /** Playback speed multiplier */
  playbackSpeed: number;
  /** Current chapter index (for M4B) */
  currentChapterIndex: number;
  /** Has playback error */
  hasError: boolean;
  /** Error message */
  errorMessage: string | undefined;
}

/**
 * Audio player UI state
 */
export interface AudioPlayerUIState {
  /** Is mini player visible */
  isMiniPlayerVisible: boolean;
  /** Is fullscreen player open */
  isFullscreenOpen: boolean;
  /** Is chapter list drawer open */
  isChapterListOpen: boolean;
  /** Is bookmark list drawer open */
  isBookmarkListOpen: boolean;
  /** Is sleep timer modal open */
  isSleepTimerOpen: boolean;
  /** Is speed selector open */
  isSpeedSelectorOpen: boolean;
}

// ============================================================================
// Sleep Timer Types
// ============================================================================

/**
 * Sleep timer mode
 */
export type SleepTimerMode = 'time' | 'chapter' | 'off';

/**
 * Sleep timer preset options (in minutes)
 */
export type SleepTimerPreset = 5 | 10 | 15 | 30 | 45 | 60;

/**
 * Sleep timer state
 */
export interface SleepTimerState {
  /** Is timer active */
  isActive: boolean;
  /** Timer mode */
  mode: SleepTimerMode;
  /** End time as timestamp (for 'time' mode) */
  endTime: number | null;
  /** Remaining time in seconds */
  remainingSeconds: number;
  /** Should fade volume before stopping */
  fadeBeforeStop: boolean;
}

// ============================================================================
// Bookmark Types
// ============================================================================

/**
 * Audio bookmark color options
 */
export type BookmarkColor =
  | '#FF6B6B' // Red
  | '#4ECDC4' // Teal
  | '#45B7D1' // Blue
  | '#96CEB4' // Green
  | '#FFEAA7' // Yellow
  | '#DDA0DD' // Purple
  | '#FFB347'; // Orange

/**
 * Audio bookmark data for UI
 */
export interface AudioBookmarkData {
  /** Database ID */
  id: number;
  /** User ID */
  userId: string;
  /** Manga ID */
  mangaId: number;
  /** Chapter ID */
  chapterId: number;
  /** Timestamp in seconds */
  timestamp: number;
  /** Optional note */
  note: string | undefined;
  /** Short label */
  label: string | undefined;
  /** Visual color */
  color: BookmarkColor | undefined;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Create bookmark input
 */
export interface CreateBookmarkInput {
  mangaId: number;
  chapterId: number;
  timestamp: number;
  note?: string;
  label?: string;
  color?: BookmarkColor;
}

/**
 * Update bookmark input
 */
export interface UpdateBookmarkInput {
  id: number;
  note?: string;
  label?: string;
  color?: BookmarkColor;
}

// ============================================================================
// Progress Types
// ============================================================================

/**
 * Audio playback progress data for UI
 */
export interface AudioProgressData {
  /** Database ID */
  id: number;
  /** User ID */
  userId: string;
  /** Manga ID */
  mangaId: number;
  /** Chapter ID */
  chapterId: number;
  /** Current position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Saved playback speed */
  playbackSpeed: number;
  /** Saved volume */
  volume: number;
  /** Last played timestamp */
  lastPlayedAt: Date;
  /** Completion timestamp */
  completedAt: Date | undefined;
}

/**
 * Update progress input
 */
export interface UpdateProgressInput {
  mangaId: number;
  chapterId: number;
  currentTime: number;
  duration: number;
  playbackSpeed?: number;
  volume?: number;
}

// ============================================================================
// Settings Types
// ============================================================================

/**
 * Playback speed options
 */
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2 | 2.5 | 3;

/**
 * Audio player settings
 */
export interface AudioPlayerSettings {
  /** Default playback speed */
  defaultPlaybackSpeed: PlaybackSpeed;
  /** Skip forward seconds */
  defaultSkipForward: number;
  /** Skip backward seconds */
  defaultSkipBackward: number;
  /** Default sleep timer (minutes) */
  sleepTimerDefault: SleepTimerPreset | null;
  /** Remember playback position */
  rememberPosition: boolean;
  /** Auto-play next track */
  autoPlayNext: boolean;
  /** Show remaining time (vs elapsed) */
  showRemainingTime: boolean;
  /** Enable haptic feedback on mobile */
  hapticFeedback: boolean;
}

/**
 * Default audio player settings
 */
export const DEFAULT_AUDIO_PLAYER_SETTINGS: AudioPlayerSettings = {
  defaultPlaybackSpeed: 1,
  defaultSkipForward: 30,
  defaultSkipBackward: 10,
  sleepTimerDefault: null,
  rememberPosition: true,
  autoPlayNext: true,
  showRemainingTime: false,
  hapticFeedback: true,
};

// ============================================================================
// Listening Statistics Types
// ============================================================================

/**
 * Listening history entry
 */
export interface ListeningHistoryEntry {
  /** Database ID */
  id: number;
  /** User ID */
  userId: string;
  /** Manga ID */
  mangaId: number;
  /** Chapter ID */
  chapterId: number;
  /** Time listened in seconds */
  timeListened: number;
  /** Start position */
  startTime: number;
  /** End position */
  endTime: number;
  /** Playback speed during session */
  playbackSpeed: number;
  /** Session start time */
  startedAt: Date;
  /** Session end time */
  endedAt: Date;
}

/**
 * Daily listening analytics
 */
export interface DailyListeningAnalytics {
  /** Date */
  date: Date;
  /** Minutes listened */
  minutesListened: number;
  /** Chapters completed */
  chaptersCompleted: number;
  /** Audiobooks completed */
  audiobooksCompleted: number;
}

/**
 * Listening statistics summary
 */
export interface ListeningStatsSummary {
  /** Total time listened all-time (minutes) */
  totalMinutesAllTime: number;
  /** Total time listened this week (minutes) */
  totalMinutesThisWeek: number;
  /** Total time listened today (minutes) */
  totalMinutesToday: number;
  /** Total chapters completed */
  totalChaptersCompleted: number;
  /** Total audiobooks completed */
  totalAudiobooksCompleted: number;
  /** Current listening streak (days) */
  currentStreak: number;
  /** Longest listening streak (days) */
  longestStreak: number;
  /** Daily analytics for chart */
  dailyAnalytics: DailyListeningAnalytics[];
}

// ============================================================================
// Media Session Types
// ============================================================================

/**
 * Media session metadata for OS controls
 */
export interface MediaSessionData {
  title: string;
  artist: string;
  album: string;
  artwork: MediaImage[];
}

/**
 * Media session artwork
 */
export interface MediaImage {
  src: string;
  sizes: string;
  type: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Recently played track for "Continue Listening"
 */
export interface RecentlyPlayedTrack {
  /** Manga ID */
  mangaId: number;
  /** Manga title */
  mangaTitle: string;
  /** Chapter ID */
  chapterId: number;
  /** Chapter title */
  chapterTitle: string;
  /** Cover image URL */
  coverUrl: string | undefined;
  /** Progress percentage (0-100) */
  progressPercent: number;
  /** Last played timestamp */
  lastPlayedAt: Date;
  /** Remaining time in seconds */
  remainingTime: number;
}

/**
 * Audio file info from server
 */
export interface AudioFileInfo {
  /** File exists */
  exists: boolean;
  /** File path */
  filePath: string;
  /** File size in bytes */
  fileSize: number;
  /** MIME type */
  mimeType: string;
  /** Audio format */
  format: string;
  /** Duration in seconds */
  duration: number;
  /** Has embedded chapters */
  hasChapters: boolean;
  /** Chapter count */
  chapterCount: number;
}

// ============================================================================
// Store Action Types
// ============================================================================

/**
 * Audio player actions interface
 */
export interface AudioPlayerActions {
  // Playback controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;
  seek: (time: number) => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;

  // Track management
  loadTrack: (track: AudioTrack) => Promise<void>;
  clearTrack: () => void;
  playNext: () => void;
  playPrevious: () => void;

  // Settings
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;

  // Chapters (M4B)
  goToChapter: (index: number) => void;
  nextChapter: () => void;
  previousChapter: () => void;

  // Sleep timer
  setSleepTimer: (minutes: number | 'chapter') => void;
  cancelSleepTimer: () => void;

  // UI state
  showMiniPlayer: () => void;
  hideMiniPlayer: () => void;
  openFullscreen: () => void;
  closeFullscreen: () => void;
  toggleChapterList: () => void;
  toggleBookmarkList: () => void;
  toggleSleepTimer: () => void;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Mini player component props
 */
export interface MiniPlayerProps {
  className?: string;
  onExpand?: () => void;
}

/**
 * Fullscreen player component props
 */
export interface FullscreenPlayerProps {
  onClose?: () => void;
}

/**
 * Progress slider component props
 */
export interface ProgressSliderProps {
  currentTime: number;
  duration: number;
  bufferedTime?: number;
  onSeek: (time: number) => void;
  showTimes?: boolean;
  showRemaining?: boolean;
  disabled?: boolean;
}

/**
 * Playback controls component props
 */
export interface PlaybackControlsProps {
  isPlaying: boolean;
  isLoading?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSkipForward?: () => void;
  onSkipBackward?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Speed control component props
 */
export interface SpeedControlProps {
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}

/**
 * Volume control component props
 */
export interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

/**
 * Sleep timer component props
 */
export interface SleepTimerProps {
  isActive: boolean;
  remainingSeconds: number;
  onSetTimer: (minutes: number | 'chapter') => void;
  onCancelTimer: () => void;
}

/**
 * Chapter list component props
 */
export interface ChapterListProps {
  chapters: AudioTrackChapter[];
  currentChapterIndex: number;
  onChapterSelect: (index: number) => void;
}

/**
 * Bookmark list component props
 */
export interface BookmarkListProps {
  bookmarks: AudioBookmarkData[];
  currentTime: number;
  onBookmarkSelect: (timestamp: number) => void;
  onBookmarkDelete: (id: number) => void;
  onBookmarkEdit: (bookmark: AudioBookmarkData) => void;
}
