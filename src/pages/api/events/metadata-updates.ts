/**
 * Metadata Updates SSE API
 *
 * This API endpoint provides server-sent events (SSE) for real-time
 * metadata update notifications. It allows clients to subscribe to
 * metadata update events for specific manga titles.
 *
 * Features:
 * - Real-time streaming of metadata update events
 * - Filtering by manga ID
 * - Connection management for active clients
 * - Cleanup of inactive connections
 */
import { z } from 'zod';

import { createStreamingRoute } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

// Type for connected clients
type Client = {
    id: string;
    res: unknown;
    mangaId?: number;
    lastEventTime: number;
};
// Global connection store (will be shared between function calls)
const clients: Map<string, Client> = new Map();
// Validation schema for query parameters
const querySchema = z.object({
    mangaId: z.string().regex(/^\d+$/).transform(Number).optional(),
});
// Utility to send events to all connected clients or filtered by mangaId
export const sendMetadataUpdateEvent = (data: Record<string, unknown>): void => {
    const now = Date.now();
    // Filter clients by mangaId if specified
    const eligibleClients = Array.from(clients.values()).filter((client): boolean => {
        if (data["mangaId"] && client.mangaId) {
            return client.mangaId === data["mangaId"];
        }
        return true;
    });
    // Send event to each eligible client
    for (const client of eligibleClients) {
        try {
            const resObj = client.res as { write: (data: string) => void };
            resObj.write(`data: ${JSON.stringify(data)}\n\n`);
            // Update through Map to avoid no-param-reassign
            const storedClient = clients.get(client.id);
            if (storedClient) {
                storedClient.lastEventTime = now;
            }
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error sending SSE to client ${client.id}: ${errorMessage}`);
            // Remove the client if we can't send to it
            clients.delete(client.id);
        }
    }
};
export default createStreamingRoute({
    requireAuth: true,
    permissions: {
        GET: { resource: 'events', action: 'read' },
    },
    validation: {
        query: querySchema,
    },
    handlers: {
        GET: (req, res): void => {
            // Extract validated mangaId from query
            const { mangaId } = req.query as z.infer<typeof querySchema>;
            // Set up SSE headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for nginx
            // Generate client ID
            const clientId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            // Register client
            clients.set(clientId, {
                id: clientId,
                res,
                ...(mangaId !== undefined ? { mangaId } : {}),
                lastEventTime: Date.now()
            });
            logger.info(`Client connected to metadata updates SSE: ${clientId}${mangaId ? ` for manga ID ${mangaId}` : ''}`);
            // Send initial connection message
            res.write(`data: ${JSON.stringify({ type: 'connected', clientId, timestamp: Date.now() })}\n\n`);
            // Set up client disconnect handler
            req.on('close', () => {
                clients.delete(clientId);
                logger.info(`Client disconnected from metadata updates SSE: ${clientId}`);
                res.end();
            });
            // Set up periodic heartbeat and cleanup
            const heartbeatInterval = setInterval(() => {
                // Send heartbeat
                try {
                    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
                }
                catch (_error: unknown) {
                    // If heartbeat fails, client is disconnected
                    clients.delete(clientId);
                    clearInterval(heartbeatInterval);
                }
                // Clean up stale connections (no events for over 5 minutes)
                const now = Date.now();
                const staleTimeout = 5 * 60 * 1000; // 5 minutes
                for (const [id, client] of clients.entries()) {
                    if (now - client.lastEventTime > staleTimeout) {
                        try {
                            const resObj = client.res as { end: () => void };
                            resObj.end();
                        }
                        catch (_error: unknown) {
                            // Ignore errors when ending stale connections
                        }
                        clients.delete(id);
                        logger.info(`Removed stale SSE client: ${id}`);
                    }
                }
            }, 30000); // Send heartbeat every 30 seconds
            // Clean up interval on disconnect
            req.on('close', () => {
                clearInterval(heartbeatInterval);
            });
        },
    },
});
