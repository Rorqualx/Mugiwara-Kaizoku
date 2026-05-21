#!/usr/bin/env node
/**
 * Production Server with WebSocket Support
 *
 * This custom server handles both HTTP requests via Next.js
 * and WebSocket upgrades for real-time communication.
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
const envPath = join(process.cwd(), envFile);
if (existsSync(envPath)) {
  console.log(`Loading environment from ${envFile}...`);
  dotenv.config({ path: envPath });
} else {
  const defaultEnvPath = join(process.cwd(), '.env');
  if (existsSync(defaultEnvPath)) {
    console.log('Loading environment from .env...');
    dotenv.config({ path: defaultEnvPath });
  }
}

// Set defaults
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.KAIZOKU_LOG_PATH = process.env.KAIZOKU_LOG_PATH || './logs';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

console.log('Starting production server with WebSocket support...');
console.log(`  NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  HOST: ${hostname}:${port}`);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Track WebSocket initialization
let wss = null;
let websocketServiceInitialized = false;

// Store WebSocket server globally for Next.js API routes to access
global.__wss = null;

app.prepare().then(async () => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Create WebSocket server in noServer mode
  wss = new WebSocketServer({ noServer: true });

  // Store WSS globally for Next.js API routes to access
  global.__wss = wss;

  // Handle upgrade requests
  server.on('upgrade', async (request, socket, head) => {
    const { pathname } = parse(request.url || '');

    // Handle unified WebSocket endpoint
    if (pathname === '/api/v1/ws') {
      try {
        // Disable timeout on the socket
        socket.setTimeout(0);

        wss.handleUpgrade(request, socket, head, (ws) => {
          // Disable timeout on the WebSocket's underlying socket
          if (ws._socket?.setTimeout) {
            ws._socket.setTimeout(0);
            ws._socket.setKeepAlive(true, 30000);
          }

          // Track socket events for debugging
          ws.on('error', (err) => {
            console.error('WebSocket error:', err.message);
          });

          console.log('WebSocket connection upgraded successfully');

          // Emit connection event to WSS for handlers to process
          // The websocketService will be initialized on first API request
          wss.emit('connection', ws, request);
        });
      } catch (error) {
        console.error('WebSocket upgrade error:', error.message);
        socket.destroy();
      }
    } else if (pathname === '/api/trpc-websocket') {
      // Let tRPC handle its own WebSocket upgrades
      console.log('tRPC WebSocket upgrade request - passing through');
    } else {
      // Unknown upgrade request
      console.log(`Unknown upgrade request for path: ${pathname}`);
      socket.destroy();
    }
  });

  // Start server
  server.listen(port, hostname, () => {
    console.log(`✓ Production server ready on http://${hostname}:${port}`);
    console.log(`✓ WebSocket endpoint: ws://${hostname}:${port}/api/v1/ws`);

    // Initialize WebSocket service after a delay to ensure server is fully ready
    // This triggers the API route which initializes the websocketService with our global WSS
    setTimeout(async () => {
      try {
        console.log('Initializing WebSocket service...');
        const response = await fetch(`http://127.0.0.1:${port}/api/v1/ws`, {
          method: 'GET',
          headers: { 'Accept': 'text/plain' }
        });
        if (response.ok) {
          console.log('✓ WebSocket service initialized');
        }
      } catch (error) {
        console.error('WebSocket service initialization error:', error.message);
      }
    }, 500); // 500ms delay to ensure server is fully listening
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    // Close WebSocket connections
    if (wss) {
      wss.clients.forEach((client) => {
        client.close(1001, 'Server shutting down');
      });
      wss.close();
    }

    // Close HTTP server
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.log('Force exit');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});
