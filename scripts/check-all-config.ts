/**
 * Check all config entries related to metadata providers
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

async function main() {
  // Get all metadata provider configs
  const allConfigs = await prisma.config.findMany({
    where: {
      OR: [
        { key: { contains: 'metadata', mode: 'insensitive' } },
        { key: { contains: 'provider', mode: 'insensitive' } },
        { scope: 'SYSTEM' }
      ]
    }
  });

  logger.info(`Found ${allConfigs.length} metadata/provider-related config entries`);

  // Group by category
  const metadataProviderConfigs = allConfigs.filter(c => c.key.startsWith('providers.'));
  const integrationConfigs = allConfigs.filter(c => c.key.startsWith('comicvine.') || c.key.startsWith('anilist.') || c.key.startsWith('mangadex.') || c.key.startsWith('fandom.'));

  logger.info('=== Metadata Provider Configs (providers.*) ===');
  for (const config of metadataProviderConfigs) {
    const value = config.value.length > 50 ? `${config.value.substring(0, 50)}...` : config.value;
    logger.info(`${config.key}:`, { value, valueType: config.valueType });
  }

  logger.info('=== Integration Configs ===');
  for (const config of integrationConfigs) {
    const value = config.value.length > 50 ? `${config.value.substring(0, 50)}...` : config.value;
    logger.info(`${config.key}:`, { value, valueType: config.valueType });
  }
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));