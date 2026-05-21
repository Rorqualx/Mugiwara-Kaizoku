/**
 * Final test to debug FandomProvider search issue
 */

import { FandomProvider } from '@/server/services/search/providers/FandomProvider';

async function testFandomProvider() {
  console.log('=== Final FandomProvider Debug ===\n');

  const provider = new FandomProvider();

  try {
    console.log('1. Testing basic "Fire Force" search...');
    const results = await provider.search('Fire Force', { limit: 20 });

    console.log(`Results count: ${results.length}`);
    console.log('\nResults:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   ID: ${result.id}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Score: ${result.relevanceScore}`);
      console.log('');
    });

    console.log('2. Testing with explicit manga type...');
    const mangaResults = await provider.search('Fire Force', {
      limit: 20,
      type: 'MANGA'
    });

    console.log(`Manga results count: ${mangaResults.length}`);
    console.log('\nManga results:');
    mangaResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
    });

    console.log('\n3. Testing getMangaDetails with "Fire Force (manga)"...');
    const details = await provider.getMangaDetails('Fire Force (manga)', 'fireforce');
    if (details) {
      console.log('Found details for "Fire Force (manga)":');
      console.log(`   Title: ${details.title}`);
      console.log(`   ID: ${details.id}`);
      console.log(`   URL: ${details.url}`);
    } else {
      console.log('No details found for "Fire Force (manga)"');
    }

  } catch (error) {
    console.error('Error during search:', error);
  } finally {
    provider.destroy();
  }
}

testFandomProvider().catch(console.error);