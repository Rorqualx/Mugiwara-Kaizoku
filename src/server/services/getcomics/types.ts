/**
 * GetComics Service Types
 *
 * Type definitions for GetComics scraping and download operations.
 *
 * @module server/services/getcomics/types
 */

/**
 * Supported file host types for DDL extraction
 */
export type FileHostType =
  | 'mediafire'
  | 'mega'
  | 'zippyshare'
  | 'dropapk'
  | 'userscloud'
  | 'direct'
  | 'unknown';

/**
 * Download link extracted from GetComics page
 */
export interface GetComicsDownloadLink {
  /** URL to the download */
  url: string;
  /** Type of file host */
  host: FileHostType;
  /** Display text for the link */
  label: string;
  /** File size if detected */
  size?: string;
  /** Whether this is a main download or mirror */
  isMirror: boolean;
}

/**
 * Search result from GetComics
 */
export interface GetComicsSearchResult {
  /** Unique identifier (slug from URL) */
  id: string;
  /** Comic/manga title */
  title: string;
  /** Full URL to the detail page */
  url: string;
  /** Cover image URL */
  coverUrl?: string;
  /** Publication year if available */
  year?: string;
  /** File format (CBR, CBZ, PDF) */
  format?: string;
  /** File size if available */
  size?: string;
  /** Brief description */
  description?: string;
  /** Source identifier */
  source: 'getcomics';
}

/**
 * Detailed comic page data
 */
export interface GetComicsDetailPage {
  /** Comic title */
  title: string;
  /** Full description/synopsis */
  description?: string;
  /** Cover image URL */
  coverUrl?: string;
  /** Download links extracted from page */
  downloadLinks: GetComicsDownloadLink[];
  /** Tags/categories */
  tags?: string[];
  /** Publisher (Marvel, DC, etc.) */
  publisher?: string;
  /** Publication date */
  publishedDate?: string;
}

/**
 * GetComics service configuration
 */
export interface GetComicsConfig {
  /** Base URL (default: https://getcomics.org) */
  baseUrl: string;
  /** Search URL template with {query} placeholder */
  searchUrl: string;
  /** Rate limit in requests per second */
  rateLimit: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Whether to use FlareSolverr for Cloudflare bypass */
  useFlareSolverr: boolean;
}

/**
 * Default GetComics configuration
 */
export const DEFAULT_GETCOMICS_CONFIG: GetComicsConfig = {
  baseUrl: 'https://getcomics.org',
  searchUrl: 'https://getcomics.org/?s={query}',
  rateLimit: 1,
  timeout: 30000,
  useFlareSolverr: true,
};

/**
 * Patterns for detecting file hosts in URLs
 */
export const FILE_HOST_PATTERNS: Record<FileHostType, RegExp> = {
  mediafire: /mediafire\.com/i,
  mega: /mega\.(nz|co\.nz)/i,
  zippyshare: /zippyshare\.com/i,
  dropapk: /dropapk\.to/i,
  userscloud: /userscloud\.com/i,
  direct: /getcomics\.org\/links/i,
  unknown: /.*/,
};

/**
 * CSS selectors for GetComics page parsing
 */
export const GETCOMICS_SELECTORS = {
  search: {
    /** Container for each search result */
    resultContainer: 'article.post',
    /** Title element */
    title: 'h1.post-title a',
    /** Cover image */
    coverImage: '.post-thumbnail img',
    /** Link to detail page */
    detailLink: 'h1.post-title a',
    /** Post excerpt */
    excerpt: '.post-content',
  },
  detail: {
    /** Main title */
    title: 'h1.post-title',
    /** Content area with description */
    content: '.post-content',
    /** Download links container */
    downloadContainer: '.aio-button-center a, .su-spoiler-content a, .post-content a[href*="download"], .post-content a[href*="mediafire"], .post-content a[href*="mega"], .post-content a[href*="zippyshare"]',
    /** Tags */
    tags: '.post-tag a',
    /** Cover image */
    coverImage: '.post-thumbnail img, .post-content img',
  },
} as const;
