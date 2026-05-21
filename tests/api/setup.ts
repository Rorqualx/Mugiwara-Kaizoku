/**
 * API Client Testing Framework Setup
 *
 * This file sets up the testing environment for API client tests, including:
 * - Jest configuration
 * - Mock server setup
 * - Type-safe test utilities
 * - Common test fixtures
 *
 * Updated for MSW v2 API
 */

import { setupServer } from 'msw/node';
import { http, graphql, HttpResponse } from 'msw';
import type { SetupServerApi } from 'msw/node';
import type { RequestHandler } from 'msw';

/**
 * Types for API responses to ensure type safety in tests
 */
export interface ApiResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Types for API error responses
 */
export interface ApiErrorResponse {
  status: number;
  error: string;
  message: string;
  code?: string;
}

/**
 * JSON body type for MSW responses
 */
type JsonBodyType = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

/**
 * Type-safe handler creator for REST endpoints (MSW v2 API)
 */
export function createRestHandler<T extends JsonBodyType>(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  url: string,
  responseData: T,
  status: number = 200,
  headers: Record<string, string> = {}
): RequestHandler {
  return http[method](url, () => {
    return HttpResponse.json(responseData, {
      status,
      headers
    });
  });
}

/**
 * Type-safe handler creator for GraphQL query (MSW v2 API)
 */
export function createGraphQLQueryHandler<T extends Record<string, unknown>>(
  queryName: string,
  responseData: T,
  _status: number = 200,
  _headers: Record<string, string> = {}
): RequestHandler {
  return graphql.query(queryName, () => {
    return HttpResponse.json({ data: responseData } as { data: T });
  });
}

/**
 * Type-safe handler creator for GraphQL mutation (MSW v2 API)
 */
export function createGraphQLMutationHandler<T extends Record<string, unknown>>(
  mutationName: string,
  responseData: T,
  _status: number = 200,
  _headers: Record<string, string> = {}
): RequestHandler {
  return graphql.mutation(mutationName, () => {
    return HttpResponse.json({ data: responseData } as { data: T });
  });
}

/**
 * Helper function to create a typed error handler (MSW v2 API)
 */
export function createErrorHandler(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  url: string,
  errorMessage: string,
  status: number = 400,
  errorCode: string = 'BAD_REQUEST'
): RequestHandler {
  const errorResponse: ApiErrorResponse = {
    status,
    error: errorCode,
    message: errorMessage
  };

  return http[method](url, () => {
    return HttpResponse.json(errorResponse, { status });
  });
}

/**
 * The mock server instance
 */
export const server: SetupServerApi = setupServer();

/**
 * Setup function to be called before tests
 */
export function setupApiTestServer(): void {
  // Start the server before all tests
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

  // Reset handlers between tests
  afterEach(() => server.resetHandlers());

  // Close the server after all tests
  afterAll(() => server.close());
}

/**
 * Mock implementation of the fetch API for testing
 */
export function createMockFetch<T>(responseData: T, status: number = 200): jest.Mock {
  return jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(responseData),
      text: () => Promise.resolve(JSON.stringify(responseData)),
      headers: new Map(),
    })
  );
}

/**
 * Type-safe test data creator to ensure consistent test data
 */
export function createTestData<T>(data: T): T {
  return data;
}
