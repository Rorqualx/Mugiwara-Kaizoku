/**
 * WebSocket API Route Handler
 *
 * Enables WebSocket connections in Next.js development mode by handling
 * HTTP upgrade requests and delegating to the WebSocket service.
 *
 * This route is the entry point for WebSocket connections at /api/v1/ws.
 * It initializes the WebSocket service on first request and handles all
 * subsequent upgrade requests.
 *
 * @module pages/api/v1/ws
 * @security Implements API key authentication via headers or query params
 */

import { parse } from 'url';

import { WebSocketServer } from 'ws';

import { websocketService } from '@/server/api/services/websocket-service';
import { authorizationService } from '@/server/api/services/WebSocketAuthorizationService';
import type { SocketWithServer } from '@/types/next';
import { logger } from '@/utils/logger';

import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Duplex } from 'stream';
import type { WebSocket } from 'ws';

// Track initialization state (using server-scoped flag like trpc-websocket)
// We use a unique key to avoid conflicts with other WebSocket handlers
const WS_INIT_KEY = 'wsUnifiedInit';

// Keep active WebSocket connections alive to prevent garbage collection
// This is a workaround for Next.js dev mode closing sockets prematurely
const activeConnections: Set<WebSocket> = new Set();

/**
 * Verify WebSocket connection with API key authentication
 * Supports both header-based and query parameter authentication
 * In development mode, allows unauthenticated connections for easier testing
 *
 * @remarks Currently unused - connections are verified in development mode after upgrade.
 * Retained for future production use with custom server.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- retained for future production use
async function verifyClient(
  request: IncomingMessage
): Promise<{ valid: boolean; code?: number; message?: string }> {
  const isDev = process.env.NODE_ENV === 'development';

  // Extract API key from header or query parameter
  const apiKeyHeader = request.headers['x-api-key'];
  const url = new URL(request.url ?? '', `http://${request.headers.host ?? 'localhost'}`);
  const apiKeyQuery = url.searchParams.get('apiKey');

  const apiKey = (apiKeyHeader as string | undefined) ?? apiKeyQuery;

  // In development mode, allow connections without API key
  if (!apiKey) {
    if (isDev) {
      logger.debug('WebSocket connection allowed in development mode (no API key)');
      return { valid: true };
    }
    logger.warn('WebSocket connection attempt without API key');
    return { valid: false, code: 401, message: 'Unauthorized: API key required' };
  }

  if (Array.isArray(apiKey)) {
    logger.warn('WebSocket connection attempt with multiple API keys');
    return { valid: false, code: 400, message: 'Bad Request: Multiple API keys provided' };
  }

  try {
    const isValid = await authorizationService.validateApiKey(apiKey);
    if (!isValid) {
      // In development, allow anyway but log warning
      if (isDev) {
        logger.warn('WebSocket connection with invalid API key allowed in development mode');
        return { valid: true };
      }
      logger.warn('WebSocket connection attempt with invalid API key');
      return { valid: false, code: 401, message: 'Unauthorized: Invalid API key' };
    }
    return { valid: true };
  } catch (error: unknown) {
    logger.error('Error validating API key:', { error });
    // In development, allow anyway but log error
    if (isDev) {
      logger.warn('WebSocket connection allowed despite auth error (development mode)');
      return { valid: true };
    }
    return { valid: false, code: 500, message: 'Internal Server Error' };
  }
}

/**
 * WebSocket API Route Handler
 *
 * Handles WebSocket upgrade requests for real-time communication.
 * Initializes the WebSocket service on first request.
 *
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default function wsHandler(
  req: NextApiRequest,
  res: NextApiResponse<void>
): void {
  const socket = res.socket as SocketWithServer;
  const server = socket.server;

  // Check if unified WebSocket already initialized (server-scoped to survive HMR)
  const serverAny = server as unknown as Record<string, unknown>;
  if (serverAny[WS_INIT_KEY]) {
    // Already initialized, just respond
    res.status(200).end();
    return;
  }

  // Mark as initialized
  serverAny[WS_INIT_KEY] = true;

  // Check if a global WSS was created by server-production.js (production mode)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  const globalWss = (global as any).__wss as WebSocketServer | undefined;
  const isProductionWithCustomServer = globalWss !== undefined;

  logger.info('Initializing WebSocket server via API route', {
    serverType: typeof server,
    hasUpgrade: typeof server.on === 'function',
    isProductionWithCustomServer,
  });

  // In production with custom server, use the global WSS
  // In development, create our own WSS
  let wss: WebSocketServer;
  if (isProductionWithCustomServer) {
    wss = globalWss;
    logger.info('Using global WSS from server-production.js');
  } else {
    // Create WebSocket server with noServer mode (we handle upgrades manually)
    wss = new WebSocketServer({ noServer: true });
    logger.info('Created new WSS for development mode');
  }

  // Store WSS on server for reference
  server.wss = wss;

    // Initialize the WebSocket service with this WSS instance
    const initPromise = websocketService.initializeWithWSS(wss);
    if (initPromise instanceof Promise) {
      initPromise.catch((error: unknown) => {
        logger.error('Failed to initialize WebSocket service:', { error });
      });
    }

    // Handle upgrade requests for this path
    // IMPORTANT: The upgrade handler must be synchronous or the connection will be reset.
    // In development mode, we handle the upgrade immediately and verify auth after.
    // In production with custom server, upgrades are handled by server-production.js
    if (isProductionWithCustomServer) {
      logger.info('Skipping upgrade handler registration - handled by server-production.js');
    } else {
      server.on('upgrade', (request: IncomingMessage, upgradeSocket: Duplex, head: Buffer) => {
      const pathname = parse(request.url ?? '').pathname;

      logger.debug('WebSocket upgrade request received', {
        pathname,
        url: request.url,
        headers: {
          upgrade: request.headers.upgrade,
          connection: request.headers.connection,
        },
      });

      // Only handle requests to /api/v1/ws
      if (pathname === '/api/v1/ws') {
        // CRITICAL: Handle upgrade SYNCHRONOUSLY to prevent connection reset.
        // In development mode, we allow all connections and verify auth in the connection handler.
        // This matches how tRPC WebSocket handler works.
        try {
          // CRITICAL: Completely hijack the socket from Next.js
          const rawSocket = upgradeSocket as Socket;

          // Remove ALL listeners to prevent any interference
          rawSocket.removeAllListeners();

          // Configure socket for long-running WebSocket connection
          rawSocket.setTimeout(0);
          rawSocket.setKeepAlive(true, 30000);
          rawSocket.setNoDelay(true);

          // Prevent Node.js from considering this socket idle
          rawSocket.ref();

          wss.handleUpgrade(request, upgradeSocket, head, (ws: WebSocket) => {
            // Store in Set to prevent garbage collection
            activeConnections.add(ws);

            // Comprehensive socket configuration to prevent premature closure
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
            const underlyingSocket = (ws as any)._socket as Socket | undefined;
            if (underlyingSocket) {
              underlyingSocket.setTimeout(0);
              underlyingSocket.setKeepAlive(true, 30000);
              underlyingSocket.setNoDelay(true);
              underlyingSocket.removeAllListeners('timeout');
            }

            ws.on('close', () => {
              activeConnections.delete(ws);
              logger.debug('WebSocket removed from active connections', {
                activeCount: activeConnections.size,
              });
            });

            logger.info('WebSocket connection upgraded successfully', {
              activeCount: activeConnections.size,
            });
            wss.emit('connection', ws, request);
          });
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.error('WebSocket upgrade error:', { error: errorMessage });
          upgradeSocket.destroy();
        }
      } else {
        logger.debug('WebSocket upgrade ignored for path', { pathname });
      }
    });
    } // Close the if (!isProductionWithCustomServer) block

  logger.info('WebSocket server initialized, listening on /api/v1/ws');

  // Check if this is a WebSocket upgrade request
  const isUpgrade = req.headers.upgrade?.toLowerCase() === 'websocket';

  if (isUpgrade) {
    // For WebSocket upgrades, don't end the response
    // The upgrade handler has taken ownership of the socket
    logger.debug('WebSocket upgrade request - socket handed off to WSS');
    return;
  }

  // Only respond for non-upgrade HTTP requests (health checks, etc.)
  res.status(200).end();
}

// Disable body parsing for WebSocket route
export const config = {
  api: {
    bodyParser: false,
  },
};
