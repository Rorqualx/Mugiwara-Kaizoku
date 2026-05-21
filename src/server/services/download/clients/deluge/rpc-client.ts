/**
 * RPC client module for Deluge
 *
 * Handles direct and proxied RPC requests to Deluge API
 * Extracted from: delugeClient.ts (lines 621-836)
 */

import { withEnhancedErrorHandling } from '@/server/services/download/utils/errorHandling';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, isError } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';


import { DelugeErrorCode, DelugeRateLimiter } from './types';

import type {
    DelugeAuthState,
    DelugeRequest,
    DelugeResponse,
    ProxyPayload
} from './types';

// Re-export for consumers
export { DelugeErrorCode };

/**
 * RPC client configuration
 */
export interface RpcClientConfig {
    password: string;
    proxyMode: boolean;
    proxyPath: string;
    delugeRateLimiter: DelugeRateLimiter;
    buildUrl: (path: string) => string;
    createContextualError: (message: string) => Error;
    config: { baseURL: string };
}

/**
 * Error handling context for RPC operations
 */
interface ErrorHandlingContext {
    method: string;
    skipAuth: boolean;
    authState: DelugeAuthState;
    config: RpcClientConfig;
    ensureAuthenticated: () => Promise<AsyncResult<void, Error>>;
    retryRequest: () => Promise<AsyncResult<unknown, Error>>;
}

/**
 * Checks if an error is an authentication error
 */
function isAuthenticationError(errorMessage: string): boolean {
    return errorMessage.includes('Invalid session') ||
        errorMessage.includes('Not authenticated') ||
        errorMessage.includes('Not logged in');
}

/**
 * Determines if the method should skip authentication
 */
function shouldSkipAuth(method: string, skipAuth: boolean): boolean {
    return skipAuth || method === 'auth.login' || method.startsWith('web.');
}

/**
 * Resets authentication state on error
 */
function resetAuthStateOnError(authState: DelugeAuthState): void {
    /* eslint-disable no-param-reassign */
    authState.authenticated = false;
    authState.connected = false;
    authState.sessionCookie = null;
    /* eslint-enable no-param-reassign */
}

/**
 * Updates auth state for specific error codes
 */
function updateAuthStateForError(
    errorCode: number,
    operation: 'directRequest' | 'proxyRequest',
    authState: DelugeAuthState
): void {
    /* eslint-disable no-param-reassign */
    if (errorCode === DelugeErrorCode.AUTHENTICATION_FAILED) {
        authState.authenticated = false;
        if (operation === 'proxyRequest') {
            authState.sessionCookie = null;
        }
    } else if (errorCode === DelugeErrorCode.SESSION_INVALID) {
        authState.authenticated = false;
        authState.connected = false;
        if (operation === 'proxyRequest') {
            authState.sessionCookie = null;
        }
    }
    /* eslint-enable no-param-reassign */
}

/**
 * Handles Deluge error response and throws appropriate errors
 */
function handleDelugeError(
    errorData: { code?: number; message?: string },
    method: string,
    operation: 'directRequest' | 'proxyRequest',
    authState: DelugeAuthState,
    createContextualError: (message: string) => Error
): never {
    const errorCode = typeof errorData.code === 'number' ? errorData.code : -1;
    const errorMessage = typeof errorData.message === 'string' ? errorData.message : 'Unknown error';

    const operationLabel = operation === 'proxyRequest' ? 'proxy ' : '';

    // Update auth state before throwing
    updateAuthStateForError(errorCode, operation, authState);

    switch (errorCode) {
        case DelugeErrorCode.AUTHENTICATION_FAILED:
            throw new ValidationError(
                `Deluge ${operationLabel}authentication failed: ${errorMessage} [operation: ${operation}, method: ${method}]`
            );

        case DelugeErrorCode.SESSION_INVALID:
            throw createContextualError(
                `Invalid session detected during Deluge ${operationLabel}request: ${method}`
            );

        default:
            throw createContextualError(
                `Deluge ${operationLabel}API error for ${method}: ${errorMessage} (code: ${errorCode})`
            );
    }
}

/**
 * Creates an RPC request maker function
 *
 * @param config - RPC client configuration
 * @param authState - Authentication state (will be mutated)
 * @param ensureAuthenticated - Function to ensure authentication
 * @param getRequestId - Function to get next request ID
 * @returns Function to make RPC requests
 */
export function createRpcRequest(
    config: RpcClientConfig,
    authState: DelugeAuthState,
    ensureAuthenticated: () => Promise<AsyncResult<void, Error>>,
    getRequestId: () => number
): <T>(method: string, params?: unknown[], skipAuth?: boolean) => Promise<AsyncResult<T, Error>> {

    return async function rpcRequest<T>(
        method: string,
        params: unknown[] = [],
        skipAuth: boolean = false
    ): Promise<AsyncResult<T, Error>> {
        try {
            // Check if authentication is needed
            if (!shouldSkipAuth(method, skipAuth)) {
                const authResult = await ensureAuthenticated();
                if (isError(authResult)) {
                    return authResult;
                }
            }

            // Execute the appropriate request type
            if (config.proxyMode) {
                return await proxyRequest<T>(method, params, config, authState, getRequestId());
            } else {
                return await directRequest<T>(method, params, config, authState, getRequestId());
            }
        } catch (error: unknown) {
            const context: ErrorHandlingContext = {
                method,
                skipAuth,
                authState,
                config,
                ensureAuthenticated,
                retryRequest: async () => rpcRequest<T>(method, params, skipAuth)
            };
            return handleRpcError<T>(error, context);
        }
    };
}

/**
 * Handles RPC errors including authentication retry
 */
async function handleRpcError<T>(
    error: unknown,
    context: ErrorHandlingContext
): Promise<AsyncResult<T, Error>> {
    const { method, skipAuth, authState, config, ensureAuthenticated, retryRequest } = context;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Handle authentication errors with retry
    if (isAuthenticationError(errorMessage)) {
        resetAuthStateOnError(authState);

        // If not authenticating, retry with re-authentication
        if (!shouldSkipAuth(method, skipAuth)) {
            logger.info('Deluge: Session invalid, re-authenticating...');
            const authResult = await ensureAuthenticated();
            if (isError(authResult)) {
                return authResult;
            }
            return retryRequest() as Promise<AsyncResult<T, Error>>;
        }
    }

    // Return error result with context
    const contextualError = config.createContextualError(
        `RPC request '${method}' failed: ${errorMessage}`
    );
    return createErrorResult(contextualError);
}

/**
 * Makes a direct RPC request to the Deluge API
 *
 * @param method - RPC method name
 * @param params - RPC parameters
 * @param config - RPC client configuration
 * @param authState - Authentication state
 * @param requestId - Request ID
 * @returns AsyncResult with response data or error
 */
export async function directRequest<T>(
    method: string,
    params: unknown[],
    config: RpcClientConfig,
    authState: DelugeAuthState,
    requestId: number
): Promise<AsyncResult<T, Error>> {
    const result = await withEnhancedErrorHandling(async () => {
        // Apply rate limiting
        await config.delugeRateLimiter.acquire();

        // Set up request body
        const request: DelugeRequest = {
            id: requestId,
            method,
            params
        };

        // Set up headers
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        // Add session cookie if available
        if (authState.sessionCookie) {
            headers['Cookie'] = authState.sessionCookie;
        }

        // Make the request
        const url = config.buildUrl('/json');
        const httpResponse = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(request)
        });

        if (!httpResponse.ok) {
            throw new ValidationError(`HTTP error! status: ${httpResponse.status}`);
        }

        const response = (await httpResponse.json()) as DelugeResponse<T>;

        // Extract session cookie from response — accept any cookie name
        // (varies across Deluge versions: _session_id, session_id, etc.)
        const setCookieHeader = httpResponse.headers.get('set-cookie');
        if (setCookieHeader) {
            const cookieParts = setCookieHeader.split(';');
            /* eslint-disable-next-line no-param-reassign */
            authState.sessionCookie = cookieParts[0] ?? null;
            logger.info('Deluge: Session cookie updated');
        }

        // Check for errors with proper type validation
        if (response.error) {
            const errorData = response.error;
            handleDelugeError(errorData, method, 'directRequest', authState, config.createContextualError);
        }

        return response.result;
    }, `directRequest: ${method}`);

    return result as AsyncResult<T, Error>;
}

/**
 * Makes a proxied RPC request to the Deluge API
 *
 * @param method - RPC method name
 * @param params - RPC parameters
 * @param config - RPC client configuration
 * @param authState - Authentication state
 * @param _requestId - Request ID (unused in proxy mode but kept for interface consistency)
 * @returns AsyncResult with response data or error
 */
export async function proxyRequest<T>(
    method: string,
    params: unknown[],
    config: RpcClientConfig,
    authState: DelugeAuthState,
    _requestId: number
): Promise<AsyncResult<T, Error>> {
    const result = await withEnhancedErrorHandling(async () => {
        // Apply rate limiting
        await config.delugeRateLimiter.acquire();

        // Prepare proxy request payload
        const proxyPayload: ProxyPayload = {
            method,
            params,
            password: config.password,
            baseURL: config.config.baseURL
        };

        // Include session cookie if we have one
        if (authState.sessionCookie) {
            proxyPayload.sessionCookie = authState.sessionCookie;
        }

        // Force clean login for auth.login requests
        if (method === 'auth.login') {
            proxyPayload.forceCleanLogin = true;
            proxyPayload.isAuthRequest = true;
        }

        // Make request through proxy
        const httpResponse = await fetch(config.proxyPath, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(proxyPayload)
        });

        if (!httpResponse.ok) {
            throw new ValidationError(`HTTP error! status: ${httpResponse.status}`);
        }

        const response = (await httpResponse.json()) as DelugeResponse<T> & {
            sessionCookie?: string;
        };

        // Check if we received a new session cookie from the proxy
        // response is already validated as object by JSON parsing
        if ('sessionCookie' in response && response.sessionCookie) {
            /* eslint-disable-next-line no-param-reassign */
            authState.sessionCookie = response.sessionCookie;
            logger.info('Updated session cookie from proxy response');
        }

        // Check for errors with proper type validation
        if (response.error) {
            const errorData = response.error;
            handleDelugeError(errorData, method, 'proxyRequest', authState, config.createContextualError);
        }

        return response.result;
    }, `proxyRequest: ${method}`);

    return result as AsyncResult<T, Error>;
}
