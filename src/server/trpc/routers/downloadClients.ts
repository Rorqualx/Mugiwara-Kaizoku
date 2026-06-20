/**
 * Download Clients Router
 *
 * This router handles testing and management of download clients.
 * Replaces direct fetch calls to /api/download-clients/* endpoints.
 *
 * All `test*` mutations return bare `{ message, data }` on success and throw
 * a `TRPCError` (via `toTRPCError`) on failure, so clients use tRPC's typed
 * error channel instead of branching on a wire-serialized AsyncResult. Both a
 * thrown exception and an isError `client.getAllItems()` result surface as a
 * thrown `TRPCError`; the realtime `downloadClient:tested` event is emitted on
 * both the success and failure paths.
 */
import { z } from 'zod';

import type { BaseDownloadClient } from '@/server/services/download/base';
import { DelugeClient } from '@/server/services/download/clients/delugeClient';
import { NzbgetClient } from '@/server/services/download/clients/nzbgetClient';
import { SabnzbdClient } from '@/server/services/download/clients/sabnzbdClient';
import { TransmissionClient } from '@/server/services/download/clients/transmission';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { isError } from '@/utils/async-result';

import { toTRPCError } from '../errors';
import { adminProcedure } from '../procedures';
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
 * Runs a download-client connection test. Returns the bare test result on
 * success; both a thrown exception and an isError `getAllItems()` result are
 * reported by emitting the failure realtime event and throwing a `TRPCError`.
 */
async function runConnectionTest(
    details: TestEventDetails,
    client: BaseDownloadClient,
): Promise<TestResultData> {
    let result: Awaited<ReturnType<BaseDownloadClient['getAllItems']>>;
    try {
        result = await client.getAllItems();
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        emitTestEvent(details, false, err.message);
        throw toTRPCError(err);
    }
    if (isError(result)) {
        emitTestEvent(details, false, result.error.message);
        throw toTRPCError(result.error);
    }
    emitTestEvent(details, true);
    return {
        message: 'Connection successful',
        data: 'data' in result ? result.data : null,
    };
}

export const downloadClientsRouter = router({
    /**
     * Test Transmission connection
     */
    testTransmission: adminProcedure
        .input(transmissionConfigSchema)
        .mutation(async ({ input }): Promise<TestResultData> => {
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
    testNzbget: adminProcedure
        .input(nzbgetConfigSchema)
        .mutation(async ({ input }): Promise<TestResultData> => {
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
    testSabnzbd: adminProcedure
        .input(sabnzbdConfigSchema)
        .mutation(async ({ input }): Promise<TestResultData> => {
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
    testDeluge: adminProcedure
        .input(delugeConfigSchema)
        .mutation(async ({ input }): Promise<TestResultData> => {
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
