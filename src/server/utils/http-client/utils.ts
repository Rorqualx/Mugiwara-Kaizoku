/**
 * HTTP Client Utilities Module
 *
 * Utility functions for working with HTTP client responses
 * and AsyncResult patterns.
 *
 * Extracted from: httpClient.ts
 */

import type { AsyncResult } from '@/utils/async-result';
import {
  isSuccess,
  isError,
  isLoading,
  isIdle
} from '@/utils/async-result';

import type {
  HttpClientResponse,
  RequestOptions,
  ErrorContext
} from './types';

/**
 * Utility functions for HTTP client responses
 */
export const HttpClientUtils = {
  /**
   * Extracts the data from a response based on its type
   */
  extractData<T>(response: HttpClientResponse<T>): T {
    // Check for client-specific data if available
    if (response.clientSpecific) {
      if ('result' in response.clientSpecific && response.clientSpecific['result'] !== undefined) {
        return response.clientSpecific['result'] as unknown as T;
      }
      if ('arguments' in response.clientSpecific && response.clientSpecific['arguments'] !== undefined) {
        return response.clientSpecific['arguments'] as unknown as T;
      }
    }

    // Handle OAuth responses - FIX: Check for undefined instead of null
    if (
      response.access_token !== undefined &&
      typeof response.data === 'object' &&
      response.data !== null
    ) {
      return response.data;
    }

    return response.data;
  },

  /**
   * Extracts data from AsyncResult<HttpClientResponse<T>> with proper type safety
   */
  extractAsyncResultData<T>(
    result: AsyncResult<HttpClientResponse<T>, Error>,
    defaultValue: T
  ): T {
    if (!isSuccess(result)) {
      return defaultValue;
    }
    return this.extractData(result.data);
  },

  /**
   * Extracts data safely from AsyncResult or throws
   */
  extractAsyncResultDataOrThrow<T>(
    result: AsyncResult<HttpClientResponse<T>, Error>
  ): T {
    if (!isSuccess(result)) {
      if (isError(result)) {
        throw result.error;
      }
      if (isLoading(result)) {
        throw new Error('Cannot extract data from a loading AsyncResult');
      }
      if (isIdle(result)) {
        throw new Error('Cannot extract data from an idle AsyncResult');
      }
      throw new Error('Failed to extract data from AsyncResult');
    }
    return this.extractData(result.data);
  },

  /**
   * Creates an error context from request options
   */
  createErrorContext(options: RequestOptions): ErrorContext {
    return {
      url: options.path,
      method: options.method,
      requestData: options.data,
      timestamp: Date.now()
    };
  }
};
