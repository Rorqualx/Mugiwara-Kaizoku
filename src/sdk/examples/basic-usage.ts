/**
 * Kaizoku API SDK - Basic Usage Examples
 */

import { logger } from '@/utils/logger';

import { createKaizokuApiClient } from '../kaizoku-api-sdk';

// Initialize the client
const client = createKaizokuApiClient({
  baseUrl: 'https://api.kaizoku.app',
  apiKey: 'your-api-key-here',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  logger: {
    debug: (msg, data) => logger.debug(`[DEBUG] ${msg}`, data),
    info: (msg, data) => logger.info(`[INFO] ${msg}`, data),
    warn: (msg, data) => logger.warn(`[WARN] ${msg}`, data),
    error: (msg, error) => console.error(`[ERROR] ${msg}`, error),
  },
});

/**
 * Example 1: Basic Manga Operations
 */
async function mangaOperationsExample(): Promise<void> {
  try {
    // List all manga
    const mangaList = await client.manga.list({
      page: 1,
      limit: 20,
      status: 'ACTIVE',
    });
    
    logger.info(`Found ${mangaList.meta?.total} manga`);
    
    // Get specific manga
    const mangaId = mangaList.data?.[0]?.id;
    if (mangaId) {
      const manga = await client.manga.get(mangaId, {
        include: 'chapters,metadata',
      });
      
      logger.info(`Manga: ${manga.data?.title}`);
      logger.info(`Chapters: ${manga.data?._links["chapters"]}`);
    }
    
    // Create new manga
    const newManga = await client.manga.create({
      title: 'One Piece',
      sourceId: 'one-piece-anilist',
      source: 'anilist',
      libraryId: 1,
      metadata: {
        description: 'The legendary pirate adventure',
        authors: ['Eiichiro Oda'],
        genres: ['Adventure', 'Comedy', 'Drama'],
      },
    });
    
    logger.info(`Created manga with ID: ${newManga.data?.id}`);
    
    // Update manga
    if (newManga.data?.id) {
      const updated = await client.manga.update(newManga.data["id"], {
        status: 'ACTIVE',
        metadata: {
          tags: ['Shonen', 'Pirates', 'Superpowers'],
        },
      });
      
      logger.info(`Updated manga: ${updated.data?.title}`);
    }
    
  } catch (error: unknown) {
    console.error('Manga operations failed:', error);
  }
}

/**
 * Example 2: Library Management
 */
async function libraryManagementExample(): Promise<void> {
  try {
    // List libraries
    const libraries = await client.libraries.list();
    logger.info(`Found ${libraries.data?.length} libraries`);
    
    // Create a new library
    const newLibrary = await client.libraries.create({
      name: 'Shonen Collection',
      path: '/manga/shonen',
      scanInterval: 3600, // 1 hour
    });
    
    logger.info(`Created library: ${newLibrary.data?.name}`);
    
    // Trigger library scan
    if (newLibrary.data?.id) {
      const scanResult = await client.libraries.scan(newLibrary.data["id"]);
      logger.info(`Scan task ID: ${scanResult.data?.taskId}`);
    }
    
  } catch (error: unknown) {
    console.error('Library operations failed:', error);
  }
}

/**
 * Example 3: Download Management
 */
async function downloadManagementExample(): Promise<void> {
  try {
    // Get download stats
    const stats = await client.downloads.stats();
    logger.info('Download Statistics:', {
      active: stats.data?.active,
      queued: stats.data?.queued,
      speed: `${(stats.data?.currentSpeedBps ?? 0) / 1024 / 1024} MB/s`,
    });
    
    // List active downloads
    const downloads = await client.downloads.list({
      status: 'DOWNLOADING',
      limit: 10,
    });
    
    // Pause a download
    const firstDownload = downloads.data?.[0];
    if (firstDownload) {
      await client.downloads.update(firstDownload["id"], {
        status: 'pause',
      });
      logger.info(`Paused download: ${firstDownload["id"]}`);
    }
    
  } catch (error: unknown) {
    console.error('Download operations failed:', error);
  }
}

/**
 * Example 4: Metadata Search
 */
async function metadataSearchExample(): Promise<void> {
  try {
    // Search across providers
    const searchResults = await client["metadata"].search({
      query: 'Naruto',
      providers: ['anilist', 'comicvine'],
      limit: 10,
    });
    
    logger.info(`Found ${Array.isArray(searchResults.data) ? searchResults.data.length : 0} results`);
    
    // List available providers
    const providers = await client["metadata"].providers();
    logger.info('Available providers:', providers.data?.map(p => p["name"]));
    
    // Cancel ongoing search
    client.cancelRequest('metadata-search');
    
  } catch (error: unknown) {
    if (error instanceof Error && (error instanceof Error ? error["name"] : String(error)) === 'AbortError') {
      logger.info('Search was cancelled');
    } else {
      console.error('Metadata search failed:', error);
    }
  }
}

/**
 * Example 5: Webhook Management
 */
async function webhookManagementExample(): Promise<void> {
  try {
    // Create a webhook
    const webhook = await client.webhooks.create({
      url: 'https://your-server.com/webhook',
      events: ['manga.created', 'chapter.downloaded'],
      secret: 'your-webhook-secret',
    });
    
    logger.info(`Created webhook: ${webhook.data?.id}`);
    logger.info(`Secret: ${webhook.data?.secret}`); // Only shown on creation
    
    // Test the webhook
    if (webhook.data?.id) {
      const testResult = await client.webhooks.test(webhook.data["id"]);
      logger.info(`Webhook test: ${testResult.data?.delivered ? 'Success' : 'Failed'}`);
    }
    
    // List all webhooks
    const webhooks = await client.webhooks.list();
    logger.info(`Total webhooks: ${webhooks.data?.length}`);
    
  } catch (error: unknown) {
    console.error('Webhook operations failed:', error);
  }
}

/**
 * Example 6: Error Handling
 */
async function errorHandlingExample(): Promise<void> {
  try {
    // This will fail with 404
    await client.manga.get('non-existent-id');
  } catch (error: unknown) {
    if (error instanceof Error && 'statusCode' in error) {
      const apiError = error as Error & { statusCode: number; code?: string; details?: unknown };
      console.error(`API Error ${apiError.statusCode}: ${apiError.message}`);
      console.error('Error code:', apiError.code);
      console.error('Error details:', apiError.details);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

/**
 * Example 7: Request Cancellation
 */
async function requestCancellationExample(): Promise<void> {
  try {
    // Start a long-running search
    const searchPromise = client["metadata"].search({
      query: 'One Piece',
      providers: ['anilist', 'comicvine', 'fandom'],
      limit: 100,
    });
    
    // Cancel after 1 second
    setTimeout(() => {
      logger.info('Cancelling search...');
      client.cancelRequest('metadata-search');
    }, 1000);
    
    const results = await searchPromise;
    logger.info('Search completed:', Array.isArray(results.data) ? results.data.length : 0);
  } catch (error: unknown) {
    if (error instanceof Error && (error instanceof Error ? error["name"] : String(error)) === 'AbortError') {
      logger.info('Search was successfully cancelled');
    } else {
      console.error('Search failed:', error);
    }
  }
}

// Run examples
async function runExamples(): Promise<void> {
  logger.info('=== Kaizoku API SDK Examples ===\n');
  
  logger.info('1. Manga Operations');
  await mangaOperationsExample();
  
  logger.info('\n2. Library Management');
  await libraryManagementExample();
  
  logger.info('\n3. Download Management');
  await downloadManagementExample();
  
  logger.info('\n4. Metadata Search');
  await metadataSearchExample();
  
  logger.info('\n5. Webhook Management');
  await webhookManagementExample();
  
  logger.info('\n6. Error Handling');
  await errorHandlingExample();
  
  logger.info('\n7. Request Cancellation');
  await requestCancellationExample();
}

// Export for use in other examples
export { client, runExamples };