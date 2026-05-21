import type {
  Manga,
  Chapter,
  Library,
  Metadata,
  jobs,
} from '@prisma/client';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MangaResponse extends ApiResponse<Manga> {}
export interface ChapterResponse extends ApiResponse<Chapter> {}
export interface LibraryResponse extends ApiResponse<Library> {}
export interface MetadataResponse extends ApiResponse<Metadata> {}
export interface JobResponse extends ApiResponse<jobs> {}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiKeyListResponse extends ApiResponse<Array<{
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
}>> {}

export interface ApiKeyDetailResponse extends ApiResponse<{
  id: string;
  name: string;
  key?: string;
  createdAt: Date;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
}> {}

export interface VolumeResponse extends ApiResponse<unknown> {}
export interface UserResponse extends ApiResponse<unknown> {}
export interface BulkOperationResponse extends ApiResponse<unknown> {}
export interface ErrorResponse extends ApiResponse<unknown> {}
