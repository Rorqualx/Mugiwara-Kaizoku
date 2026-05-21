/**
 * API Client - Refactored to extend BaseHttpClient
 * 
 * This class now extends BaseHttpClient to eliminate code duplication.
 * It provides backward compatibility and API-specific functionality.
 * 
 * Migration from the original ApiClient:
 * - Most functionality moved to BaseHttpClient
 * - Maintains same public interface for compatibility
 * - ~400 lines of duplicate code eliminated
 */

import { ApiError } from '@/utils/error-handling';

import { BaseHttpClient } from './BaseHttpClient';

import type { BaseHttpClientConfig, ConnectionStatus } from './BaseHttpClient';

/**
 * API client configuration (re-exports BaseHttpClientConfig)
 */
export type ApiClientConfig = BaseHttpClientConfig;

// Re-export ConnectionStatus
export type { ConnectionStatus };

/**
 * Resource type for API client operations
 * @template T - The resource type
 */
export interface Resource<T> {
  id: string | number;
  type: string;
  data: T;
}

/**
 * API response type with pagination
 * @template T - The resource type
 */
export interface ApiResponse<T> {
  data: T[];
  pagination?: {
    total: number;
    offset: number;
    limit: number;
    hasMore: boolean;
  };
  meta?: Record<string, unknown>;
}

/**
 * Abstract base class for API clients
 * Now extends BaseHttpClient to leverage consolidated functionality
 * 
 * @template TResource - The primary resource type that this client manages
 * @template TError - The specific error type for this client (defaults to ApiError)
 */
export abstract class ApiClient<TResource = unknown, TError extends Error = ApiError> extends BaseHttpClient<TResource, TError> {

  /**
   * Override isErrorType to handle ApiError specifically
   */
  protected isErrorType(error: unknown): error is TError {
    return error instanceof ApiError || super.isErrorType(error);
  }

  // All HTTP methods are now inherited from BaseHttpClient:
  // - requestAsync, request
  // - getAsync, postAsync, putAsync, deleteAsync, patchAsync
  // - get, post, put, delete, patch
  // - testConnectionAsync, testConnection
  // - dispose, disposeAsync
  // - getCacheKey, updateConnectionStatus

  // The following methods MUST be implemented by derived classes:
  // - protected abstract getServiceName(): string;
  // - protected abstract ping(): Promise<void>;
}