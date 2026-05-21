/**
 * Type definitions for API client tests
 * 
 * This file contains shared type definitions used across the test suite
 * to ensure consistent and type-safe testing.
 */

/**
 * Base test configuration interface
 */
export interface BaseTestConfig {
  baseURL: string;
  mockResponseDelay?: number;
}

/**
 * Common HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Common HTTP headers
 */
export interface HttpHeaders {
  [key: string]: string;
}

/**
 * Common HTTP status codes
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

/**
 * Generic HTTP request interface
 */
export interface HttpRequest<T> {
  method: HttpMethod;
  url: string;
  headers?: HttpHeaders;
  body?: T;
}

/**
 * Generic HTTP response interface
 */
export interface HttpResponse<T> {
  status: HttpStatus;
  headers: HttpHeaders;
  data: T;
}

/**
 * Error response interface
 */
export interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Download client test configuration
 */
export interface DownloadClientTestConfig extends BaseTestConfig {
  username?: string;
  password?: string;
  apiKey?: string;
  category?: string;
}

/**
 * Transmission test configuration
 */
export interface TransmissionTestConfig extends DownloadClientTestConfig {
  sessionId?: string;
  csrfToken?: string;
}

/**
 * Deluge test configuration
 */
export interface DelugeTestConfig extends DownloadClientTestConfig {
  password: string;
  hostId?: string;
}

/**
 * SABnzbd test configuration
 */
export interface SABnzbdTestConfig extends DownloadClientTestConfig {
  apiKey: string;
}

/**
 * NZBGet test configuration
 */
export interface NZBGetTestConfig extends DownloadClientTestConfig {
  username: string;
  password: string;
}

/**
 * Metadata provider test configuration
 */
export interface MetadataProviderTestConfig extends BaseTestConfig {
  username?: string;
  password?: string;
  apiKey?: string;
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}

/**
 * AniList test configuration
 */
export interface AniListTestConfig extends MetadataProviderTestConfig {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  defaultLanguage?: 'english' | 'romaji' | 'native';
}

/**
 * ComicVine test configuration
 */
export interface ComicVineTestConfig extends MetadataProviderTestConfig {
  apiKey: string;
}

/**
 * Fandom test configuration
 */
export interface FandomTestConfig extends MetadataProviderTestConfig {
  defaultWikis?: string[];
}

/**
 * MangaDex test configuration
 */
export interface MangaDexTestConfig extends MetadataProviderTestConfig {
  username?: string;
  password?: string;
  preferredLanguage?: string;
  includeAdult?: boolean;
  coverQuality?: 'small' | 'medium' | 'large';
}