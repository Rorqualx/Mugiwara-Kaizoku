/**
 * Subscription Service for Real-time Updates
 *
 * Manages real-time subscriptions and automatic updates
 */

import { EventEmitter } from 'events';

import { prisma } from '@/server/db';
import {
  CHANNEL_PATTERNS} from '@/types/api/v1/websocket';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

import { createWebSocketApiAdapter } from '../adapters/WebSocketApiAdapter';

import { websocketService } from './websocketService';

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface Subscription {
  id: string;
  userId: string;
  type: 'manga' | 'library' | 'download' | 'system';
  resourceId?: string | number;
  filters?: Record<string, unknown>;
  createdAt: Date;
  lastNotified?: Date;
}

interface SubscriptionRule {
  type: string;
  condition: (event: unknown, subscription: Subscription) => boolean;
  channel: (subscription: Subscription) => string;
}

export class SubscriptionService extends EventEmitter {
  private subscriptions: Map<string, Subscription> = new Map();
  private userSubscriptions: Map<string, Set<string>> = new Map();
  private wsAdapter = createWebSocketApiAdapter();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Subscription rules for automatic notifications
  private rules: SubscriptionRule[] = [
    {
      type: 'manga:new_chapter',
      condition: (event, sub) =>
        sub.type === 'manga' &&
        isRecord(event) &&
        getUnknownProperty(event, 'mangaId') === sub.resourceId &&
        getUnknownProperty(event, 'type') === 'chapter.added',
      channel: (sub) => CHANNEL_PATTERNS.MANGA_CHAPTERS(sub.resourceId as number),
    },
    {
      type: 'manga:metadata_update',
      condition: (event, sub) =>
        sub.type === 'manga' &&
        isRecord(event) &&
        getUnknownProperty(event, 'mangaId') === sub.resourceId &&
        getUnknownProperty(event, 'type') === 'manga.updated',
      channel: (sub) => CHANNEL_PATTERNS.MANGA_UPDATES(sub.resourceId as number),
    },
    {
      type: 'library:scan_complete',
      condition: (event, sub) =>
        sub.type === 'library' &&
        isRecord(event) &&
        getUnknownProperty(event, 'libraryId') === sub.resourceId &&
        getUnknownProperty(event, 'type') === 'library.scan.completed',
      channel: (sub) => CHANNEL_PATTERNS.LIBRARY_UPDATES(sub.resourceId as number),
    },
    {
      type: 'download:status_change',
      condition: (event, sub) =>
        sub.type === 'download' &&
        isRecord(event) &&
        ['download.completed', 'download.failed'].includes(String(getUnknownProperty(event, 'type'))),
      channel: () => CHANNEL_PATTERNS.DOWNLOAD_PROGRESS,
    },
  ];

  constructor() {
    super();
    this.initialize();
  }

  /**
   * Initialize subscription service
   */
  private initialize(): void {
    // Set up polling for different subscription types
    this.startPolling('manga', 60000); // Check for new chapters every minute
    this.startPolling('library', 300000); // Check library updates every 5 minutes
    this.startPolling('download', 5000); // Check download progress every 5 seconds
  }

  /**
   * Create a new subscription
   */
  public async createSubscription(
    userId: string,
    type: Subscription['type'],
    resourceId?: string | number,
    filters?: Record<string, unknown>
  ): Promise<AsyncResult<Subscription, Error>> {
    try {
      const subscription: Subscription = {
        id: this.generateSubscriptionId(),
        userId,
        type,
        createdAt: new Date(),
      };
      if (resourceId !== undefined) {
        subscription.resourceId = resourceId;
      }
      if (filters !== undefined) {
        subscription.filters = filters;
      }

      // Store subscription
      this.subscriptions.set(subscription["id"], subscription);
      
      // Track by user
      if (!this.userSubscriptions.has(userId)) {
        this.userSubscriptions.set(userId, new Set());
      }
      const userSubs = this.userSubscriptions.get(userId);
      if (userSubs) {
        userSubs.add(subscription["id"]);
      }

      // Emit event
      this.emit('subscription:created', subscription);

      // Send confirmation notification
      await this.wsAdapter.sendUserNotification(userId, {
        type: 'subscription_created',
        title: 'Subscription Created',
        message: `You are now subscribed to ${type} updates`,
        data: { subscriptionId: subscription["id"] },
      });

      return createSuccessResult(subscription);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to create subscription')
      );
    }
  }

  /**
   * Remove a subscription
   */
  public async removeSubscription(
    userId: string,
    subscriptionId: string
  ): Promise<AsyncResult<void, Error>> {
    try {
      const subscription = this.subscriptions.get(subscriptionId);
      
      if (subscription?.userId !== userId) {
        return createErrorResult(new Error('Subscription not found'));
      }

      // Remove subscription
      this.subscriptions.delete(subscriptionId);
      this.userSubscriptions.get(userId)?.delete(subscriptionId);

      // Clean up empty user set
      if (this.userSubscriptions.get(userId)?.size === 0) {
        this.userSubscriptions.delete(userId);
      }

      // Emit event
      this.emit('subscription:removed', subscription);

      // Send confirmation
      await this.wsAdapter.sendUserNotification(userId, {
        type: 'subscription_removed',
        title: 'Subscription Removed',
        message: `Unsubscribed from ${subscription.type} updates`,
        data: { subscriptionId },
      });

      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error('Failed to remove subscription')
      );
    }
  }

  /**
   * Get user subscriptions
   */
  public getUserSubscriptions(userId: string): Subscription[] {
    const subscriptionIds = this.userSubscriptions.get(userId) ?? new Set();
    return Array.from(subscriptionIds)
      .map(id => this.subscriptions.get(id))
      .filter((sub): sub is Subscription => sub !== undefined);
  }

  /**
   * Process an event and notify subscribers
   */
  public async processEvent(event: unknown): Promise<void> {
    const notifications: Promise<void>[] = [];

    for (const [_subId, subscription] of this.subscriptions) {
      // Find matching rules
      const matchingRules = this.rules.filter(rule =>
        rule.condition(event, subscription)
      );

      for (const rule of matchingRules) {
        notifications.push(this.notifySubscriber(subscription, event, rule));
      }
    }

    await Promise.all(notifications);
  }

  /**
   * Notify a subscriber about an event
   */
  private async notifySubscriber(
    subscription: Subscription,
    event: unknown,
    rule: SubscriptionRule
  ): Promise<void> {
    try {
      // Update last notified time in the stored subscription
      const storedSub = this.subscriptions.get(subscription.id);
      if (storedSub) {
        storedSub.lastNotified = new Date();
      }

      // Send notification
      await this.wsAdapter.sendUserNotification(subscription.userId, {
        type: rule.type,
        title: this.getNotificationTitle(rule.type, event),
        message: this.getNotificationMessage(rule.type, event),
        data: {
          subscriptionId: subscription["id"],
          event,
        },
      });

      // Broadcast to appropriate channel
      const channel = rule.channel(subscription);
      void websocketService.broadcastToChannel(channel, {
        id: this.generateEventId(),
        type: 'message',
        channel,
        data: event,
        timestamp: new Date().toISOString(),
      });

    } catch (error: unknown) {
      logger.error('Failed to notify subscriber:', error);
    }
  }

  /**
   * Start polling for a subscription type
   */
  private startPolling(type: Subscription['type'], interval: number): void {
    const pollFn = async (): Promise<void> => {
      try {
        await this.pollForUpdates(type);
      } catch (error: unknown) {
        logger.error(`Polling error for ${type}:`, error);
      }
    };

    // Initial poll
    void pollFn();

    // Set up interval
    const intervalId = setInterval(() => { void pollFn(); }, interval);
    this.pollingIntervals.set(type, intervalId);
  }

  /**
   * Poll for updates of a specific type
   */
  private async pollForUpdates(type: Subscription['type']): Promise<void> {
    const relevantSubs = Array.from(this.subscriptions.values())
      .filter(sub => sub.type === type);

    if (relevantSubs.length === 0) return;

    switch (type) {
      case 'manga':
        await this.pollMangaUpdates(relevantSubs);
        break;
      case 'library':
        await this.pollLibraryUpdates(relevantSubs);
        break;
      case 'download':
        await this.pollDownloadUpdates(relevantSubs);
        break;
      case 'system':
        // System subscriptions are event-driven, no polling needed
        break;
      default:
        logger.warn(`Unknown subscription type: ${type}`);
        break;
    }
  }

  /**
   * Poll for manga updates (new chapters)
   */
  private async pollMangaUpdates(subscriptions: Subscription[]): Promise<void> {
    const pollPromises = subscriptions.map(async (sub) => {
      if (!sub.resourceId) return;

      try {
        // Check for new chapters since last check
        const lastCheck = sub.lastNotified ?? sub.createdAt;
        const newChapters = await prisma.chapter.findMany({
          where: {
            mangaId: Number(sub.resourceId),
            createdAt: { gt: lastCheck },
          },
          include: {
            Manga: true,
          },
        });

        // Process all chapters in parallel
        await Promise.all(
          newChapters.map(async (chapter) =>
            this.processEvent({
              type: 'chapter.added',
              mangaId: chapter.mangaId,
              chapter: {
                id: chapter["id"],
                title: chapter["title"],
                number: chapter.index,
              },
              manga: {
                id: chapter.Manga["id"],
                title: chapter.Manga["title"],
              },
            })
          )
        );
      } catch (error: unknown) {
        logger.error(`Failed to poll manga updates for ${sub.resourceId}:`, error);
      }
    });

    await Promise.all(pollPromises);
  }

  /**
   * Poll for library updates
   */
  private async pollLibraryUpdates(subscriptions: Subscription[]): Promise<void> {
    const pollPromises = subscriptions.map(async (sub) => {
      if (!sub.resourceId) return;

      try {
        // Check library scan status
        const library = await prisma.library.findUnique({
          where: { id: Number(sub.resourceId) },
        });

        if (library) {
          const lastCheck = sub.lastNotified ?? sub.createdAt;

          // Note: Library doesn't have lastScanAt field, using createdAt as fallback
          if (library.createdAt > lastCheck) {
            // Get scan statistics
            const stats = await this.getLibraryScanStats(library["id"], lastCheck);

            await this.processEvent({
              type: 'library.scan.completed',
              libraryId: library["id"],
              library: {
                id: library["id"],
                name: library["name"],
              },
              stats,
            });
          }
        }
      } catch (error: unknown) {
        logger.error(`Failed to poll library updates for ${sub.resourceId}:`, error);
      }
    });

    await Promise.all(pollPromises);
  }

  /**
   * Poll for download updates
   */
  private pollDownloadUpdates(subscriptions: Subscription[]): Promise<void> {
    // This would integrate with the download service
    // For now, we'll emit mock events
    for (const sub of subscriptions) {
      if (sub.filters?.["activeOnly"]) {
        // Check for active downloads and their progress
        // This would be implemented with actual download tracking
      }
    }
    return Promise.resolve();
  }

  /**
   * Get library scan statistics
   */
  private async getLibraryScanStats(
    libraryId: number, 
    since: Date
  ): Promise<unknown> {
    const [newManga, updatedManga, newChapters] = await Promise.all([
      prisma.manga.count({
        where: {
          libraryId,
          createdAt: { gt: since },
        },
      }),
      prisma.manga.count({
        where: {
          libraryId,
          updatedAt: { gt: since },
          createdAt: { lte: since },
        },
      }),
      prisma.chapter.count({
        where: {
          Manga: { libraryId },
          createdAt: { gt: since },
        },
      }),
    ]);

    return {
      newManga,
      updatedManga,
      newChapters,
      duration: Date.now() - since.getTime(),
    };
  }

  /**
   * Get notification title based on event type
   */
  private getNotificationTitle(type: string, event: unknown): string {
    if (!isRecord(event)) return 'Update Notification';

    switch (type) {
      case 'manga:new_chapter': {
        const manga = getUnknownProperty(event, 'manga');
        const title = isRecord(manga) ? getUnknownProperty(manga, 'title') : undefined;
        return `New Chapter: ${title || 'Unknown'}`;
      }
      case 'manga:metadata_update': {
        const manga = getUnknownProperty(event, 'manga');
        const title = isRecord(manga) ? getUnknownProperty(manga, 'title') : undefined;
        return `Manga Updated: ${title || 'Unknown'}`;
      }
      case 'library:scan_complete': {
        const library = getUnknownProperty(event, 'library');
        const name = isRecord(library) ? getUnknownProperty(library, 'name') : undefined;
        return `Library Scan Complete: ${name || 'Unknown'}`;
      }
      case 'download:status_change':
        return getUnknownProperty(event, 'type') === 'download.completed'
          ? 'Download Complete'
          : 'Download Failed';
      default:
        return 'Update Notification';
    }
  }

  /**
   * Get notification message based on event type
   */
  private getNotificationMessage(type: string, event: unknown): string {
    if (!isRecord(event)) return 'You have a new update';

    switch (type) {
      case 'manga:new_chapter': {
        const chapter = getUnknownProperty(event, 'chapter');
        if (isRecord(chapter)) {
          const number = getUnknownProperty(chapter, 'number');
          const title = getUnknownProperty(chapter, 'title');
          return `Chapter ${number || '?'}: ${title || 'Untitled'}`;
        }
        return 'New chapter available';
      }
      case 'manga:metadata_update':
        return 'Metadata has been updated';
      case 'library:scan_complete': {
        const stats = getUnknownProperty(event, 'stats');
        const newManga = isRecord(stats) ? Number(getUnknownProperty(stats, 'newManga') ?? 0) : 0;
        const newChapters = isRecord(stats) ? Number(getUnknownProperty(stats, 'newChapters') ?? 0) : 0;
        return `Found ${newManga} new manga and ${newChapters} new chapters`;
      }
      case 'download:status_change': {
        const chapterTitle = getUnknownProperty(event, 'chapterTitle');
        return getUnknownProperty(event, 'type') === 'download.completed'
          ? `Successfully downloaded ${chapterTitle || 'chapter'}`
          : `Failed to download ${chapterTitle || 'chapter'}`;
      }
      default:
        return 'You have a new update';
    }
  }

  /**
   * Generate subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up resources
   */
  public shutdown(): void {
    // Clear polling intervals
    for (const interval of this.pollingIntervals.values()) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();

    // Clear subscriptions
    this.subscriptions.clear();
    this.userSubscriptions.clear();
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();