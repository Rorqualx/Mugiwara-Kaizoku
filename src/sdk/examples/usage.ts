/**
 * Kaizoku API SDK Usage Examples
 */

/* eslint-disable complexity, max-statements -- SDK example file demonstrating multiple API usage patterns */

import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

import { createKaizokuApiClient, ApiError } from '../kaizoku-api-sdk';

/**
 * Metadata provider structure
 */
interface MetadataProvider {
  name: string;
  status: string;
  features: string[];
}

// Initialize the client
const client = createKaizokuApiClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key-here',
  timeout: 30000,
  retryAttempts: 3
});
async function examples(): Promise<void> {
  try {
    // Example 1: Health check
    logger.info('=== Health Check ===');
    const health = await client.system.health();
    logger.info('API Status:', health.data?.status);
    logger.info('Database:', health.data?.checks.database["status"]);

    // Example 2: List libraries
    logger.info('\n=== Libraries ===');
    const libraries = await client.libraries.list();
    logger.info(`Found ${libraries.data?.length} libraries`);
    if (libraries.data && libraries.data.length > 0) {
      const firstLibrary = libraries.data[0];
      if (!firstLibrary) {
        logger.info('No library found');
        return;
      }
      logger.info(`Library: ${firstLibrary["name"]} (${firstLibrary.mangaCount} manga)`);

      // Example 3: List manga in library
      logger.info('\n=== Manga List ===');
      const mangaList = await client.manga.list({
        libraryId: toStringId(firstLibrary["id"]),
        limit: 10
      });
      logger.info(`Page ${mangaList.meta?.page} of ${Math.ceil((mangaList.meta?.total ?? 0) / (mangaList.meta?.limit || 1))}`);
      mangaList.data?.forEach(manga => {
        logger.info(`- ${manga["title"]} (${manga["status"]})`);
      });

      // Example 4: Get specific manga details
      if (mangaList.data && mangaList.data.length > 0) {
        const manga = mangaList.data[0];
        if (!manga) {
          logger.info('No manga found');
          return;
        }
        logger.info('\n=== Manga Details ===');
        const mangaDetails = await client.manga.get(manga["id"], {
          include: 'metadata,chapters'
        });
        logger.info(`Title: ${mangaDetails.data?.title}`);
        logger.info(`Status: ${mangaDetails.data?.status}`);
        logger.info(`Genres: ${mangaDetails.data?.metadata?.genres?.join(', ')}`);
      }
    }

    // Example 5: Search metadata
    logger.info('\n=== Metadata Search ===');
    const searchResults = await client["metadata"].search({
      query: 'One Piece',
      limit: 5
    });
    const searchData = searchResults.data as Record<string, unknown> | undefined;
    const searchMeta = searchData && 'meta' in searchData ? searchData["meta"] as Record<string, unknown> : {};
    const searchProviders = searchData && 'providers' in searchData ? searchData["providers"] as Record<string, unknown>[] : [];
    logger.info(`Searched ${searchMeta["totalProviders"]} providers`);
    searchProviders.forEach((provider: Record<string, unknown>) => {
      logger.info(`\nProvider: ${provider["provider"]}`);
      if (provider["error"]) {
        logger.info(`  Error: ${provider["error"]}`);
      } else {
        const providerResults = provider["results"] as unknown[];
        logger.info(`  Found ${providerResults.length} results`);
        providerResults.slice(0, 3).forEach((result: unknown) => {
          const resultRecord = result as Record<string, unknown>;
          logger.info(`  - ${resultRecord["title"]}`);
        });
      }
    });

    // Example 6: List metadata providers
    logger.info('\n=== Metadata Providers ===');
    const providersResult = await client["metadata"].providers();
    (providersResult["data"] as MetadataProvider[] | undefined)?.forEach(provider => {
      logger.info(`${provider.name}: ${provider.status} (${provider.features.join(', ')})`);
    });

    // Example 7: Download statistics
    logger.info('\n=== Download Stats ===');
    const stats = await client.downloads.stats();
    logger.info(`Total downloads: ${stats.data?.total}`);
    logger.info(`Active: ${stats.data?.active}`);
    logger.info(`Queued: ${stats.data?.queued}`);
    logger.info(`Completed: ${stats.data?.completed}`);
    logger.info(`Failed: ${stats.data?.failed}`);

    // Example 8: Create a webhook
    logger.info('\n=== Webhook Creation ===');
    const webhook = await client.webhooks.create({
      url: 'https://example.com/webhook',
      events: ['manga.created', 'chapter.downloaded'],
      secret: 'my-webhook-secret-key'
    });
    logger.info(`Created webhook: ${webhook.data?.id}`);
    logger.info(`Secret: ${webhook.data?.secret}`); // Only shown on creation

    // Example 9: Error handling
    logger.info('\n=== Error Handling ===');
    try {
      await client.manga.get(999999); // Non-existent ID
    } catch (error: unknown) {
      if (error instanceof ApiError) {
        logger.info(`API Error: ${error instanceof Error ? error.message : String(error)} - ${error instanceof Error ? error.message : String(error)}`);
        logger.info(`Status Code: ${error.statusCode}`);
      }
    }

    // Example 10: Cancellable search
    logger.info('\n=== Cancellable Search ===');
    const searchPromise = client["metadata"].search({
      query: 'Naruto',
      limit: 50
    });

    // Cancel after 1 second
    setTimeout(() => {
      logger.info('Cancelling search...');
      client.cancelRequest('metadata-search');
    }, 1000);
    try {
      await searchPromise;
    } catch (error: unknown) {
      if (error instanceof Error ? error.message : String(error) === 'AbortError') {
        logger.info('Search was cancelled successfully');
      }
    }
  } catch (error: unknown) {
    console.error('Example error:', error);
  }
}

// Advanced examples
async function advancedExamples(): Promise<void> {
  // Example 1: Batch operations with error handling
  logger.info('\n=== Batch Download ===');
  const chapters = await client["chapters"].list({
    mangaId: '1',
    limit: 5
  });
  if (chapters.data) {
    const downloadPromises = chapters.data.map(async chapter => {
      try {
        const result = await client["chapters"].download(chapter["id"]);
        return {
          chapter: chapter["title"],
          downloadId: result.data?.downloadId,
          success: true
        };
      } catch (error: unknown) {const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error);
return {
          chapter: chapter["title"],
          errorMessage,
          success: false
        };
      }
    });
    const results = await Promise.all(downloadPromises);
    results.forEach(result => {
      if (result.success) {
        logger.info(`✓ ${result.chapter}: Download ID ${result.downloadId}`);
      } else {
        logger.info(`✗ ${result.chapter}: Failed`);
      }
    });
  }

  // Example 2: Monitoring downloads
  logger.info('\n=== Download Monitoring ===');
  const _monitorDownload = async (downloadId: string): Promise<void> => {
    let complete = false;
    while (!complete) {
      // eslint-disable-next-line no-await-in-loop -- Polling loop must check sequentially
      const download = await client.downloads.get(downloadId);
      if (download.data) {
        logger.info(`Download ${download.data["id"]}: ${download.data.progress}% (${download.data["status"]})`);
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(download.data["status"])) {
          complete = true;
          logger.info(`Download finished with status: ${download.data["status"]}`);
        }
      }

      // Wait 5 seconds before checking again
      if (!complete) {
        // eslint-disable-next-line no-await-in-loop -- Intentional delay between poll iterations
        await new Promise<void>(resolve => { setTimeout(resolve, 5000); });
      }
    }
  };

  // Example 3: Library scan with progress
  logger.info('\n=== Library Scan ===');
  const _scanLibrary = async (libraryId: number): Promise<void> => {
    const scanResult = await client.libraries.scan(libraryId);
    logger.info(`Started scan task: ${scanResult.data?.taskId}`);

    // In a real application, you would monitor the task progress
    // through webhooks or by polling a task status endpoint
  };

  // Example 4: Metadata refresh for all manga
  logger.info('\n=== Bulk Metadata Refresh ===');
  const _refreshAllMetadata = async (libraryId: number): Promise<void> => {
    const mangaList = await client.manga.list({
      libraryId: toStringId(libraryId),
      limit: 100
    });
    if (mangaList.data) {
      logger.info(`Refreshing metadata for ${mangaList.data.length} manga...`);
      for (const manga of mangaList.data) {
        try {
          // eslint-disable-next-line no-await-in-loop -- Sequential execution required for rate limiting
          await client.manga.refreshMetadata(manga["id"], {
            force: true
          });
          logger.info(`✓ Refreshed: ${manga["title"]}`);
        } catch (_error: unknown) {
          logger.info(`✗ Failed: ${manga["title"]}`);
        }

        // Rate limit friendly - wait between requests
        // eslint-disable-next-line no-await-in-loop -- Intentional rate limiting delay
        await new Promise<void>(resolve => { setTimeout(resolve, 1000); });
      }
    }
  };
}

// Export functions for external use
export { examples, advancedExamples };

// Run examples when executed directly
// In ESM, use: node --experimental-modules usage.ts
void examples().then(() => advancedExamples()).catch(console.error);