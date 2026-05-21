/**
 * API V1 Request Types
 *
 * Type definitions for all API V1 request objects.
 * These types are used for type safety in API request validation.
 *
 * @module ApiV1RequestTypes
 * @category API
 * @subcategory V1
 */

/**
 * Pagination request parameters
 */
export interface PaginationRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Filter request parameters
 */
export interface FilterRequest {
  status?: string[];
  source?: string[];
  tags?: string[];
  genres?: string[];
  authors?: string[];
  search?: string;
}

/**
 * Create manga request
 */
export interface CreateMangaRequest {
  title: string;
  source: string;
  sourceId?: string;
  coverUrl?: string;
  description?: string;
  status?: string;
  authors?: string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  alternativeTitles?: string[];
  year?: number;
  publisher?: string;
  rating?: number;
  chapters?: number;
  volumes?: number;
}

/**
 * Update manga request
 */
export interface UpdateMangaRequest {
  title?: string;
  source?: string;
  sourceId?: string;
  coverUrl?: string;
  description?: string;
  status?: string;
  authors?: string[];
  artists?: string[];
  genres?: string[];
  tags?: string[];
  alternativeTitles?: string[];
  year?: number;
  publisher?: string;
  rating?: number;
  chapters?: number;
  volumes?: number;
}

/**
 * Create chapter request
 */
export interface CreateChapterRequest {
  mangaId: number;
  number: number;
  title?: string;
  volume?: number;
  releaseDate?: string;
  pages?: number;
  url?: string;
}

/**
 * Update chapter request
 */
export interface UpdateChapterRequest {
  mangaId?: number;
  number?: number;
  title?: string;
  volume?: number;
  releaseDate?: string;
  pages?: number;
  url?: string;
}

/**
 * Download request
 */
export interface DownloadRequest {
  chapterId: number;
  quality?: string;
  format?: string;
}

/**
 * Search request
 */
export interface SearchRequest {
  query: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  filters?: FilterRequest;
  sourceIds?: string[];
  includeCover?: boolean;
}

/**
 * Create task request
 */
export interface CreateTaskRequest {
  type: string;
  params?: Record<string, unknown>;
  priority?: number;
  schedule?: Record<string, unknown>;
}

/**
 * Create user request
 */
export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role?: string;
  permissions?: string[];
}

/**
 * Update user request
 */
export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  permissions?: string[];
}

/**
 * Login request
 */
export interface LoginRequest {
  username: string;
  password: string;
  remember?: boolean;
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Update config request
 */
export interface UpdateConfigRequest {
  config: Record<string, unknown>;
}

/**
 * Library scan request
 */
export interface LibraryScanRequest {
  libraryId?: number;
  force?: boolean;
}

/**
 * Metadata refresh request
 */
export interface MetadataRefreshRequest {
  mangaId?: number;
  force?: boolean;
}

/**
 * Export request
 */
export interface ExportRequest {
  format?: string;
  include?: string[];
  exclude?: string[];
}

/**
 * Import request
 */
export interface ImportRequest {
  data: string;
  format?: string;
  overwrite?: boolean;
}

/**
 * Create volume request
 */
export interface CreateVolumeRequest {
  mangaId: number;
  volumeNumber: number;
  title?: string;
  coverImage?: string;
  releaseDate?: string;
  publisher?: string;
  isbn?: string;
  pageCount?: number;
}

/**
 * Update volume request
 */
export interface UpdateVolumeRequest {
  mangaId?: number;
  volumeNumber?: number;
  title?: string;
  coverImage?: string;
  releaseDate?: string;
  publisher?: string;
  isbn?: string;
  pageCount?: number;
}

/**
 * Delete volume request
 */
export interface DeleteVolumeRequest {
  volumeId: number;
}

/**
 * Delete user request
 */
export interface DeleteUserRequest {
  userId: number;
}

/**
 * Bulk operation request
 */
export interface BulkOperationRequest {
  ids: number[];
  operation: string;
  params?: Record<string, unknown>;
}
