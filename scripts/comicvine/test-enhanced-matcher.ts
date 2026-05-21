import { EnhancedProviderMatcher } from './enhanced-provider-matcher';
import { logger } from '@/utils/logger';
import { searchProviderRegistry } from '@/server/services/search/registerProviders';

async function main() {
  // Initialize the provider registry
  searchProviderRegistry.initialize();

  const matcher = new EnhancedProviderMatcher({ minScore: 0.3 });

  logger.info('Testing findMatchWithScore for "One Piece"...');
  const result = await matcher.findMatchWithScore('One Piece', 'comicvine');

  logger.info('Result:', {
    id: result.id,
    title: result.title,
    score: result.score,
    allMatchesCount: result.allMatches.length
  });

  if (result.allMatches.length > 0) {
    logger.info('Top 3 matches:');
    result.allMatches.slice(0, 3).forEach((m, i) => {
      logger.info('  ' + (i + 1) + '. ' + m.title + ' (ID: ' + m.id + ', Score: ' + m.score.toFixed(2) + ')');
    });
  }
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));
