import { configService } from '@/server/services/config/configService';
import { logger } from '@/utils/logger';
import { searchProviderRegistry } from '@/server/services/search/providerRegistry';

async function main() {
  await searchProviderRegistry.initialize(configService);

  // Check if ComicVine is enabled
  const providerConfigService = (await import('@/server/services/search/providerConfigService')).getProviderConfigService(configService);
  const enabled = await providerConfigService.isProviderEnabled('comicvine');
  logger.info('ComicVine enabled:', enabled);

  const allEnabled = await providerConfigService.getEnabledProviders();
  logger.info('All enabled providers:', allEnabled);
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));
