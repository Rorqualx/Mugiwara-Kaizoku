/**
 * Backup Progress SSE Endpoint
 *
 * Provides Server-Sent Events for real-time backup progress updates.
 * Streams progress updates to the client during backup operations.
 *
 * @module pages/api/backup/progress/[id]
 */
import { EventEmitter } from 'events';

import { logger } from '@/server/utils/logger';
import { createApiRoute } from '@/utils/api-route-factory';
// Create a singleton event emitter for backup progress
class BackupProgressEmitter extends EventEmitter {
    private static instance: BackupProgressEmitter | undefined;
    private constructor() {
        super();
        // Set max listeners to handle multiple concurrent connections
        this.setMaxListeners(100);
    }
    static getInstance(): BackupProgressEmitter {
        BackupProgressEmitter.instance ??= new BackupProgressEmitter();
        return BackupProgressEmitter.instance;
    }
    emitProgress(backupId: string, progress: BackupProgress): void {
        this.emit(`backup-${backupId}`, progress);
    }
}
export interface BackupProgress {
    stage: 'initializing' | 'database' | 'config' | 'media' | 'compressing' | 'finalizing' | 'completed' | 'failed';
    percentage: number;
    message: string;
    error?: string;
}
// Export for use in backup service
export const backupProgressEmitter = BackupProgressEmitter.getInstance();
export default createApiRoute({
    requireAuth: true,
    permissions: {
        GET: { resource: 'backup', action: 'read' },
    },
    handlers: {
        GET: (req, res): Promise<void> => {
            // Check admin role
            const authUser = req.auth && typeof req.auth === 'object' && 'role' in req.auth ? req.auth as { role: string } : null;
            if (authUser?.role !== 'ADMIN') {
                return Promise.resolve(res["status"](403).json({ error: 'Admin access required' }));
            }
            const { id } = req.query;
            if (!id || typeof id !== 'string') {
                return Promise.resolve(res["status"](400).json({ error: 'Invalid backup ID' }));
            }
            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no', // Disable Nginx buffering
            });
            // Send initial connection message
            res.write(':ok\n\n');
            // Keep track of whether the connection is still alive
            let isConnected = true;

            // Progress handler
            const progressHandler = (progress: BackupProgress): void => {
                if (!isConnected)
                    return;
                try {
                    const data = JSON.stringify(progress);
                    res.write(`data: ${data}\n\n`);
                    // End the connection when backup is completed or failed
                    if (progress.stage === 'completed' || progress.stage === 'failed') {
                        setTimeout(() => {
                            res.end();
                            isConnected = false;
                        }, 1000);
                    }
                }
                catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.error('Error sending backup progress:', errorMessage);
                    res.end();
                    isConnected = false;
                }
            };
            // Listen for progress events
            backupProgressEmitter.on(`backup-${id}`, progressHandler);
            // Send heartbeat every 30 seconds to keep connection alive
            const heartbeatInterval = setInterval(() => {
                if (!isConnected) {
                    clearInterval(heartbeatInterval);
                    return;
                }
                try {
                    res.write(':heartbeat\n\n');
                }
                catch {
                    clearInterval(heartbeatInterval);
                    isConnected = false;
                }
            }, 30000);

            // Single cleanup handler for client disconnect
            const cleanup = (): void => {
                isConnected = false;
                backupProgressEmitter.removeListener(`backup-${id}`, progressHandler);
                clearInterval(heartbeatInterval);
                logger.info(`Backup progress SSE connection closed for backup ${id}`);
            };

            req.on('close', cleanup);

            // Return a promise that resolves when the connection is established
            return Promise.resolve();
        },
    },
});
