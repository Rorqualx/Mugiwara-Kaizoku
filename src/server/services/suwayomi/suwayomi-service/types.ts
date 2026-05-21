/**
 * Suwayomi Service Types Module
 *
 * Shared type definitions, interfaces, and constants
 * used across all suwayomi-service modules.
 *
 * @module suwayomi-service/types
 */

// =============================================================================
// GitHub API Response Types
// =============================================================================

/**
 * Represents a single asset in a GitHub release
 */
export interface GitHubAsset {
    /** Name of the asset file */
    name: string;
    /** Direct download URL for the asset */
    browser_download_url: string;
}

/**
 * GitHub release API response structure
 */
export interface GitHubReleaseResponse {
    /** Release tag name (e.g., 'v1.0.0') */
    tag_name: string;
    /** List of downloadable assets in the release */
    assets: GitHubAsset[];
}

// =============================================================================
// Node.js Error Extension
// =============================================================================

/**
 * Extended Node.js Error interface with additional system error properties
 */
export interface NodeError extends Error {
    /** Error code (e.g., 'ENOENT', 'EACCES') */
    code?: string;
    /** System call that caused the error */
    syscall?: string;
    /** File path related to the error */
    path?: string;
}

// =============================================================================
// Service Configuration Types
// =============================================================================

/**
 * Configuration options for the Suwayomi service
 */
export interface SuwayomiServiceConfig {
    /** Path to the Suwayomi server installation directory */
    serverPath: string;
    /** Path to store Suwayomi configuration files */
    configPath: string;
    /** Port number for the Suwayomi server */
    port: number;
}

/**
 * Configuration update options (all fields optional)
 */
export interface SuwayomiServiceConfigUpdate {
    /** Path to the Suwayomi server installation directory */
    serverPath?: string;
    /** Path to store Suwayomi configuration files */
    configPath?: string;
    /** Port number for the Suwayomi server */
    port?: number;
}

// =============================================================================
// Java Status Types
// =============================================================================

/**
 * Detailed Java installation status information
 */
export interface JavaStatus {
    /** Whether Java is available and meets requirements */
    available: boolean;
    /** Installed Java version string (e.g., '21.0.1') or null if not available */
    version: string | null;
    /** Whether Java is required for the service */
    required: boolean;
    /** Minimum required Java version (e.g., '21') */
    minimumVersion: string;
    /** Instructions for installing Java if not available */
    installInstructions: string;
}

/**
 * Result of Java availability check
 */
export interface JavaCheckResult {
    /** Whether Java is available */
    available: boolean;
    /** Java version string or null */
    version: string | null;
}

// =============================================================================
// Service State Types
// =============================================================================

/**
 * Current state of the Suwayomi service
 */
export interface SuwayomiServiceState {
    /** Whether the server process is currently running */
    isRunning: boolean;
    /** Base URL for accessing the server API */
    serverUrl: string;
    /** Port number the server is listening on */
    port: number;
    /** Cached Java availability status (null if not checked) */
    javaAvailable: boolean | null;
    /** Cached Java version string (null if not available or not checked) */
    javaVersion: string | null;
    /** Timestamp of last Java availability check */
    lastJavaCheckTime: number;
}

// =============================================================================
// Advanced Configuration Types
// =============================================================================

/**
 * Advanced configuration options for Suwayomi server
 */
export interface SuwayomiAdvancedConfig {
    /** Minimum Java heap memory in MB */
    javaMemoryMin?: number;
    /** Maximum Java heap memory in MB */
    javaMemoryMax?: number;
    /** Number of download threads */
    downloadThreads?: number;
    /** Whether proxy is enabled */
    proxyEnabled?: boolean;
    /** Proxy host address */
    proxyHost?: string;
    /** Proxy port number */
    proxyPort?: number;
    /** Additional configuration options */
    [key: string]: unknown;
}

// =============================================================================
// Server Status Types
// =============================================================================

/**
 * Comprehensive server status information
 */
export interface SuwayomiServerStatus {
    /** Whether the server is running and healthy */
    running: boolean;
    /** Server base URL */
    url: string;
    /** Server port number */
    port: number;
    /** Java installation status */
    java: {
        available: boolean;
        version: string | null;
    };
    /** Server process ID (null if not running) */
    pid: number | null;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Whether the application is running in a Docker environment
 * Determined by the DOCKER environment variable
 */
export const isDocker: boolean = process.env['DOCKER'] === 'true';

/**
 * Interval between Java availability checks (in milliseconds)
 * Default: 5 minutes
 */
export const JAVA_CHECK_INTERVAL: number = 5 * 60 * 1000;

/**
 * Default port for Suwayomi server
 */
export const DEFAULT_SUWAYOMI_PORT: number = 4567;

/**
 * Minimum required Java version for Suwayomi
 */
export const MINIMUM_JAVA_VERSION: string = '21';

/**
 * Default Java memory settings
 */
export const DEFAULT_JAVA_MEMORY = {
    min: 512,
    max: 2048,
} as const;

/**
 * Server health check configuration
 */
export const HEALTH_CHECK_CONFIG = {
    /** Maximum number of retry attempts */
    maxRetries: 30,
    /** Delay between retries in milliseconds */
    retryDelay: 1000,
    /** Timeout for graceful shutdown in milliseconds */
    shutdownTimeout: 5000,
} as const;

/**
 * Homebrew Java 21 installation paths (macOS)
 */
export const HOMEBREW_JAVA_PATHS: readonly string[] = [
    '/usr/local/opt/openjdk@21/bin/java',
    '/opt/homebrew/opt/openjdk@21/bin/java',
] as const;

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if an error is a NodeError
 */
export function isNodeError(error: unknown): error is NodeError {
    return error instanceof Error && 'code' in error;
}

/**
 * Type guard to check if a value is a valid SuwayomiAdvancedConfig
 */
export function isSuwayomiAdvancedConfig(value: unknown): value is SuwayomiAdvancedConfig {
    if (!value || typeof value !== 'object') {
        return false;
    }
    return true;
}
