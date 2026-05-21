/**
 * Kaizoku API SDK - WebSocket Real-time Examples
 */

import { CHANNEL_PATTERNS, WS_EVENT_TYPES } from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';

import { createKaizokuApiClient } from '../kaizoku-api-sdk';

// Initialize client
const client = createKaizokuApiClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key-here',
  logger: {
    debug: (msg, data) => logger.debug(`[DEBUG] ${msg}`, data),
    info: (msg, data) => logger.info(`[INFO] ${msg}`, data),
    warn: (msg, data) => logger.warn(`[WARN] ${msg}`, data),
    error: (msg, error) => logger.error(`[ERROR] ${msg}`, error),
  },
});

/**
 * Example 1: Basic WebSocket Connection
 */
async function basicWebSocketExample(): Promise<void> {
  logger.info('\n🔌 Basic WebSocket Connection\n');

  try {
    // Connect to WebSocket server
    await client.websocket.connect({
      reconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
    });

    logger.info('✅ Connected to WebSocket server');
    logger.info(`State: ${client.websocket.getState()}`);

    // Subscribe to system notifications channel
    client.websocket.subscribe([CHANNEL_PATTERNS.SYSTEM_NOTIFICATIONS]);

    // Handle connection events
    const unsubConnected = client.websocket.on('connected', (data) => {
      const d = data as Record<string, unknown>;
      logger.info('Connected with client ID:', d["clientId"]);
    });

    const unsubSubscribed = client.websocket.on('subscribed', (data) => {
      const d = data as Record<string, unknown>;
      logger.info('Subscribed to channels:', d["channels"]);
    });

    // Clean up after 10 seconds
    setTimeout(() => {
      unsubConnected();
      unsubSubscribed();
      client.websocket.disconnect();
      logger.info('Disconnected from WebSocket server');
    }, 10000);

  } catch (error: unknown) {
    logger.error('WebSocket connection failed:', error);
  }
}

/**
 * Example 2: Real-time Manga Updates
 */
async function mangaUpdatesExample(): Promise<void> {
  logger.info('\n📚 Real-time Manga Updates\n');

  try {
    await client.websocket.connect();

    // Subscribe to manga updates for specific manga
    const mangaId = 1;
    const channels = [
      CHANNEL_PATTERNS.MANGA_UPDATES(mangaId),
      CHANNEL_PATTERNS.MANGA_CHAPTERS(mangaId),
    ];

    client.websocket.subscribe(channels, {
      includeHistory: true,
      historyLimit: 10,
    });

    // Handle manga events
    const _unsubMangaUpdated = client.websocket.on(WS_EVENT_TYPES.MANGA_UPDATE, (data) => {
      const d = data as Record<string, unknown>;
      logger.info('📝 Manga updated:', data);
      logger.info('  Changes:', d["changes"]);
    });

    const _unsubChapterAdded = client.websocket.on(WS_EVENT_TYPES.CHAPTER_UPDATE, (data) => {
      const d = data as Record<string, unknown>;
      const manga = d["manga"] as Record<string, unknown>;
      const chapter = d["chapter"] as Record<string, unknown>;
      logger.info('📖 New chapter added:', data);
      logger.info(`  ${manga["title"]} - Chapter ${chapter["number"]}: ${chapter["title"]}`);
    });

    // Simulate manga update (would normally come from server)
    logger.info('\nWaiting for manga updates...');

  } catch (error: unknown) {
    logger.error('Failed to subscribe to manga updates:', error);
  }
}

/**
 * Example 3: Download Progress Tracking
 */
async function downloadProgressExample(): Promise<void> {
  logger.info('\n📥 Download Progress Tracking\n');

  try {
    await client.websocket.connect();

    // Subscribe to download progress channel
    client.websocket.subscribe([CHANNEL_PATTERNS.DOWNLOAD_PROGRESS]);

    // Track downloads
    const downloads = new Map<string, unknown>();

    const _unsubProgress = client.websocket.on(WS_EVENT_TYPES.DOWNLOAD_PROGRESS, (data) => {
      const d = data as Record<string, unknown>;
      downloads.set(d["downloadId"] as string, data);

      // Display progress
      // eslint-disable-next-line no-console
      console.clear();
      logger.info('📥 Active Downloads:\n');

      downloads.forEach((download, id) => {
        const dl = download as Record<string, unknown>;
        const progressBar = '█'.repeat(Math.floor((dl["progress"] as number) / 5)) +
                          '░'.repeat(20 - Math.floor((dl["progress"] as number) / 5));
        logger.info(`${id}: [${progressBar}] ${dl["progress"]}%`);
        logger.info(`  Speed: ${((dl["speed"] as number) / 1024 / 1024).toFixed(2)} MB/s`);
        logger.info(`  ETA: ${Math.floor((dl["eta"] as number) / 60)}m ${(dl["eta"] as number) % 60}s\n`);
      });
    });

    const _unsubCompleted = client.websocket.on('download:completed', (data) => {
      const d = data as Record<string, unknown>;
      logger.info(`✅ Download completed: ${d["chapterTitle"]}`);
      downloads.delete(d["downloadId"] as string);
    });

    const _unsubFailed = client.websocket.on('download:failed', (data) => {
      const d = data as Record<string, unknown>;
      logger.info(`❌ Download failed: ${d["chapterTitle"]}`);
      logger.info(`  Error: ${d["error"]}`);
      downloads.delete(d["downloadId"] as string);
    });

  } catch (error: unknown) {
    logger.error('Failed to track downloads:', error);
  }
}

/**
 * Example 4: Presence System
 */
async function presenceExample(): Promise<void> {
  logger.info('\n👥 Presence System Example\n');

  try {
    await client.websocket.connect();

    // Join a manga reading room
    const mangaId = 1;
    const channel = `manga:${mangaId}:readers`;

    // Subscribe to the channel
    client.websocket.subscribe([channel]);

    // Join with presence
    client.websocket.presence(channel, 'join', {
      status: 'reading',
      metadata: {
        currentChapter: 1050,
        readingSpeed: 'normal',
      },
    });

    // Handle presence updates
    const unsubPresence = client.websocket.on('presence', (data) => {
      const d = data as Record<string, unknown>;
      if (d["channel"] === channel) {
        logger.info('\n👥 Active Readers:');
        const dataObj = d["data"] as Record<string, unknown>;
        const presence = dataObj["presence"] as unknown[];
        presence.forEach((user: unknown) => {
          const u = user as Record<string, unknown>;
          const metadata = u["metadata"] as Record<string, unknown>;
          logger.info(`  - User ${u["userId"]}`);
          logger.info(`    Status: ${u["status"]}`);
          logger.info(`    Chapter: ${metadata["currentChapter"]}`);
        });
      }
    });

    // Update presence periodically
    const presenceInterval = setInterval(() => {
      const currentChapter = Math.floor(Math.random() * 10) + 1050;
      client.websocket.presence(channel, 'update', {
        metadata: {
          currentChapter,
          lastPageRead: new Date().toISOString(),
        },
      });
      logger.info(`Updated reading progress: Chapter ${currentChapter}`);
    }, 5000);

    // Leave after 30 seconds
    setTimeout(() => {
      clearInterval(presenceInterval);
      client.websocket.presence(channel, 'leave');
      unsubPresence();
      logger.info('\nLeft the reading room');
    }, 30000);

  } catch (error: unknown) {
    logger.error('Presence system error:', error);
  }
}

/**
 * Example 5: Subscription-based Notifications
 */
async function subscriptionNotificationsExample(): Promise<void> {
  logger.info('\n🔔 Subscription Notifications\n');

  try {
    // Create subscriptions first
    const mangaSub = await client.subscriptions.create({
      type: 'manga',
      resourceId: 1,
    });

    const librarySub = await client.subscriptions.create({
      type: 'library',
      resourceId: 1,
    });

    logger.info('Created subscriptions:', {
      manga: mangaSub.data?.id,
      library: librarySub.data?.id,
    });

    // Connect to WebSocket
    await client.websocket.connect();

    // Subscribe to user notification channel
    const userId = 'current-user'; // Would be actual user ID
    client.websocket.subscribe([
      CHANNEL_PATTERNS.USER_NOTIFICATIONS(userId),
      // CHANNEL_PATTERNS.USER_ACTIVITY(userId), - doesn't exist
    ]);

    // Handle notifications
    const _unsubNotification = client.websocket.on(WS_EVENT_TYPES.NOTIFICATION, (data) => {
      const d = data as Record<string, unknown>;
      const notification = d["notification"] as Record<string, unknown>;
      logger.info('\n🔔 Notification:');
      logger.info(`  Type: ${notification["type"]}`);
      logger.info(`  Title: ${notification["title"]}`);
      logger.info(`  Message: ${notification["message"]}`);

      if (notification["data"]) {
        logger.info('  Data:', notification["data"]);
      }
    });

    // Handle activity updates
    const _unsubActivity = client.websocket.on('user:activity', (data) => {
      logger.info('\n📊 Activity Update:', data);
    });

    logger.info('\nWaiting for notifications...');

  } catch (error: unknown) {
    logger.error('Subscription notification error:', error);
  }
}

/**
 * Example 6: System Alerts and Monitoring
 */
async function systemMonitoringExample(): Promise<void> {
  logger.info('\n🚨 System Monitoring\n');

  try {
    await client.websocket.connect();

    // Subscribe to system channels
    client.websocket.subscribe([
      // CHANNEL_PATTERNS.SYSTEM_ALERTS, - doesn't exist
      'system:performance',
      'system:health',
    ]);

    // Handle system alerts
    const unsubAlert = client.websocket.on('system:alert', (data) => {
      const d = data as Record<string, unknown>;
      const alert = d["alert"] as Record<string, unknown>;
      const icon = alert["level"] === 'error' ? '🔴' :
                   alert["level"] === 'warning' ? '🟡' : '🟢';

      logger.info(`\n${icon} System Alert: ${alert["title"]}`);
      logger.info(`  ${alert["message"]}`);

      if (alert["data"]) {
        logger.info('  Details:', alert["data"]);
      }
    });

    // Handle system updates
    const unsubUpdate = client.websocket.on('system:update', (data) => {
      logger.info('\n🔄 System Update:', data);
    });

    // Monitor performance metrics
    const metricsInterval = setInterval(() => {
      void (async () => {
        const metrics = await client.metrics.system();

        logger.info('\n📊 System Metrics:');
        logger.info(`  CPU: ${metrics.data?.performance.cpuUsage}%`);
        logger.info(`  Memory: ${metrics.data?.performance.memoryUsage}%`);
        logger.info(`  Active Downloads: ${metrics.data?.downloads.active}`);
        logger.info(`  Connected Clients: ${client.websocket.getState() === 'connected' ? '✅' : '❌'}`);
      })();
    }, 10000);

    // Clean up after 60 seconds
    setTimeout(() => {
      clearInterval(metricsInterval);
      unsubAlert();
      unsubUpdate();
    }, 60000);

  } catch (error: unknown) {
    logger.error('System monitoring error:', error);
  }
}

/**
 * Example 7: Collaborative Features
 */
async function collaborativeExample(): Promise<void> {
  logger.info('\n🤝 Collaborative Features\n');

  try {
    await client.websocket.connect();

    // Create a collaborative session
    const sessionId = 'collab_' + Date.now();
    const sessionChannel = `session:${sessionId}`;

    client.websocket.subscribe([sessionChannel]);

    // Join session with presence
    client.websocket.presence(sessionChannel, 'join', {
      status: 'active',
      metadata: {
        username: 'User1',
        color: '#FF5733',
      },
    });

    // Share activity
    const shareActivity = (action: string, data: unknown): void => {
      client.websocket.publish(sessionChannel, {
        type: 'activity',
        action,
        data,
        timestamp: new Date().toISOString(),
      });
    };

    // Handle collaborative events
    const unsubMessage = client.websocket.on(sessionChannel, (message) => {
      const m = message as Record<string, unknown>;
      const data = m["data"] as Record<string, unknown>;
      if (m["type"] === 'message' && data["type"] === 'activity') {
        logger.info(`\n🤝 ${data["action"]}:`, data["data"]);
      }
    });

    // Simulate collaborative actions
    setTimeout(() => shareActivity('manga.rate', { mangaId: 1, rating: 5 }), 2000);
    setTimeout(() => shareActivity('chapter.comment', { chapterId: 1050, comment: 'Epic chapter!' }), 4000);
    setTimeout(() => shareActivity('list.add', { mangaId: 1, listName: 'Favorites' }), 6000);

    // Leave session after 20 seconds
    setTimeout(() => {
      client.websocket.presence(sessionChannel, 'leave');
      client.websocket.unsubscribe([sessionChannel]);
      unsubMessage();
      logger.info('\nLeft collaborative session');
    }, 20000);

  } catch (error: unknown) {
    logger.error('Collaborative feature error:', error);
  }
}

// Run examples
export async function runWebSocketExamples(): Promise<void> {
  logger.info('=== Kaizoku API - WebSocket Real-time Examples ===\n');

  // Run examples sequentially
  await basicWebSocketExample();
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 15000);
  });

  await mangaUpdatesExample();
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 10000);
  });

  await downloadProgressExample();
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 10000);
  });

  await presenceExample();
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 35000);
  });

  await subscriptionNotificationsExample();
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 10000);
  });

  await systemMonitoringExample();
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 10000);
  });

  await collaborativeExample();
  
  // Final cleanup
  setTimeout(() => {
    client.websocket.disconnect();
    logger.info('\n✅ All examples completed');
    process.exit(0);
  }, 25000);
}

// Export for individual use
export {
  basicWebSocketExample,
  mangaUpdatesExample,
  downloadProgressExample,
  presenceExample,
  subscriptionNotificationsExample,
  systemMonitoringExample,
  collaborativeExample,
};