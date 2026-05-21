/**
 * Chapter Detail Service - Constants
 *
 * Configuration constants for chapter detail fetching.
 * Includes cache configuration, circuit breaker settings,
 * performance defaults, and CSS selectors for image extraction.
 *
 * @module chapter-detail/constants
 */

/**
 * Cache configuration
 *
 * Two-tier caching strategy:
 * - L1: In-memory cache (5 min TTL, 500 entries max)
 * - L2: Redis/persistent cache (24 hour TTL)
 */
export const CACHE_CONFIG = {
  /** Cache key namespace prefix */
  namespace: 'fandom:chapter-details',
  /** Time-to-live for L2 cache in milliseconds (24 hours) */
  ttlMs: 24 * 60 * 60 * 1000,
  /** Maximum entries in L1 cache */
  l1MaxSize: 500,
  /** Time-to-live for L1 cache in milliseconds (5 minutes) */
  l1TtlMs: 5 * 60 * 1000,
} as const;

/**
 * Circuit breaker configuration
 *
 * Protects against cascading failures when Fandom is degraded.
 * Opens circuit after consecutive failures, then tests recovery
 * after timeout period.
 */
export const CIRCUIT_BREAKER_CONFIG = {
  /** Open circuit after this many consecutive failures */
  threshold: 15,
  /** Wait this long before attempting recovery (milliseconds) */
  timeout: 30000,
  /** Close circuit after this many consecutive successes */
  recoveryThreshold: 3,
} as const;

/**
 * Performance defaults
 *
 * Default values for batch processing, rate limiting, and HTTP connection pooling.
 */
export const PERFORMANCE_DEFAULTS = {
  /** Default batch size for concurrent requests */
  batchSize: 75,
  /** Default delay between batches (milliseconds) */
  delayMs: 50,
  /** Default maximum retry attempts per request */
  maxRetries: 3,
  /** Maximum concurrent HTTP sockets */
  maxSockets: 150,
  /** Maximum idle HTTP sockets to keep alive */
  maxFreeSockets: 50,
  /** Request timeout in milliseconds */
  requestTimeout: 10000,
} as const;

/**
 * Axios configuration for HTTP requests
 *
 * Optimized configuration for Fandom wiki scraping with:
 * - Connection pooling (150 max sockets, 50 keep-alive)
 * - FIFO request scheduling for predictable behavior
 * - Browser-like User-Agent for compatibility
 * - Fast timeout for quick failure detection
 */
export const AXIOS_CONFIG = {
  /** Request timeout in milliseconds (reduced for faster failure detection) */
  timeout: PERFORMANCE_DEFAULTS.requestTimeout,
  /** Maximum number of redirects to follow */
  maxRedirects: 2,
  /** HTTP headers sent with each request */
  headers: {
    'User-Agent': 'MugiwaraKaizoku/1.0 (manga-metadata-fetcher; +https://github.com/mugiwara-kaizoku)',
  },
  /** Connection pooling configuration */
  connectionPool: {
    /** Enable keep-alive for connection reuse */
    keepAlive: true,
    /** Keep-alive timeout in milliseconds */
    keepAliveMsecs: 1000,
    /** Maximum concurrent connections */
    maxSockets: PERFORMANCE_DEFAULTS.maxSockets,
    /** Maximum idle connections to keep open */
    maxFreeSockets: PERFORMANCE_DEFAULTS.maxFreeSockets,
    /** Socket timeout in milliseconds */
    timeout: PERFORMANCE_DEFAULTS.requestTimeout,
    /** Request scheduling strategy (FIFO = first-in-first-out) */
    scheduling: 'fifo' as const,
  },
} as const;

/**
 * Image selector priorities for finding chapter cover images
 *
 * Ordered from most specific/reliable to general fallbacks.
 * Tested against various Fandom wiki structures including:
 * - Modern Fandom (Fire Force)
 * - Portable infoboxes
 * - Traditional infoboxes
 * - Gallery layouts
 *
 * Each selector is tried in order until an image is found.
 */
export const IMAGE_SELECTORS = [
  // Portable infobox — HIGHEST PRIORITY (most reliable cover image location)
  '.portable-infobox .pi-image-thumbnail',
  '.portable-infobox .pi-image img',
  'aside.portable-infobox .pi-image img',
  '.pi-image-thumbnail',
  '.pi-image img',
  '.pi-image-collection img',

  // Traditional infobox
  '.infobox .image img',
  '.infobox-image img',
  '.infoboxpic img',
  'td.infoboxpic img',
  '.infobox .infoboxpic img',
  'table .infoboxpic img',
  '.infobox img:first',
  'table.infobox img:first',

  // Cover-specific selectors
  'img[alt*="cover" i]',
  '.chapter-cover img',
  '.chapter-image img',

  // Tabbed content (Fire Force style)
  'img[data-relevant="1"]',
  '.wds-tab__content.wds-is-current img',
  '.wds-tab__content img',

  // Chapter-specific selectors
  'img[alt*="Chapter"]',
  'img[alt*="chapter"]',

  // General infobox
  '.infobox img',
  '.portable-infobox img',

  // MediaWiki file description (broad — lower priority to avoid decorative images)
  'a.mw-file-description img',
  '.mw-file-description.image img',
  'a.image img',
  'figure.mw-file-description img',
  '.image img',

  // General mw-file-element — LOW priority (matches ANY wiki image including
  // decorative quote icons, must be after infobox/cover selectors)
  'img.mw-file-element',

  // Gallery images
  '.wikia-gallery-item img:first',
  '.gallery .thumb img:first',
  '#gallery-0 img:first',

  // Article first image as fallback
  '#WikiaArticle .image img:first',
  '.WikiaArticle .image img:first',
  '.mw-parser-output .image img:first',
  'figure.image img:first',

  // For chapters without infoboxes
  '.mw-parser-output img:not([width="1"])',
  '#mw-content-text img:not([alt*="Wiki"])',
  '.page__main img:not([alt*="Wiki"])',
  'article img[src*="/revision/"]'
] as const;
