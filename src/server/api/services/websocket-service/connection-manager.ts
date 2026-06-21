/**
 * WebSocket Connection Manager
 *
 * Handles WebSocket connection lifecycle including:
 * - Connection establishment
 * - Database persistence
 * - Activity tracking
 * - Disconnection cleanup
 *
 * Extracted from: websocketService.ts
 */

import { randomUUID } from 'crypto';

import { WebSocket } from 'ws';

import { presenceService } from '@/server/api/services/PresenceService';
import { authorizationService } from '@/server/api/services/WebSocketAuthorizationService';
import { prisma } from '@/server/db';
import type { WebSocketClient, WebSocketEvent } from '@/types/api/v1/websocket';
import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';

export interface ConnectionManagerDeps {
  serverId: string;
  clients: Map<string, WebSocketClient>;
  sendToClient: (client: WebSocketClient, message: WebSocketEvent) => void;
  emit: (event: string, data: Record<string, unknown>) => void;
  handleMessage: (client: WebSocketClient, data: Record<string, unknown>) => Promise<void>;
}

export class ConnectionManager {
  private serverId: string;
  private clients: Map<string, WebSocketClient>;
  private sendToClient: ConnectionManagerDeps['sendToClient'];
  private emit: ConnectionManagerDeps['emit'];
  private handleMessage: ConnectionManagerDeps['handleMessage'];
  // Track last activity update time per connection to debounce DB writes
  private lastActivityUpdateTime: Map<string, number> = new Map();
  private readonly ACTIVITY_UPDATE_DEBOUNCE_MS = 5000; // Only update DB every 5 seconds per connection

  constructor(deps: ConnectionManagerDeps) {
    this.serverId = deps.serverId;
    this.clients = deps.clients;
    this.sendToClient = deps.sendToClient;
    this.emit = deps.emit;
    this.handleMessage = deps.handleMessage;
  }

  /**
   * Handle new WebSocket connection
   */
  public handleConnection(ws: WebSocket, request: Record<string, unknown>): void {
    const headers = request['headers'] as Record<string, unknown> | undefined;
    // API key already validated in verifyClient, only in headers
    const apiKey = headers ? headers['x-api-key'] : undefined;
    const rawSessionId = headers ? (headers['x-session-id'] ?? headers['sessionid']) : undefined;
    const sessionId = typeof rawSessionId === 'string' ? rawSessionId : undefined;

    // Extract session token from cookies for NextAuth session authentication
    const sessionToken = this.extractSessionToken(headers);

    // Generate UUID for connection
    const connectionId = randomUUID();

    // Create client object - build incrementally for exactOptionalPropertyTypes
    const client: Record<string, unknown> = {
      id: connectionId,
      channels: new Set<string>(),
      socket: ws,
      lastActivity: new Date(),
      apiKey: typeof apiKey === 'string' ? apiKey : undefined, // Store for API key authentication
      sessionToken, // Store for session token authentication
      isReady: false, // Track if connection is ready for messages
    };

    this.clients.set(connectionId, client as unknown as WebSocketClient);

    // Queue for messages received before connection is ready
    const pendingMessages: Array<Record<string, unknown>> = [];

    // Authenticate, persist connection, then send welcome message
    void this.setupConnection(ws, client, connectionId, sessionId, pendingMessages);

    // Handle messages
    ws.on('message', (data) => {
      try {
        const rawParsed: unknown = JSON.parse(data.toString());

        // Validate that parsed data is an object
        if (typeof rawParsed !== 'object' || rawParsed === null || Array.isArray(rawParsed)) {
          logger.error('Invalid WebSocket message format:', {
            error: 'Expected object',
            connectionId,
            data: data.toString().substring(0, 100), // Log first 100 chars only
          });
          return;
        }

        // If client isn't ready yet, queue the message
        if (!client['isReady']) {
          logger.debug('Queuing message until connection is ready', { connectionId });
          pendingMessages.push(rawParsed as Record<string, unknown>);
          return;
        }

        void this.handleMessage(client as unknown as WebSocketClient, rawParsed as Record<string, unknown>);
      } catch (error) {
        logger.error('Failed to parse WebSocket message:', {
          error: getErrorMessage(error),
          connectionId,
          data: data.toString().substring(0, 100), // Log first 100 chars only
        });
      }
    });

    // Handle disconnect
    ws.on('close', (code, reason) => {
      logger.debug('[WS DEBUG] Close event fired', {
        connectionId,
        code,
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- reason may be empty Buffer
        reason: reason ? reason.toString() : '(no reason)',
        isReady: client['isReady'],
      });
      this.handleDisconnect(client as unknown as WebSocketClient);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error for client:', {
        error: getErrorMessage(error),
        connectionId,
        userId: client['userId'],
      });
      this.emit('client:error', { connectionId, error: getErrorMessage(error) });
    });

    // Handle pong for heartbeat
    (client['socket'] as WebSocket).on('pong', () => {
      // Only update if client still exists in the map (not disconnected)
      if (this.clients.has(connectionId)) {
        client['lastActivity'] = new Date();
        // Update last activity in database
        void this.updateConnectionActivity(connectionId);
      }
    });
  }

  /**
   * Setup connection with authentication and proper error handling
   * Handles race conditions and ensures cleanup on failure
   */
  private async setupConnection(
    ws: WebSocket,
    client: Record<string, unknown>,
    connectionId: string,
    sessionId: string | undefined,
    pendingMessages: Array<Record<string, unknown>>
  ): Promise<void> {
    try {
      // Authenticate and get user ID
      const userId = await authorizationService.authenticateClient(client as unknown as WebSocketClient);

      // SECURITY: Reject unauthenticated connections
      if (!userId) {
        logger.warn('[WebSocket] Connection rejected - authentication required', { connectionId });
        ws.close(1008, 'Authentication required');
        this.clients.delete(connectionId);
        return;
      }

      // eslint-disable-next-line no-param-reassign -- Intentional state update on client object
      client['userId'] = userId;

      // Resolve admin status so admins still receive user-targeted events
      // (jobs/downloads) for the cross-user "all activity" views. Best-effort:
      // on failure the socket is treated as non-admin (sees only its own).
      try {
        const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        // eslint-disable-next-line no-param-reassign -- Intentional state update on client object
        client['isAdmin'] = dbUser?.role === 'ADMIN';
      } catch {
        // eslint-disable-next-line no-param-reassign -- default to least privilege
        client['isAdmin'] = false;
      }

      // Check socket still open before persistence (readyState can change asynchronously)
      if ((ws.readyState as number) !== WebSocket.OPEN) {
        logger.warn('[WebSocket] Socket closed before persistence', { connectionId });
        this.clients.delete(connectionId);
        return;
      }

      // CRITICAL: Persist connection to database BEFORE marking as ready
      await this.persistConnection(connectionId, sessionId, userId);

      // Check socket still open after persistence (readyState can change during await)
      if ((ws.readyState as number) !== WebSocket.OPEN) {
        logger.warn('[WebSocket] Socket closed after persistence', { connectionId });
        return;
      }

      // Mark client as ready for messages
      // eslint-disable-next-line no-param-reassign -- Intentional state update on client object
      client['isReady'] = true;

      // Process queued messages
      await this.processQueuedMessages(client, connectionId, pendingMessages);

      // Check socket still open before sending welcome (readyState can change during await)
      if ((ws.readyState as number) !== WebSocket.OPEN) {
        logger.warn('[WebSocket] Socket closed during message processing', { connectionId });
        return;
      }

      // Send welcome message
      this.sendToClient(client as unknown as WebSocketClient, {
        id: `evt_${Date.now()}`,
        type: 'connected',
        data: { connectionId, serverId: this.serverId, userId },
        timestamp: new Date().toISOString(),
      });

      this.emit('client:connected', { connectionId, userId, serverId: this.serverId });
    } catch (error) {
      logger.error('[WebSocket] Connection setup failed', { connectionId, error: getErrorMessage(error) });
      ws.close(1011, 'Internal error during setup');
    } finally {
      // Cleanup if connection not fully established
      if (!client['isReady'] && this.clients.has(connectionId)) {
        this.clients.delete(connectionId);
      }
    }
  }

  /**
   * Process queued messages received before connection was ready
   */
  private async processQueuedMessages(
    client: Record<string, unknown>,
    connectionId: string,
    pendingMessages: Array<Record<string, unknown>>
  ): Promise<void> {
    logger.debug('[WS] Processing queued messages', { connectionId, count: pendingMessages.length });

    for (const msg of pendingMessages) {
      try {
        // eslint-disable-next-line no-await-in-loop -- Sequential processing required for subscription persistence
        await this.handleMessage(client as unknown as WebSocketClient, msg);
      } catch (msgError) {
        logger.error('[WS] Error processing queued message', { connectionId, error: getErrorMessage(msgError) });
      }
    }
  }

  /**
   * Persist connection to database
   *
   * Throws on failure: subscription rows FK onto this record and broadcast
   * delivery joins against it, so a connection that isn't persisted can never
   * receive events. setupConnection catches the throw and closes the socket
   * (1011) instead of leaving a connected-but-deaf client.
   */
  public async persistConnection(
    connectionId: string,
    sessionId: string | undefined,
    userId: string | undefined
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        INSERT INTO websocket_connections (
          connection_id,
          server_id,
          session_id,
          user_id,
          connected_at,
          last_activity
        ) VALUES (
          ${connectionId}::UUID,
          ${this.serverId}::TEXT,
          ${sessionId ?? null}::UUID,
          ${userId ?? null}::TEXT,
          NOW(),
          NOW()
        )
      `;

      logger.debug('Connection persisted to database', {
        connectionId,
        serverId: this.serverId,
        userId,
      });
    } catch (error: unknown) {
      logger.error('Failed to persist connection:', {
        error: getErrorMessage(error),
        connectionId,
      });
      throw error;
    }
  }

  /**
   * Update connection activity timestamp (with debouncing)
   * Only updates DB if enough time has passed since last update to prevent flooding
   */
  public async updateConnectionActivity(connectionId: string): Promise<void> {
    const now = Date.now();
    const lastUpdate = this.lastActivityUpdateTime.get(connectionId) ?? 0;

    // Debounce: skip if we updated recently
    if (now - lastUpdate < this.ACTIVITY_UPDATE_DEBOUNCE_MS) {
      return;
    }

    // Update tracking time
    this.lastActivityUpdateTime.set(connectionId, now);

    try {
      await prisma.$executeRaw`
        UPDATE websocket_connections
        SET last_activity = NOW()
        WHERE connection_id = ${connectionId}::UUID
      `;
    } catch (error: unknown) {
      // Only log once, serialize error properly to avoid [object Object]
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update connection activity', {
        error: errorMessage,
        connectionId,
      });
    }
  }

  /**
   * Handle client disconnect
   */
  public handleDisconnect(client: WebSocketClient): void {
    // Clean up asynchronously
    void this.cleanupDisconnectedClient(client);

    // Remove from local cache immediately
    this.clients.delete(client.id);

    // Clean up activity tracking
    this.lastActivityUpdateTime.delete(client.id);

    // Emit disconnect event
    this.emit('client:disconnected', {
      connectionId: client.id,
      userId: client.userId,
      serverId: this.serverId,
    });
  }

  /**
   * Clean up disconnected client from database
   */
  public async cleanupDisconnectedClient(client: WebSocketClient): Promise<void> {
    try {
      // Get all channels the client was subscribed to
      const channels = Array.from(client.channels);

      // Remove presence from all channels (parallel execution)
      if (client.userId) {
        const userId = client.userId; // Capture for closure
        await Promise.all(
          channels.map((channel) => presenceService.setOffline(channel, userId))
        );
      }

      // Delete all subscriptions
      await prisma.$executeRaw`
        DELETE FROM channel_subscriptions
        WHERE connection_id = ${client.id}::UUID
      `;

      // Delete connection record
      await prisma.$executeRaw`
        DELETE FROM websocket_connections
        WHERE connection_id = ${client.id}::UUID
      `;

      logger.debug('Disconnected client cleaned up', {
        connectionId: client.id,
        userId: client.userId,
        channelCount: channels.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to cleanup disconnected client:', {
        error: getErrorMessage(error),
        connectionId: client.id,
      });
    }
  }

  /**
   * Extract NextAuth session token from request headers
   * Supports both HTTP (next-auth.session-token) and HTTPS (__Secure-next-auth.session-token) cookies
   */
  private extractSessionToken(headers: Record<string, unknown> | undefined): string | undefined {
    if (!headers) {
      return undefined;
    }

    const cookieHeader = headers['cookie'];
    if (!cookieHeader || typeof cookieHeader !== 'string') {
      return undefined;
    }

    // Parse cookies from the header string
    const cookies = cookieHeader.split(';').reduce<Record<string, string>>((acc, cookie) => {
      const [key, ...valueParts] = cookie.trim().split('=');
      if (key) {
        return { ...acc, [key]: valueParts.join('=') };
      }
      return acc;
    }, {});

    // Try HTTPS secure cookie first, then fall back to HTTP cookie
    const sessionToken =
      cookies['__Secure-next-auth.session-token'] ??
      cookies['next-auth.session-token'];

    return sessionToken;
  }
}
