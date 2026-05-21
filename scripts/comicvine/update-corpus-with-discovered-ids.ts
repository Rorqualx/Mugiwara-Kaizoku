/**
 * Update corpus with discovered ComicVine IDs
 */

import { COMICVINE_TEST_CORPUS } from './test-comicvine-corpus';
import { logger } from '@/utils/logger';

// Discovered IDs from the discovery script
const DISCOVERED_IDS: Record<string, string> = {
  'One Piece': '31022',
  'Naruto': '18836',
  'Dragon Ball': '49357',
  'Demon Slayer': '112010',
  'Jujutsu Kaisen': '123211',
  'Chainsaw Man': '130799',
  'Spy x Family': '127643',
  'Berserk': '18867',
  'Blade of the Immortal': '55070',
  'Gantz': '27611',
  'Hellsing': '134206',
  'Trigun': '29518',
  'Fairy Tail': '25073',
  'Sword Art Online': '126106'
};

async function main() {
  logger.info('Updating corpus with discovered ComicVine IDs...');
  
  let updatedCount = 0;
  const updates: string[] = [];

  for (const manga of COMICVINE_TEST_CORPUS) {
    const discoveredId = DISCOVERED_IDS[manga.title];
    
    if (discoveredId && manga.comicvineUrl) {
      const currentId = manga.comicvineUrl.match(/4050-(\d+)/)?.[1];
      
      if (currentId !== discoveredId) {
        // Create new URL with discovered ID
        const titleSlug = manga.title.toLowerCase().replace(/\s+/g, '-').replace(/'/g, '').replace(/:/g, '');
        const newUrl = 'https://comicvine.gamespot.com/' + titleSlug + '/4050-' + discoveredId + '/';
        
        updates.push('  {' + '\n' +
          '    title: \'' + manga.title.replace(/'/g, "\\'") + '\',' + '\n' +
          '    anilistSearch: \'' + manga.anilistSearch.replace(/'/g, "\\'") + '\',' + '\n' +
          '    expectedLanguage: \'' + (manga.expectedLanguage || 'en') + '\',' + '\n' +
          '    expectedPublisher: \'' + (manga.expectedPublisher || 'Unknown') + '\',' + '\n' +
          '    comicvineUrl: \'' + newUrl + '\',' + '\n' +
          (manga.overrideChapters ? '    overrideChapters: ' + manga.overrideChapters + ',' + '\n' : '') +
          '  },');
        
        updatedCount++;
        logger.info('Updated "' + manga.title + '": ' + currentId + ' → ' + discoveredId);
      }
    }
  }

  logger.info('Updated ' + updatedCount + ' entries');
  if (updates.length > 0) {
    logger.info('Updated entries:');
    logger.info(updates.join('\n'));
  }
}

main()
  .catch(logger.error)
  .finally(() => process.exit(0));
