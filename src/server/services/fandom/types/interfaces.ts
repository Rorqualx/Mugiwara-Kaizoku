/**
 * Fandom API Types and Interfaces
 */

// Fandom page metadata interface
export interface FandomPageMetadata {
  author?: string;
  chapters?: string;
  volumes?: string;
  status?: string;
  published?: string;
  volumesListUrl?: string;
  format?: string;
  gallery?: string[];
  [key: string]: unknown; // Allow additional properties
}

// MediaWiki API Types
export interface MediaWikiSearchResult {
  pageid: number;
  ns: number;
  title: string;
  snippet?: string;
  size?: number;
  wordcount?: number;
  timestamp?: string;
}

export interface MediaWikiPage {
  pageid: number;
  ns: number;
  title: string;
  revisions?: Array<{
    slots?: {
      main?: {
        '*': string;
        contentmodel: string;
        contentformat: string;
      };
    };
  }>;
  categories?: Array<{
    ns: number;
    title: string;
  }>;
  images?: Array<{
    ns: number;
    title: string;
  }>;
  pageprops?: {
    infoboxes?: string;
    [key: string]: unknown;
  };
}

export interface MediaWikiImageInfo {
  url: string;
  descriptionurl: string;
  descriptionshorturl: string;
  size?: number;
  width?: number;
  height?: number;
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  mime?: string;
}

// Fandom v1 API Types
export interface FandomV1SearchItem {
  id: number;
  title: string;
  url: string;
  ns: number;
  quality?: number;
  snippet?: string;
}

export interface FandomV1ArticleDetails {
  id: number;
  title: string;
  ns: number;
  url: string;
  type: string;
  abstract: string;
  thumbnail?: string;
  original_dimensions?: {
    width: number;
    height: number;
  };
}

export interface FandomV1SimpleArticle {
  sections: Array<{
    title: string;
    level: number;
    content?: Array<{
      type: string;
      text?: string;
      elements?: unknown[];
    }>;
    images?: Array<{
      src: string;
      caption?: string;
    }>;
  }>;
}

// Portable Infobox Types
export interface PortableInfoboxData {
  type: 'infobox';
  data: Array<InfoboxItem>;
}

export type InfoboxItem =
  | InfoboxTitle
  | InfoboxData
  | InfoboxImage
  | InfoboxGroup
  | InfoboxHeader;

export interface InfoboxTitle {
  type: 'title';
  data: {
    value: string;
  };
}

export interface InfoboxData {
  type: 'data';
  data: {
    label: string;
    value: string;
    source?: string;
  };
}

export interface InfoboxImage {
  type: 'image';
  data: {
    url?: string;
    caption?: string;
    source?: string;
  }[];
}

export interface InfoboxGroup {
  type: 'group';
  data: {
    value: Array<InfoboxItem>;
    layout?: string;
  };
}

export interface InfoboxHeader {
  type: 'header';
  data: {
    value: string;
  };
}

// Parsed Character Data
export interface FandomCharacterData {
  basicInfo: {
    name: string;
    pageId: number;
    url: string;
  };
  stats: Record<string, string>;
  images: Array<{
    title: string;
    url: string;
    thumburl?: string;
    width?: number;
    height?: number;
  }>;
  categories: string[];
  sections?: Array<{
    title: string;
    content: string;
  }>;
  infobox?: PortableInfoboxData[];
}

// Manga Series Data - Rich Unified Structure
// Merges capabilities from static FandomService and dynamic EnhancedFandomService
export interface FandomMangaData {
  // === Core identification ===
  title: string;
  alternativeTitles?: string[];

  // === Basic metadata (compatibility fields) ===
  author?: string;
  publisher?: string;
  magazine?: string;
  published?: string;
  genres?: string[];
  demographic?: string;
  status?: string;
  format?: string;

  // === Description system ===
  synopsis?: string; // Primary synopsis (compatibility)
  description?: string; // Alias for synopsis (compatibility)
  descriptions?: Record<string, string>; // Dynamic sections (Plot, Characters, Trivia, etc.)
  reception?: string; // Critical reception (compatibility)

  // === Cover art system ===
  coverImage?: string; // Primary cover (compatibility - aliases to coverArt.primary)
  images?: string[]; // Gallery images (compatibility)
  coverArt?: {
    primary?: string; // Main cover image
    gallery?: string[]; // Full gallery of images
    volumeCovers?: string[]; // Volume-specific covers
  };
  gallery?: string[]; // Top-level gallery alias (compatibility)

  // === Volume/Chapter counts (compatibility) ===
  volumes?: string;  // Total volumes as string
  chapters?: string; // Total chapters as string
  totalChapters?: number; // As number (compatibility)

  // === Rich volume list ===
  volumeList?: Array<{
    volumeNumber?: number;
    number?: number; // Alias for volumeNumber
    title?: string;
    url?: string;
    coverUrl?: string;
    coverImage?: string;
    releaseDate?: string;
    releaseDateEn?: string;
    isbn?: string;
    isbnEn?: string;
    description?: string;
    pageCount?: number;
    chapterCount?: number;
    chapters?: Array<{
      chapterNumber?: string;
      number?: number | string;
      title?: string;
      url?: string;
      summary?: string;
      coverImage?: string;
      pages?: number;
      releaseDate?: string;
      alternativeTitles?: string[];
    }>;
  }>;

  // === Rich chapter list ===
  chapterList?: Array<{
    chapterNumber?: string;
    number?: number | string;
    title?: string;
    alternativeTitles?: string[];
    url?: string;
    coverUrl?: string;
    coverImage?: string;
    volumeNumber?: number;
    volume?: number; // Alias for volumeNumber
    summary?: string;
    pages?: number;
    releaseDate?: string;
  }>;

  // === Rich metadata system ===
  metadata?: {
    japaneseTitle?: string;
    alternativeTitles?: string[];
    author?: string;
    artist?: string;
    publisher?: string;
    demographic?: string;
    genres?: string[];
    format?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    serialization?: {
      magazine?: string;
      startDate?: string;
      endDate?: string;
    };
    staff?: Array<{
      name: string;
      role: string;
    }>;
  };

  // === Characters system ===
  characters?: Array<{
    name: string;
    role?: string;
    url?: string;
    image?: string; // Enhanced with images
  }>;

  // === Story arcs system ===
  arcs?: Array<{
    name: string;
    chapters?: string[];
  }> | string[]; // Support both rich and simple formats

  // === Links system ===
  links?: {
    mainPage?: string;
    volumesPage?: string;
    charactersPage?: string;
  };

  // === Stats system ===
  stats?: {
    totalVolumes?: number;
    totalChapters?: number;
    lastUpdated?: Date | string;
  };

  // === Legacy date fields (compatibility) ===
  startDate?: string;
  publishDate?: string;
  endDate?: string;
  publicationDemographic?: string;

  // === Source tracking ===
  source?: 'dynamic' | 'static' | 'hybrid';
}

/**
 * Type guard for FandomMangaData
 * Validates that an unknown value is a valid FandomMangaData object
 */
export function isFandomMangaData(data: unknown): data is FandomMangaData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'title' in data &&
    typeof (data as FandomMangaData).title === 'string'
  );
}

// Search Results
export interface FandomSearchResult {
  id: string;
  title: string;
  url: string;
  wikiUrl?: string;  // Optional wiki URL for consistency with other providers
  type: 'manga' | 'character' | 'article';
  wiki: string;
  thumbnail?: string;
  abstract?: string;
  score?: number;
  metadata?: {
    author?: string;
    chapters?: string;
    volumes?: string;
    status?: string;
    published?: string;
  };
}

// API Configuration
export interface FandomAPIConfig {
  baseUrl: string;
  wiki: string;
  rateLimit?: {
    requestsPerSecond: number;
    burstLimit?: number;
  };
  cache?: {
    enabled: boolean;
    ttl: number; // Time to live in seconds
  };
  timeout?: number;
  retries?: number;
}

// API Response Types
export interface MediaWikiAPIResponse<T = unknown> {
  batchcomplete?: string;
  continue?: {
    [key: string]: string;
  };
  query?: T;
  error?: {
    code: string;
    info: string;
    '*'?: string;
  };
}

export interface FandomV1APIResponse<T = unknown> {
  items?: T;
  basepath?: string;
  offset?: number;
  total?: number;
  error?: {
    message: string;
    code?: number;
  };
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expires: number;
}

// Error Types
export class FandomAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public endpoint?: string
  ) {
    super(message);
    this["name"] = 'FandomAPIError';
  }
}

// Wiki Configuration
export interface WikiConfig {
  name: string;
  subdomain: string;
  language?: string;
  categories?: {
    characters?: string;
    chapters?: string;
    volumes?: string;
    arcs?: string;
  };
}
