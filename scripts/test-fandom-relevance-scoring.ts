/**
 * Test FandomProvider relevance scoring for Fire Force search
 */

import { FandomProvider } from '@/server/services/search/providers/FandomProvider';

async function testRelevanceScoring() {
  console.log('=== Testing FandomProvider Relevance Scoring ===\n');

  const provider = new FandomProvider();

  try {
    console.log('1. Testing "Fire Force" search...');
    const results = await provider.search('Fire Force', { limit: 20 });

    console.log(`Results count: ${results.length}`);
    console.log('\nResults:');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (score: ${result.relevanceScore?.toFixed(2)})`);
      if (result.description) {
        console.log(`   Description: ${result.description.substring(0, 100)}...`);
      }
    });

    console.log('\n2. Testing "Fire Force (manga)" search...');
    const exactResults = await provider.search('Fire Force (manga)', { limit: 10 });

    console.log(`Exact results count: ${exactResults.length}`);
    console.log('\nExact results:');
    exactResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (score: ${result.relevanceScore?.toFixed(2)})`);
    });

    console.log('\n3. Testing available wikis...');
    const wikis = provider.getAvailableWikis();
    console.log(`Available wikis: ${wikis.map(w => w.key).join(', ')}`);

  } catch (error) {
    console.error('Error during search:', error);
  } finally {
    provider.destroy();
  }
}

testRelevanceScoring().catch(console.error);