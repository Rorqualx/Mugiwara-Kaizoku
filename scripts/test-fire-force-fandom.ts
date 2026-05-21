/**
 * Test script for Fire Force search using Fandom provider
 * This script simulates a search and traces the complete data flow
 */

import { FandomProvider } from '../src/server/services/search/providers/FandomProvider';
import { logger } from '../src/utils/logger';
import chalk from 'chalk';

// Configure logger for detailed output
logger.level = 'debug';

async function testFireForceSearch() {
  console.log(chalk.blue.bold('\n=== Fire Force Fandom Search Test ===\n'));

  const provider = new FandomProvider({
    name: 'Fandom',
    identifier: 'fandom'
  });

  try {
    // Step 1: Perform search
    console.log(chalk.yellow('\n📍 Step 1: Searching for "Fire Force"...'));
    const searchResults = await provider.search('Fire Force', {
      type: 'MANGA',
      limit: 5
    });

    console.log(chalk.green(`✅ Found ${searchResults.length} results\n`));

    // Display search results
    searchResults.forEach((result, index) => {
      console.log(chalk.cyan(`\n--- Result ${index + 1} ---`));
      console.log(`Title: ${result.title}`);
      console.log(`ID: ${result.id}`);
      console.log(`Provider: ${result.provider}`);
      console.log(`URL: ${result.url || result.providerUrl || result.wikiUrl}`);
      console.log(`Status: ${result.status}`);
      console.log(`Score: ${result.score}`);

      if (result.alternativeTitles && result.alternativeTitles.length > 0) {
        console.log(`Alternative Titles: ${result.alternativeTitles.join(', ')}`);
      }

      // Display metadata
      if (result.metadata) {
        console.log(chalk.magenta('\n📊 Metadata:'));
        console.log(`  Wiki: ${result.metadata.wiki || 'N/A'}`);
        console.log(`  Author: ${result.metadata.author || result.author || 'N/A'}`);
        console.log(`  Artist: ${result.metadata.artist || result.artist || 'N/A'}`);
        console.log(`  Publisher: ${result.metadata.publisher || result.publisher || 'N/A'}`);
        console.log(`  Magazine: ${result.metadata.magazine || 'N/A'}`);
        console.log(`  Demographic: ${result.metadata.demographic || 'N/A'}`);
        console.log(`  Volumes: ${result.volumes || result.metadata.volumes || 'N/A'}`);
        console.log(`  Chapters: ${result.chapters || result.metadata.chapters || 'N/A'}`);
        console.log(`  Start Date: ${result.startDate || result.metadata.startDate || 'N/A'}`);
        console.log(`  End Date: ${result.endDate || result.metadata.endDate || 'N/A'}`);
        console.log(`  Alternative Titles: ${result.metadata.alternativeTitles ? result.metadata.alternativeTitles.join(', ') : 'N/A'}`);

        if (result.metadata.volumesListUrl) {
          console.log(`  Volumes List URL: ${result.metadata.volumesListUrl}`);
        }

        if (result.metadata.description) {
          console.log(`  Description: ${result.metadata.description.substring(0, 100)}...`);
        }
      }
    });

    // Step 2: Get detailed info for the first result
    if (searchResults.length > 0) {
      const firstResult = searchResults[0];
      console.log(chalk.yellow(`\n📍 Step 2: Getting detailed info for "${firstResult.title}"...`));

      const detailedInfo = await provider.getMangaDetails(firstResult.id);

      if (detailedInfo) {
        console.log(chalk.green('✅ Retrieved detailed information\n'));
        console.log(chalk.cyan('Detailed Info:'));
        console.log(JSON.stringify(detailedInfo, null, 2));
      } else {
        console.log(chalk.red('❌ Could not retrieve detailed information'));
      }
    }

    // Step 3: Analyze data flow
    console.log(chalk.yellow('\n📍 Step 3: Data Flow Analysis'));
    console.log(chalk.cyan('\n🔄 Data Flow Path:'));
    console.log('1. FandomProvider.search() called with query "Fire Force"');
    console.log('2. Provider initializes with popular wikis including "fireforce"');
    console.log('3. Search performed across configured wikis (max 3 by default)');
    console.log('4. FandomService.search() called for each wiki');
    console.log('5. MediaWikiAPI and FandomV1API queries executed');
    console.log('6. Enhanced metadata fetched via getPageMetadata()');
    console.log('7. Infobox data extracted and parsed');
    console.log('8. Wikitext parsed for additional metadata');
    console.log('9. Volume/chapter data scraped from HTML if available');
    console.log('10. Results transformed to standard SearchResult format');
    console.log('11. Results sorted by relevance score');
    console.log('12. Data returned to UI with complete metadata');

    // Step 4: Metadata extraction analysis
    console.log(chalk.yellow('\n📍 Step 4: Metadata Extraction Points'));
    console.log(chalk.cyan('\n🔍 Metadata Sources:'));
    console.log('• Infobox Template Fields:');
    console.log('  - Author, Artist (Written by, Illustrated by)');
    console.log('  - Publisher (English publisher, Licensed by)');
    console.log('  - Volumes, Chapters (with Chapter 0 detection)');
    console.log('  - Original run dates (start/end)');
    console.log('  - Alternative titles (Japanese, Romaji, English)');
    console.log('• Wikitext Content:');
    console.log('  - Synopsis/Plot sections');
    console.log('  - Volume list links');
    console.log('  - Additional metadata from content patterns');
    console.log('• HTML Scraping:');
    console.log('  - Actual volume counts from List of Volumes pages');
    console.log('  - Series-specific volume patterns');
    console.log('• Categories:');
    console.log('  - Genre extraction from wiki categories');

    // Step 5: UI Integration
    console.log(chalk.yellow('\n📍 Step 5: UI Integration Points'));
    console.log(chalk.cyan('\n🖼️ Data Flow to UI:'));
    console.log('1. SearchStep component calls provider search');
    console.log('2. Results stored in WizardContext.formData');
    console.log('3. Metadata mapped to selectedSourcesMetadata');
    console.log('4. VolumesChaptersStep displays volume/chapter data');
    console.log('5. Metadata fields populate form inputs');
    console.log('6. Cover images displayed in media gallery');
    console.log('7. Alternative titles shown in metadata section');

  } catch (error) {
    console.log(chalk.red('\n❌ Error during search:'));
    console.error(error);
  } finally {
    // Cleanup
    await provider.cleanup();
    console.log(chalk.blue('\n=== Test Complete ===\n'));
  }
}

// Run the test
testFireForceSearch().catch(console.error);