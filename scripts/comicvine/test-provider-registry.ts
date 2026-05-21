import { configService } from '@/server/services/config/configService';
import { logger } from '@/utils/logger';
import { searchProviderRegistry } from '@/server/services/search/providerRegistry';

async function main() {
  await searchProviderRegistry.initialize(configService);

  // Check if ComicVine is enabled
  const providers = searchProviderRegistry.getAvailableProviders();
  logger.info('Available providers:', providers);

  // Try to get ComicVine provider
  try {
    const comicvineProvider = await searchProviderRegistry.getProvider('comicvine');
    logger.info('Got ComicVine provider:', comicvineProvider.name);

    // Try a search
    const results = await comicvineProvider.search('One Piece');
    logger.info('Search results:', results.length);
    if (results.length > 0) {
      logger.info('First result:', results[0]);
    }
  } catch (error) {
    logger.error('Error:', error);
  }
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));
