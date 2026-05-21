/**
 * WebSocket API Adapter
 *
 * Manages WebSocket connections for the API
 */
import type { ApiConfig, ApiAuth } from '@/types/api/common';
import type {
  WebSocketEvent 
} from '@/types/api/v1/websocket';
import { 
  CHANNEL_PATTERNS, 
  WS_EVENT_TYPES 
} from '@/types/api/v1/websocket';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';

import { webhookService } from '../services/webhookService';
import { websocketService } from '../services/websocketService';

import { BaseApiAdapter } from './BaseApiAdapter';
interface WebSocketApiConfig extends ApiConfig {
  enabled?: boolean;
  broadcastToSSE?: boolean;
  broadcastToWebhooks?: boolean;
}
export class WebSocketApiAdapter extends BaseApiAdapter<WebSocketApiConfig> {
  constructor(config: WebSocketApiConfig) {
    super(config);
    this.setupEventHandlers();
  }
  /**
   * Validate API key (required by BaseApiAdapter)
   */
  protected validateApiKey(key: string): Promise<ApiAuth | null> {
    // For WebSocket connections, we can use a simpler validation
    // In production, this should validate against your auth system
    if (!key || key.length < 10) {
      return Promise.resolve(null);
    }
    return Promise.resolve({
      userId: 'websocket-user',
      user: {
        id: 'websocket-user',
        email: 'websocket@system.local',
        role: 'USER' as const,
      },
      permissions: [
        { resource: 'websocket', actions: ['read', 'write'] },
      ],
    });
  }
  /**
   * Set up event handlers for system events
   */
  private setupEventHandlers(): void {
    // Forward webhook events to WebSocket
    webhookService.on('event:triggered', (event) => {
      this.broadcastSystemEvent(event);
    });
    // Handle WebSocket events
    websocketService.on('client:connected', (data) => {
      this.logger.info('WebSocket client connected', data);
    });
    websocketService.on('client:disconnected', (data) => {
      this.logger.info('WebSocket client disconnected', data);
    });
    websocketService.on('client:error', (data) => {
      this.logger.error('WebSocket client error', data);
    });
    websocketService.on('message:published', (data) => {
      this.logger.debug('WebSocket message published', data);
    });
  }
  /**
   * Broadcast manga created event
   */
  public async broadcastMangaCreated(manga: Record<string, unknown>): Promise<AsyncResult<void, Error>> {
    try {
      const event: WebSocketEvent = {
        id: this.generateEventId(),
        type: 'message',
        channel: CHANNEL_PATTERNS.MANGA_UPDATES(Number(manga["id"])),
        data: {
          event: 'manga:created',
          manga: {
            id: manga["id"],
            title: manga["title"],
            source: manga["source"],
            libraryId: manga["libraryId"],
          },
        },
        timestamp: new Date().toISOString(),
      };
      // Broadcast to WebSocket
      if (event.channel) {
        void websocketService.broadcastToChannel(event.channel, event);
      }
      // PUBLIC_UPDATES channel doesn't exist, use a simple string
      void websocketService.broadcastToChannel('public:updates', event);
      // Forward to SSE if enabled
      if (this.config.broadcastToSSE) {
        // Note: eventStreamService.sendEvent method needs to be implemented
      }
      // Trigger webhooks if enabled
      if (this.config.broadcastToWebhooks) {
        await webhookService.trigger({
          id: this.generateEventId(),
          type: 'manga:created',
          data: event.data as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        });
      }
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to broadcast manga created event')
      );
    }
  }
  /**
   * Broadcast manga updated event
   */
  public async broadcastMangaUpdated(
    mangaId: number,
    changes: unknown
  ): Promise<AsyncResult<void, Error>> {
    try {
      const event: WebSocketEvent = {
        id: this.generateEventId(),
        type: 'message',
        channel: CHANNEL_PATTERNS.MANGA_UPDATES(mangaId),
        data: {
          event: WS_EVENT_TYPES.MANGA_UPDATE,
          mangaId,
          changes,
        },
        timestamp: new Date().toISOString(),
      };
      if (event.channel) {
        void websocketService.broadcastToChannel(event.channel, event);
      }
      // Forward to other systems
      if (this.config.broadcastToSSE) {
        // Note: eventStreamService.sendEvent method needs to be implemented
      }
      if (this.config.broadcastToWebhooks) {
        await webhookService.trigger({
          id: this.generateEventId(),
          type: WS_EVENT_TYPES.MANGA_UPDATE,
          data: event.data as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        });
      }
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to broadcast manga updated event')
      );
    }
  }
  /**
   * Broadcast chapter download progress
   */
  public broadcastDownloadProgress(
    downloadId: string,
    progress: number,
    speed: number,
    eta: number
  ): Promise<AsyncResult<void, Error>> {
    try {
      const event: WebSocketEvent = {
        id: this.generateEventId(),
        type: 'message',
        channel: CHANNEL_PATTERNS.DOWNLOAD_PROGRESS,
        data: {
          event: WS_EVENT_TYPES.DOWNLOAD_PROGRESS,
          downloadId,
          progress,
          speed,
          eta,
        },
        timestamp: new Date().toISOString(),
      };
      if (event.channel) {
        void websocketService.broadcastToChannel(event.channel, event);
      }
      // Only send to SSE, not webhooks (too frequent)
      if (this.config.broadcastToSSE) {
        // Note: eventStreamService.sendEvent method needs to be implemented
        // eventStreamService.sendEvent({
        //   type: WS_EVENT_TYPES.DOWNLOAD_PROGRESS,
        //   data: event.data,
        // });
      }
      return Promise.resolve(createSuccessResult(undefined));
    } catch (error: unknown) {
      return Promise.resolve(createErrorResult(
        error instanceof Error ? error : new Error('Failed to broadcast download progress')
      ));
    }
  }
  /**
   * Broadcast library scan started
   */
  public async broadcastLibraryScanStarted(
    libraryId: number,
    libraryName: string
  ): Promise<AsyncResult<void, Error>> {
    try {
      const event: WebSocketEvent = {
        id: this.generateEventId(),
        type: 'message',
        channel: CHANNEL_PATTERNS.LIBRARY_UPDATES(libraryId),
        data: {
          event: WS_EVENT_TYPES.LIBRARY_SCAN,
          libraryId,
          libraryName,
          startedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
      if (event.channel) {
        void websocketService.broadcastToChannel(event.channel, event);
      }
      void websocketService.broadcastToChannel('public:updates', event);
      // Forward to other systems
      if (this.config.broadcastToSSE) {
        // Note: eventStreamService.sendEvent method needs to be implemented
        // eventStreamService.sendEvent({
        //   type: WS_EVENT_TYPES.LIBRARY_SCAN_STARTED,
        //   data: event.data,
        // });
      }
      if (this.config.broadcastToWebhooks) {
        await webhookService.trigger({
          id: this.generateEventId(),
          timestamp: new Date().toISOString(),
          type: WS_EVENT_TYPES.LIBRARY_SCAN,
          data: event.data as Record<string, unknown>,
        });
      }
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to broadcast library scan started')
      );
    }
  }
  /**
   * Broadcast library scan completed
   */
  public async broadcastLibraryScanCompleted(
    libraryId: number,
    libraryName: string,
    stats: {
      newManga: number;
      updatedManga: number;
      newChapters: number;
      duration: number;
    }
  ): Promise<AsyncResult<void, Error>> {
    try {
      const event: WebSocketEvent = {
        id: this.generateEventId(),
        type: 'message',
        channel: CHANNEL_PATTERNS.LIBRARY_UPDATES(libraryId),
        data: {
          event: 'library:scan:completed',
          libraryId,
          libraryName,
          stats,
          completedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
      if (event.channel) {
        void websocketService.broadcastToChannel(event.channel, event);
      }
      void websocketService.broadcastToChannel('public:updates', event);
      // Forward to other systems
      if (this.config.broadcastToSSE) {
        // Note: eventStreamService.sendEvent method needs to be implemented
        // eventStreamService.sendEvent({
        //   type: WS_EVENT_TYPES.LIBRARY_SCAN_COMPLETED,
        //   data: event.data,
        // });
      }
      if (this.config.broadcastToWebhooks) {
        await webhookService.trigger({
          id: this.generateEventId(),
          timestamp: new Date().toISOString(),
          type: 'library:scan:completed',
          data: event.data as Record<string, unknown>,
        });
      }
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to broadcast library scan completed')
      );
    }
  }
  /**
   * Send notification to specific user
   */
  public sendUserNotification(
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      data?: unknown;
    }
  ): Promise<AsyncResult<void, Error>> {
    try {
      const event: WebSocketEvent = {
        id: this.generateEventId(),
        type: 'message',
        channel: CHANNEL_PATTERNS.USER_NOTIFICATIONS(userId),
        data: {
          event: WS_EVENT_TYPES.NOTIFICATION,
          notification,
        },
        timestamp: new Date().toISOString(),
      };
      if (event.channel) {
        void websocketService.broadcastToChannel(event.channel, event);
      }
      return Promise.resolve(createSuccessResult(undefined));
    } catch (error: unknown) {
      return Promise.resolve(createErrorResult(
        error instanceof Error ? error : new Error('Failed to send user notification')
      ));
    }
  }
  /**
   * Broadcast system alert
   */
  public async broadcastSystemAlert(
    alert: {
      level: 'info' | 'warning' | 'error';
      title: string;
      message: string;
      data?: unknown;
    }
  ): Promise<AsyncResult<void, Error>> {
    try {
      const event: WebSocketEvent = {
        id: this.generateEventId(),
        type: 'system',
        channel: CHANNEL_PATTERNS.SYSTEM_NOTIFICATIONS,
        data: {
          event: 'system:alert',
          alert,
        },
        timestamp: new Date().toISOString(),
      };
      if (event.channel) {
        void websocketService.broadcastToChannel(event.channel, event);
      }
      // System alerts should go to all channels
      if (this.config.broadcastToSSE) {
        // Note: eventStreamService.sendEvent method needs to be implemented
        // eventStreamService.sendEvent({
        //   type: WS_EVENT_TYPES.SYSTEM_ALERT,
        //   data: event.data,
        // });
      }
      if (this.config.broadcastToWebhooks) {
        await webhookService.trigger({
          id: this.generateEventId(),
          timestamp: new Date().toISOString(),
          type: 'system:alert',
          data: event.data as Record<string, unknown>,
        });
      }
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to broadcast system alert')
      );
    }
  }
  /**
   * Get WebSocket statistics
   */
  public async getConnectionStats(): Promise<{
    totalConnections: number;
    activeChannels: number;
    connectionsByChannel: Record<string, number>;
    averageSubscriptionsPerConnection: number;
  }> {
    const stats = await websocketService.getStats();
    return {
      totalConnections: stats.totalClients,
      activeChannels: stats.totalChannels,
      connectionsByChannel: stats.clientsByChannel,
      averageSubscriptionsPerConnection: stats.averageSubscriptionsPerClient,
    };
  }
  /**
   * Broadcast a system event to appropriate channels
   */
  private broadcastSystemEvent(event: unknown): void {
    const wsEvent: WebSocketEvent = {
      id: this.generateEventId(),
      type: 'system',
      channel: 'public:updates',
      data: event,
      timestamp: new Date().toISOString(),
    };
    if (wsEvent.channel) {
      void websocketService.broadcastToChannel(wsEvent.channel, wsEvent);
    }
  }
  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Clean up resources
   */
  public dispose(): void {
    // WebSocket service is a singleton, don't shut it down here
    super.dispose();
  }
}
// Factory function
export function createWebSocketApiAdapter(config?: Partial<WebSocketApiConfig>): WebSocketApiAdapter {
  return new WebSocketApiAdapter({
    enabled: true,
    broadcastToSSE: true,
    broadcastToWebhooks: true,
    ...config,
  });
}