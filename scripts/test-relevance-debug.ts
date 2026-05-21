/**
 * Test to debug relevance scoring with debug output
 */

import { FandomProvider } from '@/server/services/search/providers/FandomProvider';

async function testRelevanceDebug() {
  console.log('=== Testing FandomProvider Relevance Scoring Debug ===\n');

  const provider = new FandomProvider();

  try {
    console.log('Testing "Fire Force" search...');
    const results = await provider.search('Fire Force', { limit: 20 });

    console.log(`\nFinal results count: ${results.length}`);
    console.log('\nFinal results:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   ID: ${result.id}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Score: ${result.relevanceScore}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error during search:', error);
  } finally {
    provider.destroy();
  }
}

testRelevanceDebug().catch(console.error);