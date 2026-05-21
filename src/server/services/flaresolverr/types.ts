/**
 * FlareSolverr Types
 *
 * Type definitions for FlareSolverr API responses and client configuration.
 *
 * @module flaresolverr/types
 */

/**
 * Cookie from FlareSolverr response
 */
export interface FlareSolverrCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expiry?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * FlareSolverr API response structure
 */
export interface FlareSolverrApiResponse {
  status: 'ok' | 'error';
  message: string;
  startTimestamp?: number;
  endTimestamp?: number;
  version?: string;
  solution?: FlareSolverrSolution;
  session?: string;
  sessions?: string[];
}

/**
 * Solution data from successful FlareSolverr request
 */
export interface FlareSolverrSolution {
  url: string;
  status: number;
  cookies: FlareSolverrCookie[];
  userAgent: string;
  headers: Record<string, string>;
  response: string; // HTML content
  /** Base64 PNG screenshot if returnScreenshot was true */
  screenshot?: string;
}

/**
 * FlareSolverr client configuration
 */
export interface FlareSolverrConfig {
  /** Base URL to FlareSolverr instance (e.g., http://localhost:8191/v1) */
  url: string;
  /** Whether FlareSolverr is enabled */
  enabled: boolean;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Session time-to-live in milliseconds */
  sessionTTL: number;
  /** Block images, CSS, and fonts for faster navigation (default: false) */
  disableMedia: boolean;
  /** Default post-challenge delay in seconds (default: 0) */
  defaultWaitSeconds: number;
}

/**
 * Options for FlareSolverr fetch requests
 */
export interface FlareSolverrFetchOptions {
  /** Session ID to use for request */
  session?: string;
  /** Maximum timeout in milliseconds */
  maxTimeout?: number;
  /** Cookies to include with request */
  cookies?: FlareSolverrCookie[];
  /** Only return cookies, not full response */
  returnOnlyCookies?: boolean;
  /** HTTP method (default: GET) */
  method?: 'GET' | 'POST';
  /** POST data for POST requests */
  postData?: string;
  /** Capture final page as Base64 PNG screenshot */
  returnScreenshot?: boolean;
  /** Block images, CSS, and fonts for faster navigation */
  disableMedia?: boolean;
  /** Post-challenge delay in seconds for dynamic content to load */
  waitInSeconds?: number;
}

/**
 * Cached session data
 */
export interface FlareSolverrSession {
  id: string;
  domain: string;
  cookies: FlareSolverrCookie[];
  userAgent: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * Result from protectedFetch
 */
export interface ProtectedFetchResult {
  /** Whether the fetch was successful */
  success: boolean;
  /** HTML content if successful */
  html: string | null;
  /** HTTP status code */
  status: number;
  /** Cookies from response */
  cookies: FlareSolverrCookie[];
  /** User agent used */
  userAgent: string;
  /** Whether FlareSolverr was used */
  usedFlareSolverr: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Options for protectedFetch
 */
export interface ProtectedFetchOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Session name for cookie persistence */
  sessionName?: string;
  /** Wait time in seconds for JS to render (useful for dynamic pages like Fandom) */
  waitInSeconds?: number;
}

/**
 * Cloudflare bypass cookies auto-stored from FlareSolverr responses
 * These are automatically cached when FlareSolverr successfully bypasses Cloudflare
 */
export interface CloudflareCookies {
  /** Main Cloudflare clearance cookie - validates browser passed challenge */
  cf_clearance?: string;
  /** Bot management cookie */
  __cf_bm?: string;
  /** User agent that was used when cookies were obtained (must match for bypass) */
  userAgent: string;
  /** Domain the cookies are valid for */
  domain: string;
  /** When these cookies were captured */
  capturedAt: number;
  /** Optional expiry timestamp */
  expiresAt?: number;
}

/**
 * Stored Cloudflare cookies for a domain
 */
export interface StoredCloudflareCookies extends CloudflareCookies {
  /** Unique identifier */
  id: string;
  /** Whether cookies are still valid (not expired) */
  isValid: boolean;
}

// ============================================================================
// FlareSolverr Metrics Types
// ============================================================================

/**
 * Request type for metrics categorization
 */
export type FlareSolverrMetricsRequestType =
  | 'HEALTH_CHECK'
  | 'FETCH_REQUEST'
  | 'SESSION_CREATE'
  | 'SESSION_DESTROY'
  | 'SESSION_LIST';

/**
 * Health check result for metrics recording
 */
export interface HealthCheckResult {
  healthy: boolean;
  responseTimeMs?: number;
  version?: string;
  sessionCount: number;
  errorMessage?: string;
}

/**
 * Recorded metrics entry
 */
export interface FlareSolverrMetricsEntry {
  id: string;
  timestamp: Date;
  healthy: boolean;
  responseTimeMs: number | null;
  version: string | null;
  sessionCount: number;
  requestType: FlareSolverrMetricsRequestType;
  success: boolean;
  errorMessage: string | null;
  hour: Date;
}

/**
 * Hourly aggregated metrics
 */
export interface FlareSolverrHourlyMetrics {
  id: string;
  hour: Date;
  totalRequests: number;
  successfulReqs: number;
  failedReqs: number;
  avgResponseTime: number | null;
  minResponseTime: number | null;
  maxResponseTime: number | null;
  p95ResponseTime: number | null;
  uptimePercent: number | null;
  avgSessionCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aggregated statistics for a time period
 */
export interface FlareSolverrAggregatedStats {
  period: '1h' | '24h' | '7d';
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  avgResponseTimeMs: number | null;
  minResponseTimeMs: number | null;
  maxResponseTimeMs: number | null;
  p95ResponseTimeMs: number | null;
  uptimePercent: number;
  avgSessionCount: number;
  currentSessionCount: number;
  currentlyHealthy: boolean;
  lastChecked: Date | null;
  trendsVsPrevious: {
    successRateChange: number;
    avgResponseTimeChange: number | null;
    uptimeChange: number;
  };
}

/**
 * WebSocket payload for real-time metrics updates
 */
export interface FlareSolverrMetricsPayload {
  timestamp: string;
  healthy: boolean;
  responseTimeMs?: number;
  sessionCount: number;
  requestType: FlareSolverrMetricsRequestType;
  success: boolean;
  errorMessage?: string;
}

/**
 * Metrics configuration from database
 */
export interface FlareSolverrMetricsConfig {
  metricsEnabled: boolean;
  metricsRetentionDays: number;
  hourlyRetentionDays: number;
}

/**
 * Chart data point for time-series visualization
 */
export interface MetricsChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

/**
 * Response time chart data
 */
export interface ResponseTimeChartData {
  timestamps: string[];
  avgResponseTimes: number[];
  minResponseTimes: number[];
  maxResponseTimes: number[];
}

/**
 * Uptime chart data
 */
export interface UptimeChartData {
  timestamps: string[];
  uptimePercents: number[];
  labels: string[];
}

/**
 * Throughput chart data
 */
export interface ThroughputChartData {
  timestamps: string[];
  successfulRequests: number[];
  failedRequests: number[];
}
