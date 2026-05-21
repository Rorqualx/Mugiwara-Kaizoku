// Reader type definitions following Mugiwara-Kaizoku patterns

export interface MangaFile {
  id: string;
  mangaId: number;
  chapterId: number;
  chapterTitle: string;
  format: SupportedFormat;
  totalPages: number;
  metadata?: FileMetadata;
}

export interface FileMetadata {
  title?: string;
  author?: string;
  publisher?: string;
  year?: number;
  tags?: string[];
}

export type SupportedFormat = 'cbz' | 'cbr' | 'pdf' | 'zip';

export interface ReaderSettings {
  readingMode: ReadingMode;
  readingDirection: ReadingDirection;
  backgroundColor: string;
  fitMode: FitMode;
  showToolbar: boolean;
  preloadPages: number;
  doublePageOffset: boolean;
  brightness: number;
  contrast: number;
  enableGestures: boolean;
  enableKeyboard: boolean;
  clickNavigation: boolean;
  smoothScrolling: boolean;
  panelDetection: boolean;
  ocrEnabled: boolean;
}

export type ReadingMode = 
  | 'single' 
  | 'double' 
  | 'continuous_vertical' 
  | 'continuous_horizontal' 
  | 'webtoon';

export type ReadingDirection = 'ltr' | 'rtl';

export type FitMode = 
  | 'fit-width' 
  | 'fit-height' 
  | 'fit-both' 
  | 'original' 
  | 'stretch';

export interface ReadingHistoryItem {
  mangaId: number;
  chapterId: number;
  timestamp: number;
  page?: number;
}

export interface Bookmark {
  id: string;
  mangaId: number;
  chapterId: number;
  page: number;
  note?: string;
  createdAt: number;
}

export interface RenderOptions {
  zoom: number;
  offset: { x: number; y: number };
  mode: ReadingMode;
  fitMode: FitMode;
  filters?: ImageFilters;
}

export interface ImageFilters {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  sharpen?: boolean;
}

export interface ReaderState {
  currentFile: MangaFile | null;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
  settings: ReaderSettings;
  history: ReadingHistoryItem[];
  bookmarks: Bookmark[];
}

export interface PageInfo {
  index: number;
  name: string;
  data: Blob;
  size: number;
}

export interface ReadingProgress {
  mangaId: number;
  chapterId: number;
  currentPage: number;
  totalPages: number;
  lastReadAt: Date;
  completedAt?: Date | null;
}

export interface GestureHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPinchZoom?: (scale: number) => void;
  onPan?: (delta: { x: number; y: number }) => void;
  onDoubleTap?: (position: { x: number; y: number }) => void;
}

export interface ChapterFile {
  filePath: string;
  format: SupportedFormat;
  pageCount: number;
  title: string;
}

export interface DoublePageState {
  showDouble: boolean;
  currentLeftPage: number;
  currentRightPage: number;
  offset: boolean; // For cover pages
}

export interface DoublePageUrls {
  left: string | null;
  right: string | null;
}
