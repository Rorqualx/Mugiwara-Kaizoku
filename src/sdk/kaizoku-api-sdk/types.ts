/**
 * Kaizoku API SDK Types
 *
 * Type definitions for the Kaizoku API SDK including config,
 * resource types, and request/response interfaces.
 *
 * Extracted from: kaizoku-api-sdk.ts (lines 12-222)
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface KaizokuApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  interceptors?: {
    request?: (config: RequestInit) => RequestInit | Promise<RequestInit>;
    response?: (response: Response) => Response | Promise<Response>;
    error?: (error: Error) => Error | Promise<Error>;
  };
  logger?: {
    debug?: (message: string, data?: unknown) => void;
    info?: (message: string, data?: unknown) => void;
    warn?: (message: string, data?: unknown) => void;
    error?: (message: string, error?: unknown) => void;
  };
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    requestId: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta?: PaginationMeta;
  links?: {
    self: string;
    next?: string;
    prev?: string;
  };
}

// ============================================================================
// Resource Types
// ============================================================================

export interface MangaResource {
  id: number;
  title: string;
  sourceId: string;
  source: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'error' | 'DELETED';
  coverUrl?: string;
  libraryId: number;
  metadata?: {
    description?: string;
    authors?: string[];
    genres?: string[];
    tags?: string[];
  };
  createdAt: string;
  updatedAt: string;
  _links: {
    self: string;
    chapters: string;
    library: string;
    download: string;
  };
}

export interface LibraryResource {
  id: number;
  name: string;
  path: string;
  mangaCount: number;
  lastScanAt?: string;
  createdAt: string;
  updatedAt: string;
  _links: {
    self: string;
    manga: string;
    scan: string;
  };
}

export interface ChapterResource {
  id: number;
  title: string;
  number: number;
  mangaId: number;
  status: 'PENDING' | 'DOWNLOADING' | 'COMPLETED' | 'error' | 'DELETED';
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
  _links: {
    self: string;
    manga: string;
    download: string;
  };
}

export interface DownloadResource {
  id: string;
  mangaId: number;
  chapterId?: number;
  status: 'PENDING' | 'DOWNLOADING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED';
  progress: number;
  priority: number;
  error?: string;
  size?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  _links: {
    self: string;
    manga: string;
    chapter?: string;
    cancel: string;
    retry: string;
  };
}

export interface WebhookResource {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  failureCount: number;
  lastDeliveryAt?: string;
  createdAt: string;
  updatedAt: string;
  _links: {
    self: string;
    test: string;
    deliveries: string;
  };
}

export interface MetadataProvider {
  id: string;
  name: string;
  enabled: boolean;
  status: 'online' | 'offline' | 'error';
  features: string[];
}

// ============================================================================
// Request Types
// ============================================================================

export interface CreateMangaRequest {
  title: string;
  sourceId: string;
  source: string;
  libraryId: number;
  metadata?: {
    description?: string;
    authors?: string[];
    genres?: string[];
    tags?: string[];
    coverUrl?: string;
  };
}

export interface UpdateMangaRequest {
  title?: string;
  status?: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'error' | 'DELETED';
  metadata?: {
    description?: string;
    authors?: string[];
    genres?: string[];
    tags?: string[];
    coverUrl?: string;
  };
}

export interface CreateLibraryRequest {
  name: string;
  path: string;
  scanInterval?: number;
}

export interface UpdateLibraryRequest {
  name?: string;
  path?: string;
  scanInterval?: number;
}

export interface CreateWebhookRequest {
  url: string;
  events: string[];
  secret?: string;
}

export interface UpdateWebhookRequest {
  url?: string;
  events?: string[];
  enabled?: boolean;
}

export interface SearchMetadataParams {
  query: string;
  providers?: string[];
  limit?: number;
}

export interface RefreshMetadataRequest {
  providers?: string[];
  force?: boolean;
}
