/**
 * TRPC WebSocket Server Configuration
 *
 * This module sets up a WebSocket server for TRPC, enabling real-time
 * communication between the client and server. It handles WebSocket
 * connections, upgrades, and cleanup.
 *
 * @module pages/api/trpc-websocket
 * @security Implements WebSocket connection validation
 * @security Handles server cleanup on shutdown
 */
import { parse } from 'url';

import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';

import { authorizationService } from '@/server/api/services/WebSocketAuthorizationService';
import { prisma } from '@/server/db';
import { appRouter } from '@/server/trpc/root';
import type { SocketWithServer } from '@/types/next';
import { logger } from '@/utils/logger';


import type { IncomingMessage } from 'http';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { Duplex } from 'stream';
import type { WebSocket } from 'ws';

/**
 * WebSocket server instance
 * Configured with noServer to handle upgrades manually
 */
const wss = new WebSocketServer({
  noServer: true
});

/**
 * Verify API key from request headers
 * @returns true if valid, false otherwise
 */
async function verifyApiKey(request: IncomingMessage): Promise<boolean> {
  const apiKey = request.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    logger.warn('WebSocket upgrade rejected: No API key provided');
    return false;
  }

  const isValid = await authorizationService.validateApiKey(apiKey);
  if (!isValid) {
    logger.warn('WebSocket upgrade rejected: Invalid API key');
    return false;
  }

  return true;
}

/**
 * Handle WebSocket upgrade with authentication
 */
async function handleWebSocketUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer
): Promise<void> {
  try {
    const isValid = await verifyApiKey(request);
    if (!isValid) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      wss.emit('connection', ws, request);
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('WebSocket upgrade error:', errorMessage);
    socket.destroy();
  }
}

/**
 * TRPC WebSocket handler configuration
 * Sets up request handling, context creation, and error handling
 */
const _handler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: ({ req }) => {
    return {
      prisma,
      req,
      res: undefined,
      user: undefined
    };
  },
  onError: (opt) => {
    logger.error('WebSocket Server Error:', opt.error);
  }
});
/**
 * Server cleanup handler
 * Notifies clients to reconnect and closes WebSocket server on shutdown
 */
process.on('SIGTERM', () => {
  _handler.broadcastReconnectNotification();
  wss.close();
});
/**
 * WebSocket API route handler
 *
 * Handles WebSocket connection upgrades and server initialization.
 * Ensures the WebSocket server is only initialized once.
 *
 * @param {NextApiRequest} req - Next.js API request
 * @param {NextApiResponse} res - Next.js API response
 * @returns {void}
 * @security Validates WebSocket upgrade requests
 * @security Implements error handling for upgrades
 */
export default function wsHandler(req: NextApiRequest, res: NextApiResponse<void>): void {
  const socket = res.socket as SocketWithServer;
  const server = socket.server;
  if (!server.ws) {
    server.ws = true;
    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const pathname = parse(request.url ?? '').pathname;
      if (pathname !== '/api/trpc-websocket') return;

      void handleWebSocketUpgrade(request, socket, head);
    });
  }
  res["status"](200).end();
}