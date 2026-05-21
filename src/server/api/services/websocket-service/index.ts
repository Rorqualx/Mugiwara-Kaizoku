/**
 * WebSocket Service for Real-time Communication
 *
 * Distributed PostgreSQL-backed WebSocket service with:
 * - Database-persisted connection state
 * - Cross-server message routing
 * - Distributed presence tracking
 * - Rate limiting
 * - Graceful shutdown and handover
 *
 * Architecture:
 * - index.ts - Main aggregator (this file)
 * - utils.ts - Schemas, types, error re-exports
 * - connection-manager.ts - Connection lifecycle
 * - subscription-manager.ts - Channel subscriptions
 * - message-router.ts - Message routing/broadcasting
 * - cluster-manager.ts - Cluster operations/shutdown
 *
 * Original: websocketService.ts (1019 lines)
 * Refactored: 6 modules, max 347 lines each
 *
 * @module server/api/services/websocket-service
 */

import { EventEmitter } from 'events';
import os from 'os';

import { WebSocketServer } from 'ws';

import { authorizationService } from '@/server/api/services/WebSocketAuthorizationService';
import { DistributedMessageRouter, initializeRouter } from '@/server/realtime/DistributedMessageRouter';
import { logger } from '@/utils/logger';

import { ClusterManager, generateEventId } from './cluster-manager';
import { ConnectionManager } from './connection-manager';
import { MessageRouter } from './message-router';
import { SubscriptionManager } from './subscription-manager';

import type { WebSocketClient, WebSocketEvent } from './utils';
import type { Server as HTTPServer } from 'http';

/**
 * WebSocketService aggregates all WebSocket modules and coordinates their interactions.
 * Provides a unified API for real-time communication with backward compatibility.
 */
export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;

  // Server identification
  private serverId: string;
  private hostname: string;
  private port: number;

  // Distributed services
  private router: DistributedMessageRouter | null = null;

  // Local client cache
  private clients: Map<string, WebSocketClient> = new Map();

  // Extracted module instances
  private connectionManager!: ConnectionManager;
  private subscriptionManager!: SubscriptionManager;
  private messageRouter!: MessageRouter;
  private clusterManager!: ClusterManager;

  constructor() {
    super();

    this.serverId = `ws_${os.hostname()}_${process.pid}_${Date.now()}`;
    this.hostname = os.hostname();
    this.port = parseInt(process.env['PORT'] ?? '3000', 10);

    this.initializeModules();

    logger.info('WebSocketService initialized', {
      serverId: this.serverId,
      hostname: this.hostname,
      port: this.port,
    });
  }

  /**
   * Initialize all extracted modules with proper dependency wiring
   */
  private initializeModules(): void {
    // Initialize subscription manager first (needed by message router)
    this.subscriptionManager = new SubscriptionManager({
      serverId: this.serverId,
      sendToClient: (client, message) => this.messageRouter.sendToClient(client, message),
      emit: this.emit.bind(this),
      getChannelHistory: (channel, limit) => this.messageRouter.getChannelHistory(channel, limit),
    });

    // Initialize message router
    this.messageRouter = new MessageRouter({
      clients: this.clients,
      getLocalSubscribers: (channel) => this.subscriptionManager.getLocalSubscribers(channel),
      generateEventId,
      handleSubscribe: (client, message) => this.subscriptionManager.handleSubscribe(client, message),
      handleUnsubscribe: (client, message) => this.subscriptionManager.handleUnsubscribe(client, message),
      updateConnectionActivity: (connectionId) => this.connectionManager.updateConnectionActivity(connectionId),
      getRouter: () => this.router,
      emit: this.emit.bind(this),
    });

    // Initialize connection manager
    this.connectionManager = new ConnectionManager({
      serverId: this.serverId,
      clients: this.clients,
      sendToClient: (client, message) => this.messageRouter.sendToClient(client, message),
      emit: this.emit.bind(this),
      handleMessage: (client, data) => this.messageRouter.handleMessage(client, data),
    });

    // Initialize cluster manager with placeholder for router/wss (set during initialize)
    this.clusterManager = new ClusterManager({
      serverId: this.serverId,
      clients: this.clients,
      router: null,
      wss: null,
      messageHistory: new Map(),
      sendToClient: (client, message) => this.messageRouter.sendToClient(client, message),
      cleanupDisconnectedClient: (client) => this.connectionManager.cleanupDisconnectedClient(client),
      handleDisconnect: (client) => this.connectionManager.handleDisconnect(client),
    });
  }

  /**
   * Check if WebSocket service is already initialized
   */
  public isInitialized(): boolean {
    return this.wss !== null;
  }

  /**
   * Initialize WebSocket server with an existing HTTP server
   * Used by custom server (production)
   */
  public async initialize(server: HTTPServer): Promise<void> {
    // Initialize distributed message router
    this.router = initializeRouter(this.serverId, this.hostname, this.port);

    // Listen for routed messages from other servers
    this.router.on('message', (event: { channel: string; payload: Record<string, unknown> }) => {
      void this.messageRouter.handleRoutedMessage(event.channel, event.payload);
    });

    // Start the router
    await this.router.start();

    // Create WebSocket server with verifyClient
    this.wss = new WebSocketServer({
      server,
      path: '/api/v1/ws',
      verifyClient: (info, cb) => {
        void this.verifyClient(info, cb);
      },
    });

    this.wss.on('connection', (ws, request) => {
      this.connectionManager.handleConnection(ws, request as unknown as Record<string, unknown>);
    });

    // Re-initialize cluster manager with actual router and wss
    this.clusterManager = new ClusterManager({
      serverId: this.serverId,
      clients: this.clients,
      router: this.router,
      wss: this.wss,
      messageHistory: new Map(),
      sendToClient: (client, message) => this.messageRouter.sendToClient(client, message),
      cleanupDisconnectedClient: (client) => this.connectionManager.cleanupDisconnectedClient(client),
      handleDisconnect: (client) => this.connectionManager.handleDisconnect(client),
    });

    this.clusterManager.startHeartbeat();
    this.clusterManager.setActive();

    logger.info('WebSocket server initialized', {
      serverId: this.serverId,
      status: this.clusterManager.getStatus(),
      isLeader: this.router.isClusterLeader(),
    });
  }

  /**
   * Initialize WebSocket service with an existing WebSocketServer instance
   * Used by Next.js API route (development mode)
   */
  public async initializeWithWSS(wss: WebSocketServer): Promise<void> {
    if (this.wss) {
      logger.warn('WebSocket service already initialized, skipping');
      return;
    }

    // Check if this WSS is already being used by another WebSocketService instance
    // This prevents double registration when the same WSS is passed to multiple instances
    // (which can happen due to Next.js webpack bundling creating separate module copies)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- WSS typing workaround for duplicate registration check
    const wssAny = wss as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (wssAny.__websocketServiceInitialized) {
      logger.warn('WSS already has a WebSocketService handler, skipping duplicate registration', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        existingServerId: wssAny.__websocketServiceServerId as string,
        thisServerId: this.serverId,
      });
      return;
    }

    // Mark this WSS as initialized by this service
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    wssAny.__websocketServiceInitialized = true;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    wssAny.__websocketServiceServerId = this.serverId;

    this.wss = wss;

    // CRITICAL: Set up connection handling FIRST, before any async operations
    // This ensures connections can be accepted even if distributed router fails
    this.wss.on('connection', (ws, request) => {
      this.connectionManager.handleConnection(ws, request as unknown as Record<string, unknown>);
    });

    logger.info('WebSocket connection handler registered');

    // Initialize distributed message router (optional - can fail without breaking connections)
    try {
      this.router = initializeRouter(this.serverId, this.hostname, this.port);

      // Listen for routed messages from other servers
      this.router.on('message', (event: { channel: string; payload: Record<string, unknown> }) => {
        void this.messageRouter.handleRoutedMessage(event.channel, event.payload);
      });

      // Start the router (may fail if database tables don't exist)
      await this.router.start();

      // Re-initialize cluster manager with actual router and wss
      this.clusterManager = new ClusterManager({
        serverId: this.serverId,
        clients: this.clients,
        router: this.router,
        wss: this.wss,
        messageHistory: new Map(),
        sendToClient: (client, message) => this.messageRouter.sendToClient(client, message),
        cleanupDisconnectedClient: (client) => this.connectionManager.cleanupDisconnectedClient(client),
        handleDisconnect: (client) => this.connectionManager.handleDisconnect(client),
      });

      this.clusterManager.startHeartbeat();
      this.clusterManager.setActive();

      logger.info('WebSocket service initialized via API route', {
        serverId: this.serverId,
        status: this.clusterManager.getStatus(),
        isLeader: this.router.isClusterLeader(),
      });
    } catch (error: unknown) {
      // Distributed router failed but WebSocket can still work locally
      logger.warn('Distributed router failed to start, WebSocket will work in local-only mode', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get the connection manager for handling WebSocket connections
   * Used by API route to manually process connections
   */
  public getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Verify client connection with API key authentication
   */
  private async verifyClient(
    info: { req: { headers: Record<string, unknown> } },
    cb: (result: boolean, code?: number, message?: string) => void
  ): Promise<void> {
    const apiKey = info.req.headers['x-api-key'];

    if (!apiKey) {
      logger.warn('WebSocket connection attempt without API key header');
      cb(false, 401, 'Unauthorized: API key required in x-api-key header');
      return;
    }

    if (Array.isArray(apiKey)) {
      logger.warn('WebSocket connection attempt with multiple API keys');
      cb(false, 400, 'Bad Request: Multiple API keys provided');
      return;
    }

    try {
      const isValid = await authorizationService.validateApiKey(apiKey as string);
      if (!isValid) {
        logger.warn('WebSocket connection attempt with invalid API key');
      }
      cb(isValid, isValid ? undefined : 401, isValid ? undefined : 'Unauthorized: Invalid API key');
    } catch (error: unknown) {
      logger.error('Error validating API key:', error);
      cb(false, 500, 'Internal Server Error');
    }
  }

  // ============================================================================
  // Public API Methods (delegate to modules for backward compatibility)
  // ============================================================================

  /**
   * Broadcast message to all clients in a channel (local only)
   */
  public async broadcastToChannel(channel: string, event: WebSocketEvent): Promise<void> {
    return this.messageRouter.broadcastToChannel(channel, event);
  }

  /**
   * Get connection statistics (database-backed)
   */
  public async getStats(): Promise<{
    totalClients: number;
    totalChannels: number;
    totalServers: number;
    localClients: number;
    clientsByChannel: Record<string, number>;
    averageSubscriptionsPerClient: number;
    presenceStats: {
      totalOnlineUsers: number;
      totalAwayUsers: number;
    };
  }> {
    return this.clusterManager.getStats();
  }

  /**
   * Initiate graceful shutdown
   */
  public async shutdown(): Promise<void> {
    return this.clusterManager.shutdown();
  }

  /**
   * Get server ID
   */
  public getServerId(): string {
    return this.clusterManager.getServerId();
  }

  /**
   * Get server status
   */
  public getStatus(): 'active' | 'draining' | 'stopped' {
    return this.clusterManager.getStatus();
  }

  /**
   * Check if this server is the cluster leader
   */
  public isClusterLeader(): boolean {
    return this.router?.isClusterLeader() ?? false;
  }

  /**
   * Get active servers in the cluster
   */
  public async getClusterServers(): Promise<Array<{
    serverId: string;
    hostname: string;
    port: number;
    connectionCount: number;
    status: string;
  }>> {
    return this.clusterManager.getClusterServers();
  }
}

// Singleton pattern using Node's global object
// This persists across all module contexts including Next.js bundles
declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
  var __websocketService: WebSocketService | undefined;
}

// Check if we're in custom production server mode
const isCustomProductionServer = process.env['CUSTOM_PRODUCTION_SERVER'] === 'true';

// Determine if we should create an instance
let _instance: WebSocketService | null = null;

if (global.__websocketService) {
  // Reuse existing global instance (set by production server or previous import)
  _instance = global.__websocketService;
  logger.info('[WS SINGLETON] Reusing global WebSocketService instance', {
    serverId: _instance.getServerId(),
    isCustomProductionServer,
  });
} else if (!isCustomProductionServer) {
  // Development mode - create instance normally
  _instance = new WebSocketService();
  global.__websocketService = _instance;
  logger.info('[WS SINGLETON] Created WebSocketService instance (dev mode)', {
    serverId: _instance.getServerId(),
  });
} else {
  // Production mode with custom server - DON'T create instance here
  // The production server (server-production.ts) will create and store it
  logger.info('[WS SINGLETON] Skipping auto-creation (production mode, server will create)');
}

// Export singleton instance
// In production mode, this may be null until server-production.ts creates it
// TypeScript assertion is safe because production code uses global.__websocketService directly
export const websocketService: WebSocketService = _instance as WebSocketService;

// Re-export types and utilities for backward compatibility
export * from './utils';
export { generateEventId, generateClientId } from './cluster-manager';
export type { WebSocketStats, ClusterServerInfo, ClusterManagerDeps } from './cluster-manager';
export type { ConnectionManagerDeps } from './connection-manager';
export type { SubscriptionManagerDeps } from './subscription-manager';
export type { MessageRouterDeps } from './message-router';
