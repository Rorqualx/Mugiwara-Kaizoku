// @file-size-justified: GraphQL client class wraps urql + WebSocket subscription handling for the Suwayomi schema. Splitting would fragment a single API surface that callers expect to import from one module.
/**
 * Suwayomi GraphQL Client
 *
 * Provides a urql-based GraphQL client for communicating with the Suwayomi
 * server. Supports both HTTP queries/mutations and WebSocket subscriptions.
 *
 * Features:
 * - HTTP endpoint for queries and mutations
 * - WebSocket endpoint for real-time subscriptions
 * - Automatic reconnection handling
 * - Request caching with graphcache
 * - Error handling and logging
 *
 * @module suwayomi/graphql/client
 */

// @ts-ignore - graphql-ws types will be available after bun install
import { createClient as createWsClient, type Client as WsClient } from 'graphql-ws';
import { Client, cacheExchange, fetchExchange, subscriptionExchange } from 'urql';
import WebSocket from 'ws';

import { logger } from '@/utils/logger';

import {
  GET_MANGA,
  GET_CHAPTERS,
  GET_CHAPTER_PAGES,
  GET_SOURCES,
  GET_EXTENSIONS,
  GET_DOWNLOAD_STATUS,
  SEARCH_SOURCE_MANGA,
  GET_SERVER_ABOUT,
  ENQUEUE_CHAPTER_DOWNLOADS,
  DEQUEUE_CHAPTER_DOWNLOADS,
  START_DOWNLOADER,
  STOP_DOWNLOADER,
  CLEAR_DOWNLOADER,
  UPDATE_CHAPTER,
  FETCH_CHAPTERS,
  FETCH_EXTENSIONS,
  INSTALL_EXTENSION,
  UNINSTALL_EXTENSION,
  DOWNLOAD_STATUS_CHANGED,
  LIBRARY_UPDATE_STATUS_CHANGED,
} from './operations';

import type {
  SuwayomiGraphQLConfig,
  SubscriptionOptions,
  DownloadStatus,
  MangaType,
  ChapterType,
  SourceType,
  ExtensionType,
  DownloadStatusChangedPayload,
  LibraryUpdateStatusChangedPayload,
} from './types';
import type { OperationResult, TypedDocumentNode } from 'urql';

// Type definitions for graphql-ws subscription
interface SubscriptionSink<T> {
  next: (value: { data?: T }) => void;
  complete: () => void;
  error: (error: unknown) => void;
}

interface ForwardedSubscriptionOperation {
  query?: string;
  variables?: Record<string, unknown> | undefined;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: SuwayomiGraphQLConfig = {
  httpUrl: 'http://localhost:4567/api/graphql',
  wsUrl: 'ws://localhost:4567/api/graphql',
  timeout: 30000,
  debug: false,
};

const DEFAULT_SUBSCRIPTION_OPTIONS: SubscriptionOptions = {
  autoReconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
};

// =============================================================================
// SuwayomiGraphQLClient Class
// =============================================================================

/**
 * GraphQL client for Suwayomi server communication
 *
 * Provides type-safe methods for interacting with Suwayomi's GraphQL API
 * including queries, mutations, and real-time subscriptions.
 */
export class SuwayomiGraphQLClient {
  private config: SuwayomiGraphQLConfig;
  private subscriptionOptions: SubscriptionOptions;
  private client: Client;
  private wsClient: WsClient | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private subscriptionCallbacks: Map<string, (data: unknown) => void> = new Map();

  /**
   * Create a new SuwayomiGraphQLClient
   *
   * @param config - Client configuration options
   * @param subscriptionOptions - Subscription behavior options
   */
  constructor(
    config?: Partial<SuwayomiGraphQLConfig>,
    subscriptionOptions?: Partial<SubscriptionOptions>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.subscriptionOptions = { ...DEFAULT_SUBSCRIPTION_OPTIONS, ...subscriptionOptions };

    // Initialize urql client
    this.client = this.createClient();

    logger.info('SuwayomiGraphQLClient initialized', {
      httpUrl: this.config.httpUrl,
      wsUrl: this.config.wsUrl,
    });
  }

  /**
   * Create the urql client with appropriate exchanges
   */
  private createClient(): Client {
    const exchanges = [cacheExchange, fetchExchange];

    // Only add subscription exchange if we have a WebSocket client
    if (this.wsClient) {
      // Capture in local variable to avoid null assertion in closure
      const wsClient = this.wsClient;
      exchanges.push(
        subscriptionExchange({
          forwardSubscription: (operation: ForwardedSubscriptionOperation) => ({
            subscribe: (sink: SubscriptionSink<unknown>) => {
              const dispose = wsClient.subscribe(
                {
                  query: operation.query as string,
                  variables: operation.variables ?? null,
                },
                {
                  next: sink.next.bind(sink),
                  complete: sink.complete.bind(sink),
                  error: sink.error.bind(sink),
                }
              );
              return { unsubscribe: dispose };
            },
          }),
        })
      );
    }

    return new Client({
      url: this.config.httpUrl,
      exchanges,
      fetchOptions: () => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Add basic auth if configured
        if (this.config.basicAuth) {
          const credentials = Buffer.from(
            `${this.config.basicAuth.username}:${this.config.basicAuth.password}`
          ).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }

        // Add auth token if configured
        if (this.config.authToken) {
          headers['Authorization'] = `Bearer ${this.config.authToken}`;
        }

        return { headers };
      },
      requestPolicy: 'cache-and-network',
    });
  }

  /**
   * Initialize WebSocket connection for subscriptions
   */
  public initializeSubscriptions(): void {
    if (this.wsClient) {
      logger.warn('WebSocket client already initialized');
      return;
    }

    try {
      this.wsClient = createWsClient({
        url: this.config.wsUrl,
        webSocketImpl: WebSocket,
        connectionParams: () => {
          const params: Record<string, string> = {};

          if (this.config.basicAuth) {
            const credentials = Buffer.from(
              `${this.config.basicAuth.username}:${this.config.basicAuth.password}`
            ).toString('base64');
            params['Authorization'] = `Basic ${credentials}`;
          }

          if (this.config.authToken) {
            params['Authorization'] = `Bearer ${this.config.authToken}`;
          }

          return params;
        },
        on: {
          connected: () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            logger.info('GraphQL WebSocket connected', { url: this.config.wsUrl });
          },
          closed: (event: unknown) => {
            this.isConnected = false;
            logger.warn('GraphQL WebSocket closed', { event });

            if (this.subscriptionOptions.autoReconnect) {
              this.handleReconnect();
            }
          },
          error: (error: unknown) => {
            logger.error('GraphQL WebSocket error', { error });
          },
        },
        retryAttempts: this.subscriptionOptions.maxReconnectAttempts ?? 10,
        retryWait: async () => {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, this.subscriptionOptions.reconnectInterval);
          });
        },
      });

      // Recreate the urql client with subscription support
      this.client = this.createClient();

      logger.info('WebSocket subscriptions initialized');
    } catch (error) {
      logger.error('Failed to initialize WebSocket subscriptions', { error });
      throw error;
    }
  }

  /**
   * Handle WebSocket reconnection
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= (this.subscriptionOptions.maxReconnectAttempts ?? 10)) {
      logger.error('Max WebSocket reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`Attempting WebSocket reconnection (${this.reconnectAttempts})`);

    setTimeout(() => {
      void this.initializeSubscriptions();
    }, this.subscriptionOptions.reconnectInterval);
  }

  /**
   * Update client configuration
   */
  public updateConfig(config: Partial<SuwayomiGraphQLConfig>): void {
    this.config = { ...this.config, ...config };
    this.client = this.createClient();
    logger.info('SuwayomiGraphQLClient configuration updated');
  }

  /**
   * Check if client is connected
   */
  public getConnectionStatus(): { http: boolean; ws: boolean } {
    return {
      http: true, // HTTP is always "connected" unless the server is down
      ws: this.isConnected,
    };
  }

  /**
   * Dispose of client resources
   */
  public dispose(): void {
    if (this.wsClient) {
      void this.wsClient.dispose();
      this.wsClient = null;
    }
    this.subscriptionCallbacks.clear();
    this.isConnected = false;
    logger.info('SuwayomiGraphQLClient disposed');
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * Execute a GraphQL query
   */
  private async query<TData, TVariables extends Record<string, unknown>>(
    document: string | TypedDocumentNode<TData, TVariables>,
    variables?: TVariables
  ): Promise<OperationResult<TData, TVariables>> {
    return this.client.query(document, variables ?? ({} as TVariables)).toPromise();
  }

  /**
   * Execute a GraphQL mutation
   */
  private async mutate<TData, TVariables extends Record<string, unknown>>(
    document: string | TypedDocumentNode<TData, TVariables>,
    variables?: TVariables
  ): Promise<OperationResult<TData, TVariables>> {
    return this.client.mutation(document, variables ?? ({} as TVariables)).toPromise();
  }

  /**
   * Check server health
   */
  public async checkServerHealth(): Promise<boolean> {
    try {
      const result = await this.query<{ aboutServer: { name: string } }, Record<string, never>>(
        GET_SERVER_ABOUT
      );
      return !result.error && !!result.data?.aboutServer;
    } catch {
      return false;
    }
  }

  /**
   * Get manga by ID
   */
  public async getManga(id: number): Promise<MangaType | null> {
    const result = await this.query<{ manga: MangaType }, { id: number }>(
      GET_MANGA,
      { id }
    );

    if (result.error) {
      logger.error('Failed to get manga', { id, error: result.error });
      return null;
    }

    return result.data?.manga ?? null;
  }

  /**
   * Get chapters for a manga
   */
  public async getChapters(
    mangaId: number,
    first?: number,
    after?: string
  ): Promise<{ chapters: ChapterType[]; hasNextPage: boolean; totalCount: number }> {
    const variables: { mangaId: number; first?: number; after?: string } = { mangaId };
    if (first !== undefined) variables.first = first;
    if (after !== undefined) variables.after = after;

    const result = await this.query<
      { chapters: { nodes: ChapterType[]; pageInfo: { hasNextPage: boolean }; totalCount: number } },
      { mangaId: number; first?: number; after?: string }
    >(GET_CHAPTERS, variables);

    if (result.error || !result.data) {
      logger.error('Failed to get chapters', { mangaId, error: result.error });
      return { chapters: [], hasNextPage: false, totalCount: 0 };
    }

    return {
      chapters: result.data.chapters.nodes,
      hasNextPage: result.data.chapters.pageInfo.hasNextPage,
      totalCount: result.data.chapters.totalCount,
    };
  }

  /**
   * Get chapter page URLs (uses fetchChapterPages mutation in current Suwayomi schema)
   */
  public async getChapterPages(chapterId: number): Promise<string[]> {
    const result = await this.mutate<
      { fetchChapterPages: { pages: string[] } },
      { chapterId: number }
    >(GET_CHAPTER_PAGES, { chapterId });

    if (result.error || !result.data) {
      logger.error('Failed to get chapter pages', { chapterId, error: result.error });
      return [];
    }

    return result.data.fetchChapterPages.pages;
  }

  /**
   * Get all sources
   */
  public async getSources(): Promise<SourceType[]> {
    const result = await this.query<
      { sources: { nodes: SourceType[] } },
      Record<string, never>
    >(GET_SOURCES);

    if (result.error || !result.data) {
      logger.error('Failed to get sources', { error: result.error });
      return [];
    }

    return result.data.sources.nodes;
  }

  /**
   * Get all extensions
   */
  public async getExtensions(): Promise<ExtensionType[]> {
    const result = await this.query<
      { extensions: { nodes: ExtensionType[] } },
      Record<string, never>
    >(GET_EXTENSIONS);

    if (result.error || !result.data) {
      logger.error('Failed to get extensions', { error: result.error });
      return [];
    }

    return result.data.extensions.nodes;
  }

  /**
   * Get download status
   */
  public async getDownloadStatus(): Promise<DownloadStatus | null> {
    const result = await this.query<
      { downloadStatus: DownloadStatus },
      Record<string, never>
    >(GET_DOWNLOAD_STATUS);

    if (result.error || !result.data) {
      logger.error('Failed to get download status', { error: result.error });
      return null;
    }

    return result.data.downloadStatus;
  }

  /**
   * Search manga in a source
   */
  public async searchSourceManga(
    sourceId: string,
    query: string,
    page = 1
  ): Promise<{ mangas: MangaType[]; hasNextPage: boolean }> {
    const result = await this.mutate<
      { fetchSourceManga: { mangas: MangaType[]; hasNextPage: boolean } },
      { sourceId: string; query: string; page: number }
    >(SEARCH_SOURCE_MANGA, { sourceId, query, page });

    if (result.error || !result.data) {
      logger.error('Failed to search manga', { sourceId, query, error: result.error });
      return { mangas: [], hasNextPage: false };
    }

    return result.data.fetchSourceManga;
  }

  // ===========================================================================
  // Mutation Methods
  // ===========================================================================

  /**
   * Enqueue chapters for download
   */
  public async enqueueChapterDownloads(chapterIds: number[]): Promise<DownloadStatus | null> {
    const result = await this.mutate<
      { enqueueChapterDownloads: { downloadStatus: DownloadStatus } },
      { ids: number[] }
    >(ENQUEUE_CHAPTER_DOWNLOADS, { ids: chapterIds });

    if (result.error || !result.data) {
      logger.error('Failed to enqueue downloads', { chapterIds, error: result.error });
      return null;
    }

    return result.data.enqueueChapterDownloads.downloadStatus;
  }

  /**
   * Dequeue chapters from download
   */
  public async dequeueChapterDownloads(chapterIds: number[]): Promise<DownloadStatus | null> {
    const result = await this.mutate<
      { dequeueChapterDownloads: { downloadStatus: DownloadStatus } },
      { ids: number[] }
    >(DEQUEUE_CHAPTER_DOWNLOADS, { ids: chapterIds });

    if (result.error || !result.data) {
      logger.error('Failed to dequeue downloads', { chapterIds, error: result.error });
      return null;
    }

    return result.data.dequeueChapterDownloads.downloadStatus;
  }

  /**
   * Start the downloader
   */
  public async startDownloader(): Promise<DownloadStatus | null> {
    const result = await this.mutate<
      { startDownloader: { downloadStatus: DownloadStatus } },
      Record<string, never>
    >(START_DOWNLOADER);

    if (result.error || !result.data) {
      logger.error('Failed to start downloader', { error: result.error });
      return null;
    }

    return result.data.startDownloader.downloadStatus;
  }

  /**
   * Stop the downloader
   */
  public async stopDownloader(): Promise<DownloadStatus | null> {
    const result = await this.mutate<
      { stopDownloader: { downloadStatus: DownloadStatus } },
      Record<string, never>
    >(STOP_DOWNLOADER);

    if (result.error || !result.data) {
      logger.error('Failed to stop downloader', { error: result.error });
      return null;
    }

    return result.data.stopDownloader.downloadStatus;
  }

  /**
   * Clear the download queue
   */
  public async clearDownloadQueue(): Promise<DownloadStatus | null> {
    const result = await this.mutate<
      { clearDownloader: { downloadStatus: DownloadStatus } },
      Record<string, never>
    >(CLEAR_DOWNLOADER);

    if (result.error || !result.data) {
      logger.error('Failed to clear download queue', { error: result.error });
      return null;
    }

    return result.data.clearDownloader.downloadStatus;
  }

  /**
   * Update chapter read status
   */
  public async updateChapter(
    chapterId: number,
    patch: { isRead?: boolean; isBookmarked?: boolean; lastPageRead?: number }
  ): Promise<ChapterType | null> {
    const result = await this.mutate<
      { updateChapter: { chapter: ChapterType } },
      { id: number; isRead?: boolean; isBookmarked?: boolean; lastPageRead?: number }
    >(UPDATE_CHAPTER, { id: chapterId, ...patch });

    if (result.error || !result.data) {
      logger.error('Failed to update chapter', { chapterId, patch, error: result.error });
      return null;
    }

    return result.data.updateChapter.chapter;
  }

  /**
   * Refresh the extension catalog from configured `server.extensionRepos`.
   * Returns true on success — the resulting list is fetched via getExtensions.
   */
  public async fetchExtensionCatalog(): Promise<boolean> {
    const result = await this.mutate<
      { fetchExtensions: { extensions: Array<{ pkgName: string }> } },
      Record<string, never>
    >(FETCH_EXTENSIONS);
    if (result.error) {
      logger.warn('fetchExtensionCatalog failed', { error: result.error });
      return false;
    }
    return Boolean(result.data?.fetchExtensions);
  }

  /**
   * Fetch chapters from source
   */
  public async fetchChapters(mangaId: number): Promise<ChapterType[]> {
    const result = await this.mutate<
      { fetchChapters: { chapters: ChapterType[] } },
      { mangaId: number }
    >(FETCH_CHAPTERS, { mangaId });

    if (result.error || !result.data) {
      logger.error('Failed to fetch chapters', { mangaId, error: result.error });
      return [];
    }

    return result.data.fetchChapters.chapters;
  }

  /**
   * Install an extension
   */
  public async installExtension(pkgName: string): Promise<boolean> {
    const result = await this.mutate<
      { updateExtension: { extension: ExtensionType } },
      { pkgName: string }
    >(INSTALL_EXTENSION, { pkgName });

    if (result.error || !result.data) {
      logger.error('Failed to install extension', { pkgName, error: result.error });
      return false;
    }

    return result.data.updateExtension.extension.isInstalled;
  }

  /**
   * Uninstall an extension
   */
  public async uninstallExtension(pkgName: string): Promise<boolean> {
    const result = await this.mutate<
      { uninstallExtension: { extension: ExtensionType } },
      { pkgName: string }
    >(UNINSTALL_EXTENSION, { pkgName });

    if (result.error || !result.data) {
      logger.error('Failed to uninstall extension', { pkgName, error: result.error });
      return false;
    }

    return !result.data.uninstallExtension.extension.isInstalled;
  }

  // ===========================================================================
  // Subscription Methods
  // ===========================================================================

  /**
   * Subscribe to download status changes
   */
  public subscribeToDownloadStatus(
    callback: (status: DownloadStatus) => void
  ): () => void {
    if (!this.wsClient) {
      logger.warn('WebSocket not initialized. Call initializeSubscriptions() first.');
      return () => {};
    }

    const unsubscribe = this.wsClient.subscribe<DownloadStatusChangedPayload>(
      { query: DOWNLOAD_STATUS_CHANGED },
      {
        next: (result: { data?: DownloadStatusChangedPayload }) => {
          if (result.data?.downloadChanged) {
            callback(result.data.downloadChanged);
          }
        },
        error: (error: unknown) => {
          logger.error('Download status subscription error', { error });
        },
        complete: () => {
          logger.info('Download status subscription completed');
        },
      }
    );

    this.subscriptionCallbacks.set('downloadStatus', callback as (data: unknown) => void);

    return () => {
      unsubscribe();
      this.subscriptionCallbacks.delete('downloadStatus');
    };
  }

  /**
   * Subscribe to library update status changes
   */
  public subscribeToLibraryUpdateStatus(
    callback: (status: LibraryUpdateStatusChangedPayload['updateStatusChanged']) => void
  ): () => void {
    if (!this.wsClient) {
      logger.warn('WebSocket not initialized. Call initializeSubscriptions() first.');
      return () => {};
    }

    const unsubscribe = this.wsClient.subscribe<LibraryUpdateStatusChangedPayload>(
      { query: LIBRARY_UPDATE_STATUS_CHANGED },
      {
        next: (result: { data?: LibraryUpdateStatusChangedPayload }) => {
          if (result.data?.updateStatusChanged) {
            callback(result.data.updateStatusChanged);
          }
        },
        error: (error: unknown) => {
          logger.error('Library update status subscription error', { error });
        },
        complete: () => {
          logger.info('Library update status subscription completed');
        },
      }
    );

    this.subscriptionCallbacks.set('libraryUpdateStatus', callback as (data: unknown) => void);

    return () => {
      unsubscribe();
      this.subscriptionCallbacks.delete('libraryUpdateStatus');
    };
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let graphqlClientInstance: SuwayomiGraphQLClient | null = null;

/**
 * Get or create the singleton GraphQL client instance
 */
export function getSuwayomiGraphQLClient(
  config?: Partial<SuwayomiGraphQLConfig>
): SuwayomiGraphQLClient {
  if (!graphqlClientInstance) {
    graphqlClientInstance = new SuwayomiGraphQLClient(config);
  } else if (config) {
    graphqlClientInstance.updateConfig(config);
  }

  return graphqlClientInstance;
}

/**
 * Create a new GraphQL client instance (non-singleton)
 */
export function createSuwayomiGraphQLClient(
  config?: Partial<SuwayomiGraphQLConfig>,
  subscriptionOptions?: Partial<SubscriptionOptions>
): SuwayomiGraphQLClient {
  return new SuwayomiGraphQLClient(config, subscriptionOptions);
}

// Export the class and types
export { SuwayomiGraphQLConfig, SubscriptionOptions };
