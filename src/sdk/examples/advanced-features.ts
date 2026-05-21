/**
 * Kaizoku API SDK - Advanced Features Examples
 */

/* eslint-disable complexity -- SDK example file demonstrating multiple features */

import { logger } from '@/utils/logger';

import { createKaizokuApiClient, ApiError } from '../kaizoku-api-sdk';

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Initialize client with interceptors
const client = createKaizokuApiClient({
  baseUrl: 'https://api.kaizoku.app',
  apiKey: 'your-api-key-here',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  
  // Custom headers
  headers: {
    'X-Client-Version': '1.0.0',
    'X-Request-Source': 'sdk-examples',
  },
  
  // Interceptors for advanced control
  interceptors: {
    // Modify requests before sending
    request: (config) => {
      logger.info('Request interceptor:', `${config.method} ${JSON.stringify(config.headers)}`);

      // Add timestamp to all requests - return new config with updated headers
      return {
        ...config,
        headers: {
          ...(config.headers as Record<string, string>),
          'X-Request-Time': new Date().toISOString()
        }
      };
    },

    // Process responses
    response: (response) => {
      logger.info('Response interceptor:', `${response["status"]} ${response.headers.get('x-request-id') ?? 'no-id'}`);

      // Log rate limit info
      const remaining = response.headers.get('x-ratelimit-remaining');
      const reset = response.headers.get('x-ratelimit-reset');
      if (remaining && reset) {
        logger.info(`Rate limit: ${remaining} requests remaining, resets at ${new Date(parseInt(reset) * 1000).toLocaleTimeString()}`);
      }

      return response;
    },

    // Handle errors globally
    error: (error) => {
      console.error('Error interceptor:', (error instanceof Error ? error.message : String(error)));

      // Add context to errors
      if (error instanceof ApiError) {
        // Removed malformed assignment
      }

      return error;
    },
  },
  
  // Custom logger
  logger: {
    debug: (msg, data) => logger.debug(`🔍 ${msg}`, data),
    info: (msg, data) => logger.info(`ℹ️ ${msg}`, data),
    warn: (msg, data) => logger.warn(`⚠️ ${msg}`, data),
    error: (msg, error) => console.error(`❌ ${msg}`, error),
  },
});

/**
 * Example 1: Advanced Search with Facets
 */
async function advancedSearchExample(): Promise<void> {
  try {
    logger.info('\n📚 Advanced Search Example\n');
    
    const searchResults = await client.search.manga({
      query: 'pirate',
      filters: {
        status: ['ACTIVE', 'COMPLETED'],
        source: ['anilist'],
        genres: ['Adventure', 'Comedy'],
        yearStart: 1997,
        yearEnd: 2023,
      },
      sort: {
        field: 'updatedAt',
        order: 'desc',
      },
      facets: ['status', 'source', 'genres'],
      page: 1,
      limit: 20,
    });
    
    logger.info(`Found ${searchResults.data?.meta.total} manga matching criteria`);
    
    // Display facets
    if (searchResults.data?.facets) {
      logger.info('\nSearch Facets:');
      Object.entries(searchResults.data.facets).forEach(([facet, values]) => {
        logger.info(`\n${facet}:`);
        values.forEach(v => logger.info(`  - ${v.value}: ${v.count} manga`));
      });
    }
    
    // Get search suggestions
    const suggestions = await client.search.suggestions({
      query: 'one p',
      type: 'manga',
      limit: 5,
    });
    
    logger.info('\nSearch Suggestions:');
    suggestions.data?.suggestions.forEach(s => 
      logger.info(`  - ${s.text} (${s.type})`)
    );
    
  } catch (error: unknown) {
    console.error('Advanced search failed:', error);
  }
}

/**
 * Example 2: Batch Operations
 */
async function batchOperationsExample(): Promise<void> {
  try {
    logger.info('\n🔄 Batch Operations Example\n');
    
    // Execute multiple operations in parallel
    const batchResult = await client.batch.execute({
      operations: [
        {
          id: 'get-manga-1',
          method: 'GET',
          resource: 'manga/1',
        },
        {
          id: 'get-manga-2',
          method: 'GET',
          resource: 'manga/2',
        },
        {
          id: 'update-manga-3',
          method: 'PATCH',
          resource: 'manga/3',
          body: { status: 'ACTIVE' },
        },
        {
          id: 'download-chapter',
          method: 'POST',
          resource: 'chapters/100/download',
        },
      ],
      options: {
        parallel: true,
        continueOnError: true,
        timeout: 10000,
      },
    });
    
    logger.info('Batch Summary:');
    logger.info(`  Total: ${batchResult.data?.summary.total}`);
    logger.info(`  Successful: ${batchResult.data?.summary.successful}`);
    logger.info(`  Failed: ${batchResult.data?.summary.failed}`);
    logger.info(`  Duration: ${batchResult.data?.summary.duration}ms`);
    
    // Check individual results
    batchResult.data?.results.forEach(result => {
      if (result["status"] === 'error') {
        console.error(`Operation ${result["id"]} failed:`, result.error);
      } else {
        logger.info(`Operation ${result["id"]} succeeded`);
      }
    });
    
    // Transactional batch (all or nothing)
    const _transactionalBatch = await client.batch.execute({
      operations: [
        {
          id: 'create-library',
          method: 'POST',
          resource: 'libraries',
          body: { name: 'New Collection', path: '/manga/new' },
        },
        {
          id: 'add-manga',
          method: 'POST',
          resource: 'manga',
          body: {
            title: 'New Manga',
            sourceId: 'new-manga-id',
            source: 'anilist',
            libraryId: '${create-library["id"]}', // Reference previous result
          },
        },
      ],
      options: {
        transactional: true,
      },
    });
    
    logger.info('\nTransactional batch completed successfully');
    
  } catch (error: unknown) {
    console.error('Batch operations failed:', error);
  }
}

/**
 * Example 3: Server-Sent Events (Real-time Updates)
 */
function serverSentEventsExample(): void {
  logger.info('\n📡 Server-Sent Events Example\n');
  
  // Connect to event stream
  const lastEventId = localStorage.getItem('lastEventId');
  const eventSource = client.events.stream({
    events: ['manga.created', 'manga.updated', 'chapter.downloaded', 'task.completed'],
    ...(lastEventId && { lastEventId }),
  });
  
  // Handle connection events
  eventSource.onopen = () => {
    logger.info('✅ Connected to event stream');
  };
  
  eventSource.onerror = (error) => {
    console.error('❌ Event stream error:', error);
    
    // EventSource will automatically reconnect
    logger.info('🔄 Reconnecting...');
  };
  
  // Subscribe to specific events
  const unsubscribeMangaCreated = client.events.on(eventSource, 'manga.created', (data: unknown) => {
    if (!isRecord(data)) return;
    logger.info('📖 New manga created:', data["title"]);
    logger.info('  Source:', data["source"]);
    logger.info('  ID:', data["id"]);
  });

  const unsubscribeMangaUpdated = client.events.on(eventSource, 'manga.updated', (data: unknown) => {
    if (!isRecord(data)) return;
    logger.info('📝 Manga updated:', data["title"]);
    logger.info('  Changes:', data["changes"]);
  });

  const unsubscribeChapterDownloaded = client.events.on(eventSource, 'chapter.downloaded', (data: unknown) => {
    if (!isRecord(data)) return;
    logger.info('📥 Chapter downloaded:', data["chapterTitle"]);
    logger.info('  Manga:', data["mangaTitle"]);
    const sizeBytes = typeof data["sizeBytes"] === 'number' ? data["sizeBytes"] : 0;
    logger.info('  Size:', `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  });

  const unsubscribeTaskCompleted = client.events.on(eventSource, 'task.completed', (data: unknown) => {
    if (!isRecord(data)) return;
    logger.info('✅ Task completed:', data["type"]);
    logger.info('  Duration:', `${data["duration"]}ms`);
  });
  
  // Handle heartbeat
  eventSource.addEventListener('heartbeat', (_event) => {
    logger.info('💓 Heartbeat received');
  });
  
  // Store last event ID for reconnection
  eventSource.addEventListener('message', (event) => {
    if (event.lastEventId) {
      localStorage.setItem('lastEventId', event.lastEventId);
    }
  });
  
  // Clean up after 30 seconds (for demo)
  setTimeout(() => {
    logger.info('\n🛑 Closing event stream...');
    
    // Unsubscribe from events
    unsubscribeMangaCreated();
    unsubscribeMangaUpdated();
    unsubscribeChapterDownloaded();
    unsubscribeTaskCompleted();
    
    // Close connection
    eventSource.close();
    
    logger.info('Event stream closed');
  }, 30000);
}

/**
 * Example 4: Metrics and Analytics
 */
async function metricsAndAnalyticsExample(): Promise<void> {
  try {
    logger.info('\n📊 Metrics and Analytics Example\n');
    
    // Get API usage metrics
    const apiMetrics = await client.metrics.api({
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      endDate: new Date().toISOString(),
      interval: 'day',
      resources: ['manga', 'chapters'],
      actions: ['read', 'write'],
    });
    
    logger.info('API Usage Summary:');
    logger.info(`  Total Requests: ${apiMetrics.data?.summary.totalRequests}`);
    logger.info(`  Total Errors: ${apiMetrics.data?.summary.totalErrors}`);
    logger.info(`  Avg Response Time: ${apiMetrics.data?.summary.avgResponseTime}ms`);
    
    logger.info('\nTop Resources:');
    apiMetrics.data?.summary.topResources.forEach(r => 
      logger.info(`  - ${r.resource}: ${r.count} requests`)
    );
    
    logger.info('\nTop Errors:');
    apiMetrics.data?.summary.topErrors.forEach(e => 
      logger.info(`  - ${e.code}: ${e.count} occurrences`)
    );
    
    // Get system metrics
    const systemMetrics = await client.metrics.system();
    
    logger.info('\nSystem Metrics:');
    logger.info('  Database:');
    logger.info(`    - Manga: ${systemMetrics.data?.database.mangaCount}`);
    logger.info(`    - Chapters: ${systemMetrics.data?.database.chapterCount}`);
    logger.info(`    - Size: ${((systemMetrics.data?.database.totalSizeBytes ?? 0) / 1024 / 1024 / 1024).toFixed(2)} GB`);
    
    logger.info('  Downloads:');
    logger.info(`    - Active: ${systemMetrics.data?.downloads.active}`);
    logger.info(`    - Queued: ${systemMetrics.data?.downloads.queued}`);
    logger.info(`    - Bandwidth: ${((systemMetrics.data?.downloads.totalBandwidthBytes ?? 0) / 1024 / 1024).toFixed(2)} MB`);
    
    logger.info('  Performance:');
    logger.info(`    - CPU: ${systemMetrics.data?.performance.cpuUsage}%`);
    logger.info(`    - Memory: ${systemMetrics.data?.performance.memoryUsage}%`);
    logger.info(`    - Disk: ${systemMetrics.data?.performance.diskUsage}%`);
    
    // Get user activity
    const userId = 'current-user-id';
    const userMetrics = await client.metrics.user(userId, { days: 30 });
    
    logger.info('\nUser Activity (Last 30 Days):');
    logger.info(`  Manga Added: ${userMetrics.data?.activity.mangaAdded}`);
    logger.info(`  Chapters Read: ${userMetrics.data?.activity.chaptersRead}`);
    logger.info(`  Chapters Downloaded: ${userMetrics.data?.activity.chaptersDownloaded}`);
    logger.info(`  Reading Speed: ${userMetrics.data?.preferences.readingSpeed} chapters/day`);
    
    logger.info('\nFavorite Genres:');
    userMetrics.data?.preferences.favoriteGenres.forEach(g => 
      logger.info(`  - ${g}`)
    );
    
  } catch (error: unknown) {
    console.error('Metrics retrieval failed:', error);
  }
}

/**
 * Example 5: Complex Workflow - Auto-download New Chapters
 */
async function autoDownloadWorkflow(): Promise<void> {
  try {
    logger.info('\n🤖 Auto-download Workflow Example\n');
    
    // Step 1: Search for actively reading manga
    const activeManga = await client.search.manga({
      filters: {
        status: ['ACTIVE'],
        hasDownloadedChapters: true,
      },
      sort: { field: 'updatedAt', order: 'desc' },
      limit: 50,
    });
    
    logger.info(`Found ${activeManga.data?.results.length} active manga`);
    
    // Step 2: Check for new chapters using batch
    const checkOperations = activeManga.data?.results.map(manga => ({
      id: `check-${manga["id"]}`,
      method: 'GET' as const,
      resource: `manga/${manga["id"]}/chapters?status=PENDING&limit=10`,
    })) ?? [];
    
    const batchCheck = await client.batch.execute({
      operations: checkOperations,
      options: { parallel: true },
    });
    
    // Step 3: Queue downloads for new chapters
    const downloadOperations: Array<{
      id: string;
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
      resource: string;
      body?: unknown;
      headers?: Record<string, string>;
    }> = [];

    batchCheck.data?.results.forEach((result, index) => {
      if (!isRecord(result)) return;
      const resultData = result["data"];
      if (!isRecord(resultData)) return;
      const dataField = resultData["data"];

      if (result["status"] === 'success' && Array.isArray(dataField) && dataField.length > 0) {
        const manga = activeManga.data?.results[index];
        logger.info(`\nFound ${dataField.length} new chapters for ${manga?.title}`);

        dataField.forEach((chapter: unknown) => {
          if (isRecord(chapter)) {
            downloadOperations.push({
              id: `download-${chapter["id"]}`,
              method: 'POST' as const,
              resource: `chapters/${chapter["id"]}/download`,
            });
          }
        });
      }
    });

    if (downloadOperations.length > 0) {
      logger.info(`\nQueuing ${downloadOperations.length} chapter downloads...`);

      const downloadBatch = await client.batch.execute({
        operations: downloadOperations,
        options: {
          parallel: true,
          continueOnError: true,
        },
      });
      
      logger.info(`Successfully queued ${downloadBatch.data?.summary.successful} downloads`);
    } else {
      logger.info('\nNo new chapters found');
    }
    
    // Step 4: Monitor download progress
    logger.info('\nMonitoring downloads...');
    
    const monitorDownloads = async (): Promise<void> => {
      const stats = await client.downloads.stats();
      logger.info(`\nDownload Status:`);
      logger.info(`  Active: ${stats.data?.active}`);
      logger.info(`  Queued: ${stats.data?.queued}`);
      logger.info(`  Speed: ${((stats.data?.currentSpeedBps ?? 0) / 1024 / 1024).toFixed(2)} MB/s`);
      
      if ((stats.data?.active ?? 0) > 0 || (stats.data?.queued ?? 0) > 0) {
        setTimeout(() => { void monitorDownloads(); }, 5000); // Check again in 5 seconds
      } else {
        logger.info('\n✅ All downloads completed!');
      }
    };
    
    await monitorDownloads();
    
  } catch (error: unknown) {
    console.error('Auto-download workflow failed:', error);
  }
}

// Run advanced examples
export async function runAdvancedExamples(): Promise<void> {
  logger.info('=== Kaizoku API SDK - Advanced Features ===\n');

  await advancedSearchExample();
  await batchOperationsExample();
  serverSentEventsExample(); // This runs for 30 seconds (sync function with callbacks)
  await metricsAndAnalyticsExample();
  await autoDownloadWorkflow();
}

// Export client for other examples
export { client };