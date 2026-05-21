/**
 * Common API Types
 * Shared types for API requests and responses
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  metadata?: ApiMetadata;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  statusCode?: number;
  timestamp?: string;
}

/**
 * API metadata
 */
export interface ApiMetadata {
  timestamp: string;
  requestId?: string;
  version?: string;
  pagination?: PaginationMetadata;
}

/**
 * Pagination metadata
 */
export interface PaginationMetadata {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * API Configuration
 */
export interface ApiConfig {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  headers?: Record<string, string>;
  rateLimit?: {
    requests?: {
      perMinute?: number;
      perHour?: number;
    };
  };
  cache?: {
    ttl?: number;
    maxSize?: number;
  };
}

/**
 * API Request interface
 */
export interface ApiRequest {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: ApiAuth;
}

/**
 * API Authentication
 */
export interface ApiAuth {
  type?: 'bearer' | 'apikey' | 'basic';
  credentials?: string | { username: string; password: string };
  userId?: string;
  apiKey?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  permissions?: Array<{
    resource: string;
    actions: string[];
  }>;
}

/**
 * Rate Limit Status
 */
export interface RateLimitStatus {
  exceeded: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  resetAt: Date;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Filter parameters
 */
export interface FilterParams {
  [key: string]: unknown;
}

/**
 * Sort parameters
 */
export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

/**
 * Request options
 */
export interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * API endpoint configuration
 */
export interface EndpointConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  body?: unknown;
}

// Re-export for backward compatibility
export type ApiResult<T> = ApiResponse<T>;
