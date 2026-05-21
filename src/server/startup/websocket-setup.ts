/**
 * WebSocket Setup Module
 *
 * Extracted from server-production.ts to allow the unified server
 * (src/server/index.ts) to initialize WebSocket support.
 *
 * Uses noServer mode with manual upgrade handling to:
 * - Route /api/v1/ws connections to the WebSocket service
 * - Pass through /_next/ paths for HMR in development
 * - Configure socket timeouts and keepalive for production stability
 *
 * @module server/startup/websocket-setup
 */

import { parse } from 'url';

import { WebSocketServer } from 'ws';

import { logger } from '@/utils/logger';

import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { Socket } from 'net';
import type { Duplex } from 'stream';
import type { WebSocket } from 'ws';

// Store WebSocket server globally for Next.js API routes to access
declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
  var __wss: WebSocketServer | null;
}

let wss: WebSocketServer | null = null;
let serviceInitialized = false;

/**
 * Dynamically import and initialize the WebSocket service.
 * Dynamic import avoids triggering auto-creation of the singleton
 * during static module resolution in src/server/index.ts.
 */
async function initWebSocketService(): Promise<void> {
  if (serviceInitialized || !wss) return;

  try {
    const { WebSocketService } = await import(
      '@/server/api/services/websocket-service'
    );

    if (!global.__websocketService) {
      global.__websocketService = new WebSocketService();
      logger.info('WebSocketService instance created and stored globally');
    }

    if (!global.__websocketService.isInitialized()) {
      await global.__websocketService.initializeWithWSS(wss);
      logger.info('WebSocket service initialized with WSS');
    }

    serviceInitialized = true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize WebSocket service: ${msg}`);
  }
}

/**
 * Configure a newly upgraded WebSocket connection and route it
 * to the WebSocket service connection manager.
 */
function onWebSocketUpgraded(ws: WebSocket, request: IncomingMessage): void {
  // Configure underlying socket for long-lived connections
  const underlying = (ws as unknown as { _socket?: Socket })._socket;
  if (underlying?.setTimeout) {
    underlying.setTimeout(0);
    underlying.setKeepAlive(true, 30_000);
  }

  // Route to WebSocket service connection manager
  if (global.__websocketService) {
    global.__websocketService
      .getConnectionManager()
      .handleConnection(ws, request as unknown as Record<string, unknown>);
  } else {
    logger.error('No global WebSocketService instance available');
    wss?.emit('connection', ws, request);
  }
}

/**
 * Set up WebSocket server and upgrade handling on the given HTTP server.
 *
 * Creates a WebSocketServer in noServer mode and registers an upgrade
 * handler that routes /api/v1/ws connections while passing through
 * Next.js HMR paths (/_next/).
 */
export async function setupWebSocket(server: Server): Promise<void> {
  wss = new WebSocketServer({ noServer: true });
  global.__wss = wss;

  server.on(
    'upgrade',
    (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      void handleUpgrade(request, socket, head);
    }
  );

  // Initialize WebSocket service eagerly
  await initWebSocketService();

  logger.info('WebSocket server configured on /api/v1/ws');
}

/**
 * Handle HTTP upgrade requests, routing WebSocket connections
 * and passing through Next.js HMR paths.
 */
async function handleUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer
): Promise<void> {
  const { pathname } = parse(request.url ?? '');

  if (pathname === '/api/v1/ws') {
    await handleWebSocketUpgrade(request, socket, head);
  } else if (pathname?.startsWith('/_next/')) {
    // Next.js HMR — let Next.js handle the upgrade
    return;
  } else {
    // Unknown upgrade request
    socket.destroy();
  }
}

/**
 * Process a WebSocket upgrade for the /api/v1/ws endpoint.
 */
async function handleWebSocketUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer
): Promise<void> {
  try {
    if (!serviceInitialized) {
      await initWebSocketService();
    }

    // Disable timeout on the raw socket
    (socket as Socket).setTimeout(0);

    if (!wss) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      onWebSocketUpgraded(ws, request);
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`WebSocket upgrade error: ${msg}`);
    socket.destroy();
  }
}

/**
 * Close all WebSocket connections and shut down the WSS.
 * Safe to call even if WebSocket was never initialized.
 */
export function shutdownWebSocket(): void {
  if (wss) {
    wss.clients.forEach((client) => {
      client.close(1001, 'Server shutting down');
    });
    wss.close();
    wss = null;
    global.__wss = null;
  }
  serviceInitialized = false;
}
