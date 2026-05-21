/**
 * Authentication module for Deluge client
 *
 * Handles the multi-step authentication process:
 * 1. Login with auth.login
 * 2. Get hosts with web.get_hosts
 * 3. Connect to daemon with web.connect
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { DelugeAuthState, RpcRequestFn, DelugeDaemonInfo } from './types';

/**
 * Extracts host ID from daemon info
 * Handles different formats across Deluge versions
 */
function extractHostId(hostInfo: DelugeDaemonInfo | unknown[]): string {
    // Array format: [host_id, host_address, port, status]
    if (Array.isArray(hostInfo)) {
        return hostInfo[0] as string;
    }

    // Object format with id property
    if (typeof hostInfo === 'object' && 'id' in hostInfo) {
        const typedHost = hostInfo as { id?: string };
        if (typedHost.id) {
            return typedHost.id;
        }
    }

    // Fallback for different Deluge versions
    return '0';
}

/**
 * Resets authentication state to initial values
 */
function resetAuthState(state: DelugeAuthState): void {
     
    state.authenticated = false;
    state.connected = false;
    state.sessionCookie = null;
    state.hostId = null;
     
}

/**
 * Ensures the Deluge client is authenticated and connected to a daemon
 *
 * @param state - Current authentication state (will be mutated)
 * @param password - Deluge password
 * @param rpcRequest - Function to make RPC requests
 * @param createContextualError - Function to create contextual errors
 * @returns AsyncResult indicating success or failure
 */
export async function ensureAuthenticated(
    state: DelugeAuthState,
    password: string,
    rpcRequest: RpcRequestFn,
    createContextualError: (message: string) => Error
): Promise<AsyncResult<void, Error>> {
    // If we're already authenticated and connected, we're good
    if (state.authenticated && state.connected) {
        return createSuccessResult(undefined);
    }

    try {
        // Reset state for fresh authentication
        resetAuthState(state);

        // Step 1: Login with auth.login
        logger.info('Deluge: Step 1 - Authenticating with password');
        const loginResult = await rpcRequest<boolean>('auth.login', [password], true);

        if (isError(loginResult)) {
            const errorMessage = loginResult.error instanceof Error
                ? loginResult.error.message
                : String(loginResult.error);
            throw createContextualError(`Authentication failed: ${errorMessage}`);
        }

        if (!isSuccess(loginResult) || !loginResult.data) {
            throw createContextualError('Invalid authentication credentials for Deluge client');
        }

         
        state.authenticated = true;
        logger.info('Deluge: Authentication successful');

        // Step 2: Get available hosts with web.get_hosts
        logger.info('Deluge: Step 2 - Getting available hosts');
        const hostsResult = await rpcRequest<DelugeDaemonInfo[]>('web.get_hosts', [], false);

        if (isError(hostsResult)) {
            const errorMessage = hostsResult.error instanceof Error
                ? hostsResult.error.message
                : String(hostsResult.error);
            throw createContextualError(`Failed to get hosts: ${errorMessage}`);
        }

        if (!isSuccess(hostsResult)) {
            logger.error('Deluge: web.get_hosts did not return success', { hostsResult });
            throw createContextualError('No Deluge daemons available. Please ensure Deluge daemon is running.');
        }

        const hosts = hostsResult.data;
        logger.info(`Deluge: web.get_hosts returned ${hosts.length} host(s)`, { hosts: JSON.stringify(hosts) });
        if (hosts.length === 0) {
            throw createContextualError('No Deluge daemons available. Please ensure Deluge daemon is running.');
        }

        logger.info(`Deluge: Found ${hosts.length} host(s)`);

        // Step 3: Connect to the first available host with web.connect
        const hostInfo = hosts[0];
        if (!hostInfo) {
            throw createContextualError('No Deluge daemons available. Please ensure Deluge daemon is running.');
        }
         
        state.hostId = extractHostId(hostInfo);

        logger.info(`Deluge: Step 3 - Connecting to host: ${state.hostId}`);
        const connectResult = await rpcRequest<boolean>('web.connect', [state.hostId], false);

        if (isError(connectResult)) {
            const errorMessage = connectResult.error instanceof Error
                ? connectResult.error.message
                : String(connectResult.error);
            throw createContextualError(`Failed to connect to daemon ${state.hostId}: ${errorMessage}`);
        }

        if (!isSuccess(connectResult)) {
            throw createContextualError(`Failed to connect to Deluge daemon ${state.hostId}`);
        }

         
        state.connected = true;
        logger.info('Deluge: Successfully connected to daemon');

        return createSuccessResult(undefined);
    } catch (error: unknown) {
        // Handle cleanup on error
        resetAuthState(state);

        if (error instanceof Error) {
            return createErrorResult(error);
        }
        return createErrorResult(new Error(String(error)));
    }
}
