/**
 * Test script for Phase 1 Fandom fixes
 * Tests FandomProvider.search() to verify Fire Force returns results
 */

import { FandomProvider } from '../src/server/services/search/providers/FandomProvider';

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Fandom Phase 1 Test - Fire Force Search');
  console.log('='.repeat(60));

  const provider = new FandomProvider();

  console.log('\n--- Test 1: FandomProvider.search("Fire Force") ---');

  try {
    const results = await provider.search('Fire Force', { limit: 5 });

    console.log(`Results count: ${results.length}`);

    if (results.length > 0) {
      console.log('\nResults:');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.title}`);
        console.log(`     Provider: ${r.provider}`);
        console.log(`     Type: ${(r as { type?: string }).type ?? 'N/A'}`);
      });
      console.log('\n✓ SUCCESS: FandomProvider.search() returned results!');
    } else {
      console.log('\n✗ FAILED: FandomProvider.search() returned 0 results');
    }
  } catch (error) {
    console.error('Error:', error);
  }

  console.log('\n--- Test 2: Search with manga type filter ---');

  try {
    const results = await provider.search('Fire Force', { limit: 5, type: 'manga' as never });

    console.log(`Results count: ${results.length}`);

    if (results.length > 0) {
      console.log('\nResults:');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.title}`);
      });
      console.log('\n✓ SUCCESS: Manga type filter returned results!');
    } else {
      console.log('\n✗ FAILED: Manga type filter returned 0 results');
    }
  } catch (error) {
    console.error('Error:', error);
  }

  provider.destroy();
  console.log('\nTest complete.');
}

main().catch(console.error);
