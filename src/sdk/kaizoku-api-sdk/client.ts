/**
 * Kaizoku API SDK - Main Client
 *
 * Full-featured API client with all endpoints for manga, libraries,
 * chapters, downloads, metadata, webhooks, search, batch operations,
 * events, metrics, WebSocket, and subscriptions.
 *
 * Extracted from: kaizoku-api-sdk.ts (lines 419-1067)
 */

import { KaizokuApiClientBase } from './client-base';
import { toError } from './utils';

import type {
  KaizokuApiConfig,
  ApiResponse,
  PaginatedResponse,
  MangaResource,
  LibraryResource,
  ChapterResource,
  DownloadResource,
  WebhookResource,
  MetadataProvider,
  CreateMangaRequest,
  UpdateMangaRequest,
  CreateLibraryRequest,
  UpdateLibraryRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  SearchMetadataParams,
  RefreshMetadataRequest,
  PaginationMeta,
} from './types';

export class KaizokuApiClient extends KaizokuApiClientBase {
  // WebSocket state
  private ws: WebSocket | null = null;
  private wsReconnectAttempts = 0;
  private wsReconnectDelay = 1000;
  private wsMaxReconnectAttempts = 5;
  private wsMessageHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private wsEventHandlers: Map<string, (event: unknown) => void> = new Map();

  // ============================================================================
  // Manga Endpoints
  // ============================================================================

  public manga = {
    list: (params?: {
      page?: number;
      limit?: number;
      libraryId?: string;
      status?: string;
      search?: string;
    }): Promise<PaginatedResponse<MangaResource>> => {
      const requestOptions: { query?: Record<string, unknown> } = {};
      if (params !== undefined) {
        requestOptions.query = params;
      }
      return this.request('GET', '/api/v1/manga', requestOptions);
    },

    get: (id: string | number, options?: { include?: string }): Promise<ApiResponse<MangaResource>> => {
      const requestOptions: { query?: Record<string, unknown> } = {};
      if (options !== undefined) {
        requestOptions.query = options;
      }
      return this.request('GET', `/api/v1/manga/${id}`, requestOptions);
    },

    create: (data: CreateMangaRequest): Promise<ApiResponse<MangaResource>> => {
      return this.request('POST', '/api/v1/manga', { body: data });
    },

    update: (id: string | number, data: UpdateMangaRequest): Promise<ApiResponse<MangaResource>> => {
      return this.request('PATCH', `/api/v1/manga/${id}`, { body: data });
    },

    delete: (id: string | number): Promise<void> => {
      return this.request('DELETE', `/api/v1/manga/${id}`);
    },

    refreshMetadata: (id: string | number, data?: RefreshMetadataRequest): Promise<ApiResponse<unknown>> => {
      return this.request('POST', `/api/v1/manga/${id}/metadata/refresh`, { body: data ?? {} });
    },
  };

  // ============================================================================
  // Library Endpoints
  // ============================================================================

  public libraries = {
    list: (): Promise<ApiResponse<LibraryResource[]>> => {
      return this.request('GET', '/api/v1/libraries');
    },

    get: (id: string | number): Promise<ApiResponse<LibraryResource>> => {
      return this.request('GET', `/api/v1/libraries/${id}`);
    },

    create: (data: CreateLibraryRequest): Promise<ApiResponse<LibraryResource>> => {
      return this.request('POST', '/api/v1/libraries', { body: data });
    },

    update: (id: string | number, data: UpdateLibraryRequest): Promise<ApiResponse<LibraryResource>> => {
      return this.request('PATCH', `/api/v1/libraries/${id}`, { body: data });
    },

    delete: (id: string | number): Promise<void> => {
      return this.request('DELETE', `/api/v1/libraries/${id}`);
    },

    scan: (id: string | number): Promise<ApiResponse<{ taskId: string }>> => {
      return this.request('POST', `/api/v1/libraries/${id}/scan`);
    },
  };

  // ============================================================================
  // Chapter Endpoints
  // ============================================================================

  public chapters = {
    list: (params?: {
      page?: number;
      limit?: number;
      mangaId?: string;
      status?: string;
    }): Promise<PaginatedResponse<ChapterResource>> => {
      const requestOptions: { query?: Record<string, unknown> } = {};
      if (params !== undefined) {
        requestOptions.query = params;
      }
      return this.request('GET', '/api/v1/chapters', requestOptions);
    },

    get: (id: string | number): Promise<ApiResponse<ChapterResource>> => {
      return this.request('GET', `/api/v1/chapters/${id}`);
    },

    download: (id: string | number): Promise<ApiResponse<{ downloadId: string }>> => {
      return this.request('POST', `/api/v1/chapters/${id}/download`);
    },
  };

  // ============================================================================
  // Download Endpoints
  // ============================================================================

  public downloads = {
    list: (params?: {
      page?: number;
      limit?: number;
      status?: string;
      mangaId?: string;
    }): Promise<PaginatedResponse<DownloadResource>> => {
      const requestOptions: { query?: Record<string, unknown> } = {};
      if (params !== undefined) {
        requestOptions.query = params;
      }
      return this.request('GET', '/api/v1/downloads', requestOptions);
    },

    get: (id: string): Promise<ApiResponse<DownloadResource>> => {
      return this.request('GET', `/api/v1/downloads/${id}`);
    },

    update: (id: string, data: {
      priority?: number;
      status?: 'pause' | 'resume' | 'cancel';
    }): Promise<ApiResponse<DownloadResource>> => {
      return this.request('PATCH', `/api/v1/downloads/${id}`, { body: data });
    },

    delete: (id: string): Promise<void> => {
      return this.request('DELETE', `/api/v1/downloads/${id}`);
    },

    stats: (): Promise<ApiResponse<{
      total: number;
      active: number;
      queued: number;
      completed: number;
      failed: number;
      totalSizeBytes: number;
      currentSpeedBps: number;
      timestamp: string;
    }>> => {
      return this.request('GET', '/api/v1/downloads/stats');
    },
  };

  // ============================================================================
  // Metadata Endpoints
  // ============================================================================

  public metadata = {
    search: (params: SearchMetadataParams): Promise<ApiResponse<unknown>> => {
      return this.createCancellableRequest(
        'metadata-search',
        (signal) => this.request('GET', '/api/v1/metadata/search', {
          query: {
            query: params.query,
            ...(params.providers ? { providers: params.providers } : {}),
            ...(params.limit ? { limit: params.limit } : {})
          },
          signal
        })
      );
    },

    providers: (): Promise<ApiResponse<MetadataProvider[]>> => {
      return this.request('GET', '/api/v1/metadata/providers');
    },
  };

  // ============================================================================
  // Webhook Endpoints
  // ============================================================================

  public webhooks = {
    list: (): Promise<ApiResponse<WebhookResource[]>> => {
      return this.request('GET', '/api/v1/webhooks');
    },

    get: (id: string): Promise<ApiResponse<WebhookResource>> => {
      return this.request('GET', `/api/v1/webhooks/${id}`);
    },

    create: (data: CreateWebhookRequest): Promise<ApiResponse<WebhookResource & { secret?: string }>> => {
      return this.request('POST', '/api/v1/webhooks', { body: data });
    },

    update: (id: string, data: UpdateWebhookRequest): Promise<ApiResponse<WebhookResource>> => {
      return this.request('PATCH', `/api/v1/webhooks/${id}`, { body: data });
    },

    delete: (id: string): Promise<void> => {
      return this.request('DELETE', `/api/v1/webhooks/${id}`);
    },

    test: (id: string): Promise<ApiResponse<{ delivered: boolean }>> => {
      return this.request('POST', `/api/v1/webhooks/${id}/test`);
    },
  };

  // ============================================================================
  // System Endpoints
  // ============================================================================

  public system = {
    health: (): Promise<ApiResponse<{
      status: 'ok' | 'error';
      timestamp: string;
      version: string;
      checks: {
        database: { status: 'ok' | 'error'; message?: string };
        cache: { status: 'ok' | 'error'; message?: string };
      };
    }>> => {
      return this.request('GET', '/api/v1/health');
    },
  };

  // ============================================================================
  // Search Endpoints
  // ============================================================================

  public search = {
    manga: (params: {
      query?: string;
      filters?: {
        status?: string[];
        source?: string[];
        libraryId?: number[];
        hasDownloadedChapters?: boolean;
        genres?: string[];
        tags?: string[];
        authors?: string[];
        yearStart?: number;
        yearEnd?: number;
      };
      sort?: {
        field: 'title' | 'createdAt' | 'updatedAt' | 'chapterCount';
        order: 'asc' | 'desc';
      };
      facets?: string[];
      page?: number;
      limit?: number;
    }): Promise<ApiResponse<{
      results: MangaResource[];
      facets?: Record<string, Array<{ value: string; count: number }>>;
      meta: PaginationMeta;
    }>> => {
      return this.createCancellableRequest(
        'search-manga',
        (signal) => this.request('POST', '/api/v1/search', { body: params, signal })
      );
    },

    suggestions: (params: {
      query: string;
      type?: 'manga' | 'author' | 'tag';
      limit?: number;
    }): Promise<ApiResponse<{
      suggestions: Array<{
        text: string;
        type: string;
        count?: number;
      }>;
    }>> => {
      return this.request('GET', '/api/v1/search/suggestions', { query: params });
    },
  };

  // ============================================================================
  // Batch Endpoints
  // ============================================================================

  public batch = {
    execute: (params: {
      operations: Array<{
        id: string;
        method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
        resource: string;
        body?: unknown;
        headers?: Record<string, string>;
      }>;
      options?: {
        parallel?: boolean;
        continueOnError?: boolean;
        transactional?: boolean;
        timeout?: number;
      };
    }): Promise<ApiResponse<{
      results: Array<{
        id: string;
        status: 'success' | 'error';
        statusCode?: number;
        data?: unknown;
        error?: unknown;
      }>;
      summary: {
        total: number;
        successful: number;
        failed: number;
        duration: number;
      };
    }>> => {
      return this.request('POST', '/api/v1/batch', { body: params });
    },
  };

  // ============================================================================
  // Events Endpoints (Server-Sent Events)
  // ============================================================================

  public events = {
    stream: (params?: {
      events?: string[];
      lastEventId?: string;
    }): EventSource => {
      const url = new URL('/api/v1/events/stream', this.config.baseUrl);

      if (params?.events) {
        url.searchParams.set('events', params.events.join(','));
      }

      if (params?.lastEventId) {
        url.searchParams.set('lastEventId', params.lastEventId);
      }

      const eventSource = new EventSource(url.toString());

      this.logger?.info?.('Connected to event stream');

      eventSource.onerror = (error: Event): void => {
        this.logger?.error?.('Event stream error', error);
      };

      return eventSource;
    },

    on: (
      eventSource: EventSource,
      eventType: string,
      handler: (data: unknown) => void
    ): (() => void) => {
      const listener = (event: MessageEvent): void => {
        try {
          const data = JSON.parse(event.data as string) as unknown;
          handler(data);
        } catch (error: unknown) {
          this.logger?.error?.(`Failed to parse event data for ${eventType}`, error);
        }
      };

      eventSource.addEventListener(eventType, listener);

      return (): void => {
        eventSource.removeEventListener(eventType, listener);
      };
    },
  };

  // ============================================================================
  // Metrics Endpoints
  // ============================================================================

  public metrics = {
    api: (params?: {
      startDate?: string;
      endDate?: string;
      interval?: 'hour' | 'day' | 'week' | 'month';
      resources?: string[];
      actions?: string[];
    }): Promise<ApiResponse<{
      usage: Array<{
        timestamp: string;
        requests: number;
        errors: number;
        avgResponseTime: number;
        byResource: Record<string, {
          requests: number;
          errors: number;
          avgResponseTime: number;
        }>;
      }>;
      summary: {
        totalRequests: number;
        totalErrors: number;
        avgResponseTime: number;
        topResources: Array<{ resource: string; count: number }>;
        topErrors: Array<{ code: string; count: number }>;
      };
    }>> => {
      const requestOptions: { query?: Record<string, unknown> } = {};
      if (params !== undefined) {
        requestOptions.query = params;
      }
      return this.request('GET', '/api/v1/metrics/api', requestOptions);
    },

    system: (): Promise<ApiResponse<{
      database: {
        mangaCount: number;
        chapterCount: number;
        libraryCount: number;
        userCount: number;
        totalSizeBytes: number;
      };
      downloads: {
        active: number;
        queued: number;
        completed: number;
        failed: number;
        totalBandwidthBytes: number;
      };
      metadata: {
        providersOnline: number;
        lastSyncTime: string;
        cachedItems: number;
      };
      performance: {
        cpuUsage: number;
        memoryUsage: number;
        diskUsage: number;
        uptime: number;
      };
    }>> => {
      return this.request('GET', '/api/v1/metrics/system');
    },

    user: (userId: string, params?: {
      days?: number;
    }): Promise<ApiResponse<{
      activity: {
        mangaAdded: number;
        chaptersRead: number;
        chaptersDownloaded: number;
        searchQueries: number;
        apiRequests: number;
      };
      timeline: Array<{
        timestamp: string;
        action: string;
        resource: string;
        details?: unknown;
      }>;
      preferences: {
        favoriteGenres: string[];
        favoriteSources: string[];
        readingSpeed: number;
      };
    }>> => {
      const requestOptions: { query?: Record<string, unknown> } = {};
      if (params !== undefined) {
        requestOptions.query = params;
      }
      return this.request('GET', `/api/v1/metrics/user/${userId}`, requestOptions);
    },
  };

  // ============================================================================
  // WebSocket Endpoints
  // ============================================================================

  public websocket = {
    connect: (options?: {
      reconnect?: boolean;
      reconnectDelay?: number;
      maxReconnectAttempts?: number;
    }): Promise<void> => {
      return new Promise((resolve, reject) => {
        const wsUrl = new URL('/api/v1/ws', this.config.baseUrl);
        wsUrl.protocol = wsUrl.protocol.replace('http', 'ws');
        wsUrl.searchParams.set('apiKey', this.config.apiKey);

        try {
          this.ws = new WebSocket(wsUrl.toString());

          this.ws.onopen = (): void => {
            this.logger?.info?.('WebSocket connected');
            this.wsReconnectAttempts = 0;
            resolve();
          };

          this.ws.onmessage = (event: MessageEvent): void => {
            try {
              const message = JSON.parse(event.data as string) as Record<string, unknown>;
              this.handleWebSocketMessage(message);
            } catch (error: unknown) {
              this.logger?.error?.('Failed to parse WebSocket message', error);
            }
          };

          this.ws.onerror = (error: Event): void => {
            this.logger?.error?.('WebSocket error', error);
            reject(new Error('WebSocket connection failed'));
          };

          this.ws.onclose = (): void => {
            this.logger?.info?.('WebSocket disconnected');

            if (options?.reconnect !== false &&
                this.wsReconnectAttempts < (options?.maxReconnectAttempts ?? this.wsMaxReconnectAttempts)) {
              this.wsReconnectAttempts++;
              const delay = (options?.reconnectDelay ?? this.wsReconnectDelay) * Math.pow(2, this.wsReconnectAttempts - 1);

              this.logger?.info?.(`Reconnecting in ${delay}ms (attempt ${this.wsReconnectAttempts})`);

              setTimeout(() => {
                void this.websocket.connect(options);
              }, delay);
            }
          };

          this.wsEventHandlers.set('ping', (): void => {
            this.websocket.send({ type: 'pong' });
          });

        } catch (error: unknown) {
          reject(toError(error));
        }
      });
    },

    disconnect: (): void => {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.wsMessageHandlers.clear();
      this.wsEventHandlers.clear();
    },

    send: (message: unknown): void => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not connected');
      }
      this.ws.send(JSON.stringify(message));
    },

    subscribe: (channels: string[], options?: {
      includeHistory?: boolean;
      historyLimit?: number;
    }): void => {
      this.websocket.send({
        type: 'subscribe',
        channels,
        options,
      });
    },

    unsubscribe: (channels: string[]): void => {
      this.websocket.send({
        type: 'unsubscribe',
        channels,
      });
    },

    publish: (channel: string, data: unknown): void => {
      this.websocket.send({
        type: 'publish',
        channel,
        data,
      });
    },

    presence: (channel: string, action: 'join' | 'leave' | 'update', data?: {
      status?: string;
      metadata?: Record<string, unknown>;
    }): void => {
      this.websocket.send({
        type: 'presence',
        action,
        channel,
        data,
      });
    },

    on: (event: string, handler: (data: unknown) => void): (() => void) => {
      if (!this.wsMessageHandlers.has(event)) {
        this.wsMessageHandlers.set(event, new Set());
      }

      const handlers = this.wsMessageHandlers.get(event);
      if (handlers) {
        handlers.add(handler);
      }

      return (): void => {
        this.wsMessageHandlers.get(event)?.delete(handler);
        if (this.wsMessageHandlers.get(event)?.size === 0) {
          this.wsMessageHandlers.delete(event);
        }
      };
    },

    getState: (): 'connecting' | 'connected' | 'disconnected' => {
      if (!this.ws) return 'disconnected';

      switch (this.ws.readyState) {
        case WebSocket.CONNECTING:
          return 'connecting';
        case WebSocket.OPEN:
          return 'connected';
        default:
          return 'disconnected';
      }
    },
  };

  // ============================================================================
  // Subscriptions Endpoints
  // ============================================================================

  public subscriptions = {
    create: (params: {
      type: 'manga' | 'library' | 'download' | 'system';
      resourceId?: string | number;
      filters?: Record<string, unknown>;
    }): Promise<ApiResponse<{
      id: string;
      userId: string;
      type: string;
      resourceId?: string | number;
      filters?: Record<string, unknown>;
      createdAt: string;
    }>> => {
      return this.request('POST', '/api/v1/subscriptions', { body: params });
    },

    list: (): Promise<ApiResponse<Array<{
      id: string;
      userId: string;
      type: string;
      resourceId?: string | number;
      filters?: Record<string, unknown>;
      createdAt: string;
      lastNotified?: string;
    }>>> => {
      return this.request('GET', '/api/v1/subscriptions');
    },

    delete: (id: string): Promise<void> => {
      return this.request('DELETE', `/api/v1/subscriptions/${id}`);
    },
  };

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleWebSocketMessage(message: Record<string, unknown>): void {
    if (this.wsEventHandlers.has(message['type'] as string)) {
      this.wsEventHandlers.get(message['type'] as string)?.(message);
    }

    if (message['channel']) {
      const handlers = this.wsMessageHandlers.get(message['channel'] as string);
      if (handlers) {
        handlers.forEach((handler) => handler(message));
      }
    }

    const messageData = message['data'] as Record<string, unknown> | undefined;
    if (messageData && typeof messageData['event'] === 'string') {
      const handlers = this.wsMessageHandlers.get(messageData['event']);
      if (handlers) {
        handlers.forEach((handler) => handler(message['data']));
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createKaizokuApiClient(config: KaizokuApiConfig): KaizokuApiClient {
  return new KaizokuApiClient(config);
}
