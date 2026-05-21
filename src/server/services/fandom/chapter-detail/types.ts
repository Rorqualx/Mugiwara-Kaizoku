/**
 * Chapter Detail Service - Type Definitions
 *
 * Core types for chapter detail fetching from Fandom wikis.
 * Foundation module for all chapter-detail service modules.
 *
 * @module chapter-detail/types
 */

/**
 * Chapter detail information structure
 *
 * Represents metadata and content information for a single chapter
 * fetched from a Fandom wiki page.
 */
export interface ChapterDetail {
  /** Full URL to the chapter's wiki page */
  url: string;
  /** Chapter number (e.g., "1", "5.5", "100") */
  chapterNumber?: string;
  /** Chapter title/name */
  title?: string;
  /** URL to the chapter's cover image */
  coverImageUrl?: string;
  /** Short description of the chapter */
  description?: string;
  /** Detailed synopsis/summary of the chapter */
  synopsis?: string;
  /** Release date of the chapter (ISO 8601 format preferred) */
  releaseDate?: string;
  /** Number of pages in the chapter */
  pageCount?: number;
  /** Whether this result came from cache */
  fromCache?: boolean;
}

/**
 * Options for batch fetching operations
 *
 * Configuration for controlling batch processing behavior,
 * rate limiting, and progress tracking.
 */
export interface BatchFetchOptions {
  /** Number of requests to process in each batch (default: 75) */
  batchSize?: number;
  /** Delay in milliseconds between batches (default: 50) */
  delayMs?: number;
  /** Maximum number of retry attempts per request (default: 3) */
  maxRetries?: number;
  /** Callback function to report progress */
  onProgress?: (completed: number, total: number) => void;
}

/**
 * Performance telemetry data structure
 *
 * Tracks detailed performance metrics for monitoring and optimization.
 * Used for analyzing request patterns, response times, and cache effectiveness.
 */
export interface PerformanceTelemetry {
  /** Timestamp when operation started (milliseconds since epoch) */
  startTime: number;
  /** Timestamp when operation completed (milliseconds since epoch) */
  endTime?: number;
  /** Total number of requests made */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Number of requests served from cache */
  cacheHits: number;
  /** Average response time in milliseconds */
  avgResponseTime?: number;
  /** 95th percentile response time in milliseconds */
  p95ResponseTime?: number;
  /** 99th percentile response time in milliseconds */
  p99ResponseTime?: number;
  /** Requests per second */
  throughput?: number;
  /** Batch sizes used during operation */
  batchSizes: number[];
  /** Delays used between batches (milliseconds) */
  delays: number[];
  /** Number of times circuit breaker was triggered */
  circuitBreakerTrips: number;
}

/**
 * Circuit breaker states
 *
 * Implements circuit breaker pattern to prevent cascading failures
 * when external service is degraded or unavailable.
 */
export enum CircuitState {
  /** Normal operation - requests are allowed */
  CLOSED = 'CLOSED',
  /** Service is failing - requests are rejected immediately */
  OPEN = 'OPEN',
  /** Testing recovery - limited requests allowed to probe service health */
  HALF_OPEN = 'HALF_OPEN'
}
