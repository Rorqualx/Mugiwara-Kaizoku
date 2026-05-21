/**
 * Download Clients Router
 *
 * This router handles testing and management of download clients.
 * Replaces direct fetch calls to /api/download-clients/* endpoints.
 *
 * All `test*` mutations return `AsyncResult<{ message, data }, Error>` on both
 * success and failure paths so the UI has a single shape to branch on. A
 * thrown exception or an isError `client.getAllItems()` result both surface as
 * `createErrorResult(...)` — previously a getAllItems isError was nested
 * inside `createSuccessResult` and reported as success.
 */
import { z } from 'zod';

import type { BaseDownloadClient } from '@/server/services/download/base';
import { DelugeClient } from '@/server/services/download/clients/delugeClient';
import { NzbgetClient } from '@/server/services/download/clients/nzbgetClient';
import { SabnzbdClient } from '@/server/services/download/clients/sabnzbdClient';
import { TransmissionClient } from '@/server/services/download/clients/transmission';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, createSuccessResult, isError } from '@/utils/async-result';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

// Input schemas for each client type
// Transmission's RPC client in this codebase does not authenticate requests,
// so the test mutation only needs reachability fields. Username/password were
// removed to keep the test path representative of runtime behavior.
const transmissionConfigSchema = z.object({
    host: z.string(),
    port: z.number(),
    ssl: z.boolean().optional(),
});
// Username/password are required because `createNzbgetClient` rejects without
// them — keeping the test path strictly aligned with runtime construction.
const nzbgetConfigSchema = z.object({
    host: z.string(),
    port: z.number(),
    username: z.string().min(1),
    password: z.string().min(1),
    ssl: z.boolean().optional(),
});
const sabnzbdConfigSchema = z.object({
    host: z.string(),
    port: z.number(),
    apiKey: z.string(),
    ssl: z.boolean().optional(),
});
const delugeConfigSchema = z.object({
    host: z.string(),
    port: z.number(),
    password: z.string(),
    ssl: z.boolean().optional(),
});

interface TestEventDetails {
    client: string;
    host: string;
    port: number;
}

interface TestResultData {
    message: string;
    data: unknown;
}

function emitTestEvent(details: TestEventDetails, success: boolean, errorMessage?: string): void {
    void realtimeEmitter.emitSystemEvent({
        eventType: 'downloadClient:tested',
        source: 'download-clients-router',
        message: success
            ? `${details.client} connection test successful`
            : `${details.client} connection test failed`,
        data: {
            client: details.client,
            host: details.host,
            port: details.port,
            success,
            ...(errorMessage !== undefined ? { error: errorMessage } : {}),
        },
    });
}

/**
 * Runs a download-client connection test and normalizes the result. Both a
 * thrown exception and an isError `getAllItems()` result are reported as
 * `createErrorResult` so the caller has a single AsyncResult shape to branch on.
 */
async function runConnectionTest(
    details: TestEventDetails,
    client: BaseDownloadClient,
): Promise<AsyncResult<TestResultData, Error>> {
    try {
        const result = await client.getAllItems();
        if (isError(result)) {
            emitTestEvent(details, false, result.error.message);
            return createErrorResult(result.error);
        }
        emitTestEvent(details, true);
        return createSuccessResult({
            message: 'Connection successful',
            data: 'data' in result ? result.data : null,
        });
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        emitTestEvent(details, false, err.message);
        return createErrorResult(err);
    }
}

export const downloadClientsRouter = router({
    /**
     * Test Transmission connection
     */
    testTransmission: protectedProcedure
        .input(transmissionConfigSchema)
        .mutation(async ({ input }): Promise<AsyncResult<TestResultData, Error>> => {
            const client = new TransmissionClient({
                host: input.host,
                port: input.port,
                ...(input.ssl !== undefined ? { ssl: input.ssl } : {}),
            });
            return runConnectionTest(
                { client: 'transmission', host: input.host, port: input.port },
                client,
            );
        }),

    /**
     * Test NZBGet connection
     */
    testNzbget: protectedProcedure
        .input(nzbgetConfigSchema)
        .mutation(async ({ input }): Promise<AsyncResult<TestResultData, Error>> => {
            const client = new NzbgetClient({
                host: input.host,
                port: input.port,
                username: input.username,
                password: input.password,
                ...(input.ssl !== undefined ? { ssl: input.ssl } : {}),
            });
            return runConnectionTest(
                { client: 'nzbget', host: input.host, port: input.port },
                client,
            );
        }),

    /**
     * Test SABnzbd connection
     */
    testSabnzbd: protectedProcedure
        .input(sabnzbdConfigSchema)
        .mutation(async ({ input }): Promise<AsyncResult<TestResultData, Error>> => {
            const client = new SabnzbdClient({
                host: input.host,
                port: input.port,
                apiKey: input.apiKey,
                ...(input.ssl !== undefined ? { ssl: input.ssl } : {}),
            });
            return runConnectionTest(
                { client: 'sabnzbd', host: input.host, port: input.port },
                client,
            );
        }),

    /**
     * Test Deluge connection
     */
    testDeluge: protectedProcedure
        .input(delugeConfigSchema)
        .mutation(async ({ input }): Promise<AsyncResult<TestResultData, Error>> => {
            const client = new DelugeClient({
                host: input.host,
                port: input.port,
                password: input.password,
                ...(input.ssl !== undefined ? { ssl: input.ssl } : {}),
            });
            return runConnectionTest(
                { client: 'deluge', host: input.host, port: input.port },
                client,
            );
        }),
});
