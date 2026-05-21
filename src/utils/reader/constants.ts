/**
 * Reader Constants
 *
 * Centralized configuration values for the reader implementation.
 * All magic numbers extracted from reader components, hooks, and services.
 */

// =============================================================================
// GESTURE THRESHOLDS
// =============================================================================

/** Minimum velocity (0-1) required to detect a swipe gesture */
export const SWIPE_VELOCITY_THRESHOLD = 0.5;

/** Minimum pixel distance for mobile swipe detection */
export const SWIPE_GESTURE_THRESHOLD = 50;

/** Minimum zoom level (0.5x) */
export const MIN_ZOOM_LEVEL = 0.5;

/** Maximum zoom level (3x) */
export const MAX_ZOOM_LEVEL = 3;

/** Distance from zoom=1 to trigger reset back to 1 */
export const ZOOM_RESET_THRESHOLD = 0.1;

/** Zoom change per mouse wheel delta unit */
export const WHEEL_ZOOM_DELTA_FACTOR = -0.01;

/** Time window (ms) to detect double tap */
export const DOUBLE_TAP_INTERVAL_MS = 300;

/** Pixel radius within which taps count as same position for double tap */
export const DOUBLE_TAP_DISTANCE_RADIUS = 50;

/** Zoom increment/decrement step for keyboard controls */
export const ZOOM_INCREMENT_STEP = 0.25;

/** Default zoom level for double tap toggle */
export const DOUBLE_TAP_ZOOM_LEVEL = 2;

// =============================================================================
// MOBILE CONTROLS
// =============================================================================

/** Delay (ms) before auto-hiding mobile controls */
export const CONTROLS_AUTO_HIDE_DELAY_MS = 3000;

/** Haptic feedback vibration duration (ms) */
export const HAPTIC_FEEDBACK_DURATION_MS = 10;

// =============================================================================
// PRELOADER SETTINGS
// =============================================================================

/** Maximum number of pages to keep in preloader cache */
export const PRELOADER_MAX_CACHE_SIZE = 20;

/** Cache entry expiration time (ms) - 5 minutes */
export const PRELOADER_CACHE_TTL_MS = 5 * 60 * 1000;

/** Reading speed threshold (ms) to classify as "fast reader" */
export const FAST_READER_THRESHOLD_MS = 3000;

/** Maximum adaptive preload buffer for fast readers */
export const MAX_ADAPTIVE_BUFFER_PAGES = 10;

/** Ratio of buffer to preload forward (70%) */
export const FORWARD_PRELOAD_RATIO = 0.7;

/** Ratio of buffer to preload backward (30%) */
export const BACKWARD_PRELOAD_RATIO = 0.3;

/** Minimum interval (ms) to count as valid page view for speed calculation */
export const MIN_READING_INTERVAL_MS = 500;

/** Maximum interval (ms) to count as valid page view (1 minute) */
export const MAX_READING_INTERVAL_MS = 60000;

/** Number of recent page views to track for reading speed */
export const READING_SPEED_HISTORY_SIZE = 20;

/** Default average reading speed (ms) when no history available */
export const DEFAULT_READING_SPEED_MS = 5000;

// =============================================================================
// PROGRESS & TIMING
// =============================================================================

/** Debounce delay (ms) for auto-saving reading progress */
export const PROGRESS_SAVE_DEBOUNCE_MS = 500;

/** Mock delay (ms) for page extraction in BasicReader */
export const PAGE_EXTRACTION_DELAY_MS = 500;

// =============================================================================
// API CACHE SETTINGS
// =============================================================================

/** Browser cache max-age for page API responses (24 hours in seconds) */
export const PAGE_CACHE_MAX_AGE_SECONDS = 86400;

/** Maximum response size limit for page API */
export const API_RESPONSE_LIMIT_MB = '50mb';

// =============================================================================
// UI DIMENSIONS
// =============================================================================

/** Width of clickable navigation zones on left/right edges */
export const CLICK_NAVIGATION_ZONE_WIDTH = '30%';

/** Width (px) of chapter jump menu dropdown */
export const CHAPTER_MENU_WIDTH = 300;

/** Maximum height of chapter menu dropdown */
export const CHAPTER_MENU_MAX_HEIGHT = '400px';

/** Width (px) of progress bar in toolbar */
export const PROGRESS_BAR_WIDTH = 100;

/** Gap between pages in double-page spread mode */
export const DOUBLE_PAGE_GAP = '2px';

// =============================================================================
// CONTINUOUS VERTICAL READER
// =============================================================================

/** Number of pages to load initially in vertical scroll mode */
export const INITIAL_PRELOAD_COUNT = 3;

/** Root margin for intersection observer lazy loading */
export const INTERSECTION_OBSERVER_MARGIN = '100px';

/** Visibility threshold for intersection observer (0-1) */
export const INTERSECTION_OBSERVER_THRESHOLD = 0.5;

/** Minimum height for page containers in vertical mode */
export const PAGE_CONTAINER_MIN_HEIGHT = '600px';

/** Page indicator position from bottom edge */
export const PAGE_INDICATOR_BOTTOM = 10;

/** Page indicator position from right edge */
export const PAGE_INDICATOR_RIGHT = 10;

/** Page indicator vertical padding */
export const PAGE_INDICATOR_PADDING_Y = '4px';

/** Page indicator horizontal padding */
export const PAGE_INDICATOR_PADDING_X = '8px';

/** Page indicator border radius */
export const PAGE_INDICATOR_BORDER_RADIUS = '4px';

/** Page indicator font size */
export const PAGE_INDICATOR_FONT_SIZE = '12px';

// =============================================================================
// PERFORMANCE OPTIMIZATIONS
// =============================================================================

/** Distance threshold (pages) for content-visibility optimization */
export const CONTENT_VISIBILITY_THRESHOLD = 3;

/** Maximum concurrent preload requests to avoid network congestion */
export const MAX_CONCURRENT_PRELOADS = 3;

/** Page transition duration in milliseconds */
export const PAGE_TRANSITION_DURATION_MS = 150;

/** Page transition CSS timing function */
export const PAGE_TRANSITION_EASING = 'ease-out';
