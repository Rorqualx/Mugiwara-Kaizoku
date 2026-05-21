/**
 * Deluge Client Types
 *
 * Type definitions, interfaces, and enums for the Deluge BitTorrent client.
 * Extracted from: delugeClient.ts
 */

import type { AsyncResult } from '@/utils/async-result';

import { DelugeRateLimiter } from './rate-limiter';

// Re-export DelugeRateLimiter from its dedicated module
export { DelugeRateLimiter };

/**
 * Deluge-specific error codes
 */
export enum DelugeErrorCode {
    AUTHENTICATION_FAILED = 1,
    SESSION_INVALID = 2,
    CONNECTION_ERROR = 3,
    METHOD_NOT_FOUND = 4,
    INVALID_PARAMS = 5
}

/**
 * Deluge JSON-RPC request
 */
export interface DelugeRequest {
    id: number;
    method: string;
    params: unknown[];
}

/**
 * Deluge JSON-RPC response
 */
export interface DelugeResponse<T = unknown> {
    id: number;
    result: T;
    error?: {
        code: number;
        message: string;
    };
}

/**
 * Deluge torrent status
 */
export interface DelugeTorrentStatus {
    state: string;
    name: string;
    total_size: number;
    progress: number;
    download_payload_rate: number;
    upload_payload_rate: number;
    eta: number;
    ratio: number;
    time_added: number;
    completed_time: number;
    save_path: string;
    total_done: number;
    total_uploaded: number;
    label?: string;
    message?: string;
    files?: DelugeFile[];
    [key: string]: unknown;
}

/**
 * Deluge file info
 */
export interface DelugeFile {
    index: number;
    path: string;
    size: number;
    offset: number;
    progress: number;
    [key: string]: unknown;
}

/**
 * Deluge daemon info
 */
export interface DelugeDaemonInfo {
    id?: string;
    connected: boolean;
    name: string;
    info: string;
    version: string;
    status: string;
    [key: string]: unknown;
}

/**
 * Request Cache interface
 */
export interface RequestCache {
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, ttl?: number): void;
    clear(): void;
    invalidateRelated(type: string): void;
}

/**
 * Authentication state for Deluge client
 */
export interface DelugeAuthState {
    authenticated: boolean;
    connected: boolean;
    sessionCookie: string | null;
    hostId: string | null;
}

/**
 * RPC request context for making requests
 */
export interface RpcRequestContext {
    password: string;
    proxyMode: boolean;
    proxyPath: string;
    requestId: number;
    delugeRateLimiter: DelugeRateLimiter;
    buildUrl: (path: string) => string;
    createContextualError: (message: string) => Error;
}

/**
 * RPC request function type
 */
export type RpcRequestFn = <T>(
    method: string,
    params: unknown[],
    skipAuth: boolean
) => Promise<AsyncResult<T, Error>>;

/**
 * Proxy payload structure
 */
export interface ProxyPayload {
    method: string;
    params: unknown[];
    password: string;
    baseURL: string;
    sessionCookie?: string;
    forceCleanLogin?: boolean;
    isAuthRequest?: boolean;
}
